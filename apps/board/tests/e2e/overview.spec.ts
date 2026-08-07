import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
});

test.afterEach(async () => {
  await board.close();
});

test.describe('Focus — what the agent is doing right now', () => {
  test('shows the current task and the agent prose about it', async () => {
    const { page } = board;

    await board.push({
      ...envelope(),
      tasks: [
        { id: 'T-011', title: 'Audit the three call sites', status: 'done' },
        { id: 'T-013', title: 'Implement useSession', status: 'active' },
      ],
      focus: {
        task: 'T-013',
        note: 'Writing the hook with the existing error handling moved across unchanged.',
        chip: 'watching',
      },
    });

    await expect(page.getByTestId('focus-task')).toHaveText('T-013');
    await expect(page.getByTestId('focus-note')).toHaveText(
      'Writing the hook with the existing error handling moved across unchanged.',
    );
    await expect(page.getByTestId('section-summary-focus')).toContainText('T-013');
  });

  test('moves the marker when a newer report names a different task', async () => {
    const { page } = board;

    await board.push({ ...envelope(), focus: { task: 'T-013' } });
    await expect(page.getByTestId('focus-task')).toHaveText('T-013');

    await board.push({ ...envelope(), focus: { task: 'T-014' } });
    await expect(page.getByTestId('focus-task')).toHaveText('T-014');
  });

  test('says so rather than marking an arbitrary task when no focus was reported', async () => {
    const { page } = board;

    await board.push({
      ...envelope(),
      tasks: [
        { id: 'T-011', title: 'Audit the three call sites', status: 'done' },
        { id: 'T-013', title: 'Implement useSession', status: 'active' },
      ],
    });

    await expect(page.getByTestId('focus-absent')).toBeVisible();
    await expect(page.getByTestId('focus-task')).toHaveCount(0);
    await expect(page.getByTestId('section-summary-focus')).toHaveText('none reported');
  });

  test('states elapsed time without changing its treatment as time passes', async () => {
    const { page } = board;

    await board.push({ ...envelope(), focus: { task: 'T-013', note: 'Reading the middleware.' } });

    const tag = page.getByTestId('focus-elapsed');
    await expect(tag).toHaveText('0s');

    const before = await tag.evaluate((el) => {
      const style = getComputedStyle(el);
      return { color: style.color, weight: style.fontWeight, opacity: style.opacity };
    });

    // Not a threshold test -- there are no thresholds. It asserts that the only
    // thing which changes is the number, which is what FR-003 asks for.
    await expect(tag).toHaveText('2s', { timeout: 5_000 });

    const after = await tag.evaluate((el) => {
      const style = getComputedStyle(el);
      return { color: style.color, weight: style.fontWeight, opacity: style.opacity };
    });

    expect(after).toEqual(before);
    await expect(page.getByTestId('focus-note')).toBeVisible();
  });

  test('does not reset the elapsed tag when a note arrives', async () => {
    const { page } = board;

    await board.push({ ...envelope(), focus: { task: 'T-013' } });
    await expect(page.getByTestId('focus-elapsed')).toHaveText('2s', { timeout: 5_000 });

    await board.note({ ...envelope(), text: 'noticed while editing' });

    // The title bar heard something; the focus tag reports when the agent last
    // said what it was working on, which was not now.
    await expect(page.getByTestId('elapsed')).toHaveText('heard 0s ago');
    await expect(page.getByTestId('focus-elapsed')).not.toHaveText('0s');
  });
});
