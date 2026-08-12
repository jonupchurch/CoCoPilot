import { basename } from 'node:path';

import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
});

test.afterEach(async () => {
  await board.close();
});

test.describe('the waiting state', () => {
  test('is what a launch with nothing reported shows', async () => {
    // Not a first-run screen: nothing survives a restart, so this is seen on
    // every launch and is a primary layout rather than a fallback.
    const { page } = board;

    await expect(page.getByTestId('waiting-state')).toBeVisible();
    await expect(page.getByText('Waiting for an agent')).toBeVisible();
    await expect(page.getByTestId('nothing-heard')).toHaveText('nothing heard yet');
  });

  test('says there is nothing to configure', async () => {
    await expect(board.page.getByText(/nothing to set up here/i)).toBeVisible();
  });

  test('offers no tab strip at all, rather than tabs leading nowhere', async () => {
    await expect(board.page.locator('.tabstrip')).toHaveCount(0);
  });

  test('populates on the first report, with no restart', async () => {
    const { page } = board;

    expect(await board.push({ ...envelope(), focus: { chip: 'watching' } })).toBe(200);

    await expect(page.getByTestId('identity')).toBeVisible();
    await expect(page.getByTestId('waiting-state')).toHaveCount(0);
    await expect(page.getByTestId('tab-overview')).toBeVisible();
  });
});

test.describe('identity and liveness', () => {
  test('shows the repository, the branch, elapsed time and the reported chip', async () => {
    const { page } = board;

    await board.push({ ...envelope(), focus: { task: 'T013', chip: 'watching' } });

    await expect(page.getByTestId('identity')).toHaveText(
      `${basename(process.cwd())} · feat/session-hook`,
    );
    await expect(page.getByTestId('elapsed')).toHaveText(/^heard \d+s ago$/);
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'watching');
    await expect(page.locator('.chip')).toHaveText('Watching');
  });

  test('keeps the full repository path available without spending the slot on it', async () => {
    await board.push(envelope());

    await expect(board.page.getByTestId('identity')).toHaveAttribute('title', process.cwd());
  });

  test('distinguishes needs-you from working at a glance', async () => {
    const { page } = board;

    await board.push({ ...envelope(), focus: { chip: 'watching' } });
    const working = await page.locator('.chip').evaluate((el) => getComputedStyle(el).color);

    await board.push({ ...envelope(), focus: { chip: 'needs-you' } });
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'needs-you');
    const attention = await page.locator('.chip').evaluate((el) => getComputedStyle(el).color);

    // The only channel by which an agent can ask for a human, so it has to read
    // differently rather than merely say something different.
    expect(attention).not.toBe(working);
  });

  test('updates without the developer doing anything', async () => {
    const { page } = board;

    await board.push({ ...envelope(), focus: { chip: 'thinking' } });
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'thinking');

    await board.push({ ...envelope(), focus: { chip: 'needs-you' } });
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'needs-you');
  });

  test('offers every tab from the first report, content or not', async () => {
    /*
     * Decision 36, replacing FR-009's count-gated strip. A report carrying
     * nothing but identity still offers all four destinations — the navigation
     * is a property of the board, not of what happened to arrive in the last
     * snapshot.
     */
    const { page } = board;

    await board.push(envelope());

    await expect(page.getByTestId('tab-overview')).toBeVisible();
    await expect(page.getByTestId('tab-stories')).toBeVisible();
    await expect(page.getByTestId('tab-tasks')).toBeVisible();
    await expect(page.getByTestId('tab-notes')).toBeVisible();
  });

  test('opens each empty tab onto a view that says it has nothing', async () => {
    /*
     * The other half of decision 36, and the half that makes it defensible: a
     * permanent tab is only not a dead end if the view behind it accounts for
     * itself. Asserted per tab rather than trusting that three empty states
     * exist, because they were written long before anything could reach them.
     */
    const { page } = board;

    await board.push(envelope());

    await page.getByTestId('tab-stories').click();
    await expect(page.getByTestId('stories-empty')).toBeVisible();

    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('tasks-empty')).toBeVisible();

    await page.getByTestId('tab-notes').click();
    await expect(page.getByTestId('notes-empty')).toBeVisible();
  });

  test('does not move the developer when a report empties the tab they are reading', async () => {
    /*
     * FR-017, in the case the count-gated strip could not honour.
     *
     * Reports replace wholesale (decision 26), so a report carrying no tasks
     * after one that carried some is ordinary. Under FR-009 that withdrew the
     * Tasks tab mid-read and the fallback moved the developer to Overview —
     * an agent's report reaching into someone's attention. Now the tab stays
     * and says what it has.
     */
    const { page } = board;

    await board.push({
      ...envelope(),
      tasks: [{ id: 'T001', title: 'A task', status: 'todo' }],
    });
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('task-row-T001')).toBeVisible();

    await board.push(envelope());

    await expect(page.locator('[data-testid="body"]')).toHaveAttribute('data-tab', 'tasks');
    await expect(page.getByTestId('tasks-empty')).toBeVisible();
  });
});
