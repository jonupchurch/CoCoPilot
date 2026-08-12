import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

/**
 * The Spec-Kit tab: stories at the top level, their tasks beneath.
 *
 * The load-bearing test here is the countable one — every reported task appears
 * exactly once — because it catches most of what placement can get wrong in a
 * single assertion. The cases after it say *where* each task went, and the row
 * that matters most is the disagreement: the Tasks view deliberately draws that
 * task twice, and this one must draw it once.
 */

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
  // Wide enough for the side-by-side arrangement; the breakpoint has its own
  // spec and this one should not depend on the default window size.
  await board.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
});

test.afterEach(async () => {
  await board.close();
});

const REPORT = {
  feature: { id: 'F-01', title: 'Session handling', specPath: 'specs/002/spec.md' },
  stories: [
    { id: 'US-002', title: 'Share one session fetch across routes', priority: 'P1' },
    { id: 'US-004', title: 'Read the prompt history', priority: 'P2' },
  ],
  tasks: [
    { id: 'T-011', title: 'Audit the three call sites', status: 'done', storyId: 'US-002' },
    { id: 'T-013', title: 'Implement useSession', status: 'active', storyId: 'US-002' },
    { id: 'T-031', title: 'Expandable history rows', status: 'todo', storyId: 'US-004' },
  ],
  focus: { task: 'T-013', chip: 'watching' },
};

async function openTree(payload: Record<string, unknown> = REPORT): Promise<void> {
  await board.push({ ...envelope(), ...payload });
  await board.page.getByTestId('tab-speckit').click();
  await expect(board.page.getByTestId('speckit')).toBeVisible();
}

test.describe('the tree', () => {
  test('lists stories in reported order', async () => {
    await openTree();

    await expect(board.page.locator('.storynode__id')).toHaveText(['US-002', 'US-004']);
  });

  test('reveals a story’s tasks, in reported order, when it is expanded', async () => {
    await openTree();
    const { page } = board;

    // US-004 is closed by default: the reported current task is in US-002.
    await expect(page.getByTestId('speckit-tasks-US-004')).toHaveCount(0);

    await page.getByTestId('speckit-toggle-US-004').click();

    await expect(page.getByTestId('speckit-task-T-031')).toBeVisible();
    await expect(page.getByTestId('speckit-tasks-US-002').locator('.taskrow__id')).toHaveText([
      'T-011',
      'T-013',
    ]);
  });

  test('opens the story holding the reported current task, and no other', async () => {
    await openTree();
    const { page } = board;

    await expect(page.getByTestId('speckit-tasks-US-002')).toBeVisible();
    await expect(page.getByTestId('speckit-tasks-US-004')).toHaveCount(0);
  });

  test('hides a story’s tasks again when it is collapsed, keeping the story', async () => {
    await openTree();
    const { page } = board;

    await page.getByTestId('speckit-toggle-US-002').click();

    await expect(page.getByTestId('speckit-tasks-US-002')).toHaveCount(0);
    await expect(page.getByTestId('speckit-story-US-002')).toBeVisible();
  });

  test('says a story has no tasks rather than drawing an empty container', async () => {
    await openTree({
      stories: [{ id: 'US-009', title: 'Nothing decomposed yet' }],
      tasks: [],
    });
    const { page } = board;

    await page.getByTestId('speckit-toggle-US-009').click();

    await expect(page.getByTestId('speckit-none-US-009')).toHaveText(
      'No tasks reported for this story.',
    );
  });
});

