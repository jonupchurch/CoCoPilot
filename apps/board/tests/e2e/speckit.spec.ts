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

test.describe('the detail pane', () => {
  const FULL = {
    feature: { id: 'F-01', title: 'Session handling', specPath: 'specs/002/spec.md' },
    stories: [
      {
        id: 'US-002',
        title: 'Share one session fetch across routes',
        priority: 'P1',
        status: 'active',
        asA: 'developer',
        want: 'one hook that fetches the session',
        soThat: 'three route components stop doing it themselves',
        criteria: ['The hook is used by every route.', 'Error handling is unchanged.'],
      },
      { id: 'US-004', title: 'Bare as reported' },
    ],
    tasks: [
      {
        id: 'T-011',
        title: 'Audit the three call sites',
        status: 'done',
        storyId: 'US-002',
        detail: 'Three components fetch the session independently.',
        checks: ['Every call site listed', 'No behaviour changed'],
        files: ['src/hooks/useSession.ts'],
      },
      { id: 'T-013', title: 'Bare task', status: 'todo', storyId: 'US-004' },
    ],
  };

  test('says nothing is selected rather than drawing an empty pane', async () => {
    await openTree(FULL);

    await expect(board.page.getByTestId('speckit-detail-none')).toBeVisible();
  });

  test('shows a selected story in full, and says it is a story', async () => {
    await openTree(FULL);
    const { page } = board;

    await page.getByTestId('speckit-story-US-002').click();

    await expect(page.getByTestId('speckit-detail-kind')).toHaveText('Story');
    await expect(page.getByTestId('story-detail')).toContainText('one hook that fetches the session');
    await expect(page.getByTestId('story-detail')).toContainText('Error handling is unchanged.');
  });

  test('shows a selected task in full, and says it is a task', async () => {
    await openTree(FULL);
    const { page } = board;

    // Nothing is reported as current here, so every story starts collapsed.
    await page.getByTestId('speckit-toggle-US-002').click();
    await page.getByTestId('speckit-task-T-011').click();

    await expect(page.getByTestId('speckit-detail-kind')).toHaveText('Task');
    await expect(page.getByTestId('task-detail')).toContainText(
      'Three components fetch the session independently.',
    );
    await expect(page.getByTestId('task-detail')).toContainText('Every call site listed');
  });

  test('omits what was not reported rather than showing it blank or unknown', async () => {
    await openTree(FULL);
    const { page } = board;

    await page.getByTestId('speckit-story-US-004').click();
    const detail = page.getByTestId('story-detail');

    await expect(detail).toContainText('Bare as reported');
    // No invented values and no empty headings for fields the agent never sent.
    await expect(detail).not.toContainText('unknown');
    await expect(detail).not.toContainText('Acceptance criteria');
    await expect(detail).not.toContainText('As a');
  });

  test('keeps showing a selected task after its story is collapsed', async () => {
    await openTree(FULL);
    const { page } = board;

    await page.getByTestId('speckit-toggle-US-002').click();
    await page.getByTestId('speckit-task-T-011').click();
    await expect(page.getByTestId('speckit-detail-kind')).toHaveText('Task');

    await page.getByTestId('speckit-toggle-US-002').click();

    // The row is hidden; what is being read is not.
    await expect(page.getByTestId('speckit-task-T-011')).toHaveCount(0);
    await expect(page.getByTestId('task-detail')).toContainText(
      'Three components fetch the session independently.',
    );
  });

  test('says a selection has gone rather than landing on something else', async () => {
    await openTree(FULL);
    const { page } = board;

    await page.getByTestId('speckit-toggle-US-002').click();
    await page.getByTestId('speckit-task-T-011').click();
    await expect(page.getByTestId('task-detail')).toBeVisible();

    // A report that no longer contains it. The pane must say so — not quietly
    // show the next task, which is what the Tasks view's fallback would do.
    await board.push({
      ...envelope(),
      stories: [{ id: 'US-002', title: 'Share one session fetch across routes' }],
      tasks: [{ id: 'T-099', title: 'Something else entirely', status: 'todo', storyId: 'US-002' }],
    });

    await expect(page.getByTestId('speckit-detail-gone')).toBeVisible();
    await expect(page.getByTestId('task-detail')).toHaveCount(0);
  });
});

test.describe('reported text is inert everywhere the tree draws it', () => {
  const HOSTILE = '<script>window.__ran = 1;</script><img src=x onerror="window.__ran = 1">';
  const ADF = '{"type":"doc","content":[{"type":"paragraph"}]}';

  test('shows markup as characters in every field, running none of it', async () => {
    await openTree({
      stories: [
        {
          id: `US-1 ${HOSTILE}`,
          title: `A story ${HOSTILE}`,
          asA: `developer ${HOSTILE}`,
          want: `something ${ADF}`,
          soThat: `it works ${HOSTILE}`,
          criteria: [`A criterion ${HOSTILE}`],
        },
      ],
      tasks: [
        {
          id: 'T-1',
          title: `A task ${HOSTILE}`,
          status: 'todo',
          storyId: `US-1 ${HOSTILE}`,
          detail: `Detail ${ADF}`,
          checks: [`A check ${HOSTILE}`],
        },
      ],
    });
    const { page } = board;

    // Nothing was created and nothing ran, before or after the pane is opened.
    const ran = async (): Promise<unknown> =>
      page.evaluate(() => (window as unknown as { __ran?: unknown }).__ran);
    const injected = async (): Promise<number> =>
      page.locator('.speckit script, .speckit img').count();

    expect(await ran()).toBeUndefined();
    expect(await injected()).toBe(0);

    // The characters are on screen, which is the other half of the claim.
    await expect(page.locator('.speckit__tree')).toContainText('<script>');

    await page.locator('.storynode__main').first().click();
    await page.locator('.storynode__toggle').first().click();
    await page.locator('.tasknode').first().click();

    await expect(page.getByTestId('speckit-detail')).toContainText('<script>');
    await expect(page.getByTestId('speckit-detail')).toContainText(ADF);
    expect(await ran()).toBeUndefined();
    expect(await injected()).toBe(0);
  });
});

