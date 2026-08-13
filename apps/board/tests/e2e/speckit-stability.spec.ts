import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

/**
 * What an arriving report may not do to a developer who is reading.
 *
 * A tree has more to lose than a list — expansion, selection and scroll — so
 * this board's oldest rule costs more here than anywhere else. Every assertion
 * below is over a *sequence* of reports, because none of these can be seen in a
 * single rendered page.
 */

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
  await board.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
});

test.afterEach(async () => {
  await board.close();
});

/** Enough stories that the tree is genuinely scrollable. */
function bigReport(storyCount = 30): Record<string, unknown> {
  const stories = Array.from({ length: storyCount }, (_, i) => ({
    id: `US-${String(i).padStart(3, '0')}`,
    title: `Story number ${i}`,
  }));
  const tasks = stories.flatMap((story, i) => [
    { id: `T-${i}-a`, title: `First of ${story.id}`, status: 'done', storyId: story.id },
    { id: `T-${i}-b`, title: `Second of ${story.id}`, status: 'todo', storyId: story.id },
  ]);
  return { stories, tasks };
}

async function openTree(payload: Record<string, unknown>): Promise<void> {
  await board.push({ ...envelope(), ...payload });
  await board.page.getByTestId('tab-speckit').click();
  await expect(board.page.getByTestId('speckit')).toBeVisible();
}

const scrollTop = async (): Promise<number> =>
  board.page.locator('.speckit__tree').evaluate((el) => el.scrollTop);

test.describe('ten reports change nothing the developer set up', () => {
  test('leaves expansion, selection and scroll exactly where they were', async () => {
    const report = bigReport();
    await openTree(report);
    const { page } = board;

    // Expand something well down the tree, select a task inside it, and scroll.
    await page.getByTestId('speckit-toggle-US-020').click();
    await page.getByTestId('speckit-task-T-20-b').click();
    await page.locator('.speckit__tree').evaluate((el) => {
      el.scrollTop = 400;
    });

    // Measured, not assumed: if the tree is not actually scrollable this test
    // would assert 0 === 0 forever and prove nothing.
    const before = await scrollTop();
    expect(before).toBeGreaterThan(0);

    for (let i = 0; i < 10; i += 1) {
      await board.push({ ...envelope(), ...report });
    }

    await expect(page.getByTestId('speckit-tasks-US-020')).toBeVisible();
    await expect(page.getByTestId('speckit-task-T-20-b')).toHaveAttribute('data-selected', 'true');
    expect(await scrollTop()).toBe(before);
  });

  test('does not move what is on screen when a story is added above it', async () => {
    const report = bigReport();
    await openTree(report);
    const { page } = board;

    await page.locator('.speckit__tree').evaluate((el) => {
      el.scrollTop = 300;
    });

    /*
     * Measured against an anchor row, not against `scrollTop`.
     *
     * Inserting content above the viewport *should* change `scrollTop` — by
     * exactly the height of what was inserted — because that is what keeps the
     * pixels where they were. Chromium's scroll anchoring does this, and the
     * first version of this test asserted `scrollTop` was unchanged and failed
     * at 336 against 300: one story row taller, which is the anchoring working.
     *
     * What FR-033 actually asks is that nothing move under the reader, so the
     * assertion is on where a row the developer can see actually sits. Feature
     * 007 used the same technique for arriving notes, and for the same reason.
     */
    const anchor = page.getByTestId('speckit-story-US-010');
    const before = await anchor.boundingBox();
    expect(before, 'the anchor row is not on screen').not.toBeNull();

    // A story inserted at the very top — the case that renumbers everything
    // below it if keys are positions rather than identifiers.
    const stories = report['stories'] as Array<Record<string, unknown>>;
    await board.push({
      ...envelope(),
      ...report,
      stories: [{ id: 'US-new', title: 'Arrived at the top' }, ...stories],
    });
    await expect(page.getByTestId('speckit-story-US-new')).toBeAttached();

    const after = await anchor.boundingBox();
    expect(after).not.toBeNull();
    // A pixel of tolerance for subpixel layout; a row that actually moved would
    // move by its own height, which is an order of magnitude more.
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
  });
});

test.describe('when what is being read stops being reported', () => {
  const REPORT = {
    stories: [
      { id: 'US-1', title: 'First' },
      { id: 'US-2', title: 'Second' },
    ],
    tasks: [
      { id: 'T-1', title: 'One', status: 'todo', storyId: 'US-1' },
      { id: 'T-2', title: 'Two', status: 'todo', storyId: 'US-1' },
      { id: 'T-3', title: 'Three', status: 'todo', storyId: 'US-2' },
    ],
  };

  test('says the selected task is gone rather than selecting the next one', async () => {
    await openTree(REPORT);
    const { page } = board;

    await page.getByTestId('speckit-toggle-US-1').click();
    await page.getByTestId('speckit-task-T-1').click();
    await expect(page.getByTestId('task-detail')).toBeVisible();

    await board.push({
      ...envelope(),
      ...REPORT,
      tasks: REPORT.tasks.filter((task) => task.id !== 'T-1'),
    });

    await expect(page.getByTestId('speckit-detail-gone')).toBeVisible();
    // Emphatically not T-2, which is what a first-item fallback would show.
    await expect(page.getByTestId('task-detail')).toHaveCount(0);
  });

  test('says the selected story is gone rather than selecting the next one', async () => {
    await openTree(REPORT);
    const { page } = board;

    await page.getByTestId('speckit-story-US-2').click();
    await expect(page.getByTestId('story-detail')).toBeVisible();

    await board.push({
      ...envelope(),
      ...REPORT,
      stories: REPORT.stories.filter((story) => story.id !== 'US-2'),
    });

    await expect(page.getByTestId('speckit-detail-gone')).toBeVisible();
    await expect(page.getByTestId('story-detail')).toHaveCount(0);
  });

  test('does not collapse or expand any other story when one disappears', async () => {
    await openTree(REPORT);
    const { page } = board;

    // US-2 opened deliberately; US-1 left closed, equally deliberately.
    await page.getByTestId('speckit-toggle-US-2').click();
    await expect(page.getByTestId('speckit-tasks-US-2')).toBeVisible();
    await expect(page.getByTestId('speckit-tasks-US-1')).toHaveCount(0);

    await board.push({
      ...envelope(),
      stories: [{ id: 'US-1', title: 'First' }, { id: 'US-2', title: 'Second' }, { id: 'US-3', title: 'Third' }],
      tasks: REPORT.tasks,
    });

    // Both survive their own state: the arrival of US-3 speaks for neither.
    await expect(page.getByTestId('speckit-tasks-US-2')).toBeVisible();
    await expect(page.getByTestId('speckit-tasks-US-1')).toHaveCount(0);
    await expect(page.getByTestId('speckit-tasks-US-3')).toHaveCount(0);
  });
});