test.describe('placement — every reported task is drawn exactly once', () => {
  /**
   * One report hitting every branch of `contracts/placement.md` at once, so the
   * count below is meaningful rather than a tautology over a single shape.
   */
  const EVERY_CASE = {
    stories: [
      { id: 'A', title: 'Story A', taskIds: ['agreed', 'claimed-by-b', 'named-by-two'] },
      { id: 'B', title: 'Story B', taskIds: ['named-by-two'] },
      { id: 'C', title: 'Story C' },
    ],
    tasks: [
      { id: 'agreed', title: 'Both agree', status: 'done', storyId: 'A' },
      { id: 'claimed-by-b', title: 'Task says B, story A claims it', status: 'todo', storyId: 'B' },
      { id: 'named-by-two', title: 'Named by A and B', status: 'todo' },
      { id: 'ghost-story', title: 'Names a story never reported', status: 'todo', storyId: 'Z' },
      { id: 'orphan', title: 'Names nothing, named by nobody', status: 'todo' },
    ],
  };

  async function expandAll(): Promise<void> {
    const toggles = board.page.locator('.storynode__toggle');
    for (let i = 0; i < (await toggles.count()); i += 1) {
      const toggle = toggles.nth(i);
      if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
    }
  }

  test('draws as many task rows as were reported, and no duplicates', async () => {
    await openTree(EVERY_CASE);
    await expandAll();

    const rows = board.page.locator('.tasknode');
    await expect(rows).toHaveCount(EVERY_CASE.tasks.length);

    const ids = await board.page.locator('.tasknode .taskrow__id').allTextContents();
    expect(new Set(ids).size).toBe(EVERY_CASE.tasks.length);
  });

  test('prefers the task’s own storyId over a story claiming it', async () => {
    // The row a plausible implementation gets wrong: the Tasks view draws this
    // task under both A and B, deliberately. Here it belongs to B alone.
    await openTree(EVERY_CASE);
    await expandAll();
    const { page } = board;

    await expect(
      page.getByTestId('speckit-tasks-B').getByTestId('speckit-task-claimed-by-b'),
    ).toBeVisible();
    await expect(
      page.getByTestId('speckit-tasks-A').getByTestId('speckit-task-claimed-by-b'),
    ).toHaveCount(0);
  });

  test('places a task named by two stories under the first in reported order', async () => {
    await openTree(EVERY_CASE);
    await expandAll();
    const { page } = board;

    await expect(
      page.getByTestId('speckit-tasks-A').getByTestId('speckit-task-named-by-two'),
    ).toBeVisible();
    await expect(
      page.getByTestId('speckit-tasks-B').getByTestId('speckit-task-named-by-two'),
    ).toHaveCount(0);
  });

  test('invents no story for a task naming one that was never reported', async () => {
    await openTree(EVERY_CASE);
    const { page } = board;

    await expect(page.locator('.storynode__id')).toHaveText(['A', 'B', 'C', '—']);
    await expect(page.getByTestId('speckit-story-Z')).toHaveCount(0);
  });

  test('offers a story with no tasks of its own as an empty one, not an absent one', async () => {
    await openTree(EVERY_CASE);

    await expect(board.page.getByTestId('speckit-story-C')).toBeVisible();
  });
});

test.describe('the unassigned group', () => {
  test('gathers tasks belonging to no reported story, last', async () => {
    await openTree({
      stories: [{ id: 'US-001', title: 'A story' }],
      tasks: [
        { id: 'T-1', title: 'Placed', status: 'todo', storyId: 'US-001' },
        { id: 'T-2', title: 'Belongs to nothing', status: 'todo' },
      ],
    });
    const { page } = board;

    await expect(page.locator('.storynode__id')).toHaveText(['US-001', '—']);
    await expect(page.getByTestId('speckit-story-unassigned')).toContainText(
      'Tasks belonging to no reported story',
    );

    await page.getByTestId('speckit-toggle-unassigned').click();
    await expect(page.getByTestId('speckit-task-T-2')).toBeVisible();
  });

  test('is wholly absent when every task is placed — not an empty heading', async () => {
    await openTree({
      stories: [{ id: 'US-001', title: 'A story' }],
      tasks: [{ id: 'T-1', title: 'Placed', status: 'todo', storyId: 'US-001' }],
    });
    const { page } = board;

    await expect(page.getByTestId('speckit-story-unassigned')).toHaveCount(0);
    await expect(page.locator('.storynode__id')).toHaveText(['US-001']);
  });

  test('carries no status of its own, having no story to have one', async () => {
    await openTree({
      stories: [{ id: 'US-001', title: 'A story', status: 'active' }],
      tasks: [{ id: 'T-2', title: 'Belongs to nothing', status: 'todo' }],
    });
    const { page } = board;

    const unassigned = page.getByTestId('speckit-story-unassigned');
    await expect(unassigned.locator('.status')).toHaveCount(0);
  });
});
