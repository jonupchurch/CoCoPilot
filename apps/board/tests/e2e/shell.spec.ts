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

  test('offers a tab only once its view has something in it', async () => {
    const { page } = board;

    await board.push(envelope());
    await expect(page.getByTestId('tab-overview')).toBeVisible();
    await expect(page.getByTestId('tab-tasks')).toHaveCount(0);
    await expect(page.getByTestId('tab-notes')).toHaveCount(0);

    await board.push({
      ...envelope(),
      tasks: [{ id: 'T001', title: 'A task', status: 'todo' }],
    });
    await expect(page.getByTestId('tab-tasks')).toBeVisible();

    await board.note({ ...envelope(), text: 'a note' });
    await expect(page.getByTestId('tab-notes')).toBeVisible();
  });
});