test.describe('scale', () => {
  test('stays scrollable and legible with 50 stories and 500 tasks', async () => {
    const stories = Array.from({ length: 50 }, (_, i) => ({
      id: `US-${String(i).padStart(3, '0')}`,
      title: `Story number ${i}`,
    }));
    const tasks = stories.flatMap((story, i) =>
      Array.from({ length: 10 }, (_, j) => ({
        id: `T-${i}-${j}`,
        title: `Task ${j} of ${story.id}`,
        status: 'todo',
        storyId: story.id,
      })),
    );

    await openTree({ stories, tasks });
    const { page } = board;

    await board.app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.setContentSize(380, 700);
    });
    await page.waitForFunction(() => window.innerWidth <= 400, undefined, { timeout: 5_000 });

    // Every story is a row, and the collapsed tree is 50 rows rather than 550 —
    // which is what makes expansion worth having.
    await expect(page.locator('.storynode')).toHaveCount(50);
    await expect(page.locator('.tasknode')).toHaveCount(0);

    // The last one is reachable by scrolling rather than only by expanding.
    const last = page.getByTestId('speckit-story-US-049');
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeVisible();

    await page.getByTestId('speckit-toggle-US-049').click();
    await expect(page.getByTestId('speckit-tasks-US-049').locator('.tasknode')).toHaveCount(10);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('counted progress', () => {
  test('counts a story that reported no status of its own', async () => {
    await openTree({
      stories: [{ id: 'US-1', title: 'No status reported' }],
      tasks: [
        { id: 'T-1', title: 'One', status: 'done', storyId: 'US-1' },
        { id: 'T-2', title: 'Two', status: 'todo', storyId: 'US-1' },
        { id: 'T-3', title: 'Three', status: 'active', storyId: 'US-1' },
      ],
    });

    await expect(board.page.getByTestId('speckit-progress-US-1')).toHaveText('1 of 3 done');
  });

  test('reads as arithmetic, not as a status', async () => {
    await openTree({
      stories: [{ id: 'US-1', title: 'No status reported' }],
      tasks: [{ id: 'T-1', title: 'One', status: 'done', storyId: 'US-1' }],
    });
    const row = board.page.getByTestId('speckit-story-US-1');

    // FR-026: distinguishable from a reported status by inspection alone. A
    // status carries the `.status` treatment; a count carries none.
    await expect(row.locator('.status')).toHaveCount(0);
    await expect(row.locator('.storynode__progress')).toBeVisible();
  });

  test('defers to a reported status, showing no count beside it', async () => {
    await openTree({
      stories: [{ id: 'US-1', title: 'Says its own state', status: 'active' }],
      tasks: [
        { id: 'T-1', title: 'One', status: 'done', storyId: 'US-1' },
        { id: 'T-2', title: 'Two', status: 'todo', storyId: 'US-1' },
      ],
    });
    const { page } = board;

    await expect(page.getByTestId('speckit-story-US-1').locator('.status')).toHaveText('active');
    await expect(page.getByTestId('speckit-progress-US-1')).toHaveCount(0);
  });

  test('presents no disagreement between a reported status and its tasks', async () => {
    // The story says done; every task says todo. The board holds both and says
    // nothing about the gap (FR-029) — asserted on the absence, because the
    // failure mode is the board helpfully pointing it out.
    await openTree({
      stories: [{ id: 'US-1', title: 'Claims to be finished', status: 'done' }],
      tasks: [
        { id: 'T-1', title: 'One', status: 'todo', storyId: 'US-1' },
        { id: 'T-2', title: 'Two', status: 'todo', storyId: 'US-1' },
      ],
    });
    const row = board.page.getByTestId('speckit-story-US-1');

    await expect(row.locator('.status')).toHaveText('done');
    await expect(board.page.getByTestId('speckit-progress-US-1')).toHaveCount(0);
    await expect(row).not.toContainText('0 of 2');
  });

  test('states statuses it does not recognise rather than counting them as todo', async () => {
    await openTree({
      stories: [{ id: 'US-1', title: 'Idiosyncratic words' }],
      tasks: [
        { id: 'T-1', title: 'One', status: 'done', storyId: 'US-1' },
        { id: 'T-2', title: 'Two', status: 'donee', storyId: 'US-1' },
        { id: 'T-3', title: 'Three', status: 'WIP-ish', storyId: 'US-1' },
      ],
    });

    await expect(board.page.getByTestId('speckit-progress-US-1')).toHaveText(
      '1 of 3 done · 2 not recognised',
    );
  });

  test('shows neither status nor count for a story with no status and no tasks', async () => {
    await openTree({
      stories: [{ id: 'US-1', title: 'Nothing at all' }],
      tasks: [],
    });
    const row = board.page.getByTestId('speckit-story-US-1');

    await expect(row.locator('.status')).toHaveCount(0);
    await expect(board.page.getByTestId('speckit-progress-US-1')).toHaveCount(0);
  });

  test('gives the unassigned group no count, having no story to have one', async () => {
    await openTree({
      stories: [{ id: 'US-1', title: 'A story' }],
      tasks: [{ id: 'T-2', title: 'Belongs to nothing', status: 'todo' }],
    });

    await expect(board.page.getByTestId('speckit-progress-unassigned')).toHaveCount(0);
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
