import { expect, test } from '@playwright/test';

import { envelope, keepOldViews, launchBoard, type Board } from './board.js';

/**
 * The Tasks tab: which story's tasks, which task, and that task in full.
 *
 * The scope picker is the piece worth watching here. It is present at every
 * width — unlike the Stories tab's, which is a narrow-layout substitute — and
 * changing it has to move both the list and the detail, because a list showing
 * one story's tasks beside a detail showing another's would be worse than
 * either alone.
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

const REPORT = {
  feature: { id: 'F-01', title: 'Session handling', specPath: 'specs/002/spec.md' },
  stories: [
    { id: 'US-002', title: 'Share one session fetch across routes', priority: 'P1' },
    { id: 'US-004', title: 'Read the prompt history without leaving the panel' },
  ],
  tasks: [
    {
      id: 'T-011',
      title: 'Audit the three call sites',
      status: 'done',
      storyId: 'US-002',
      detail: 'Each route mounts the fetch itself; the third also retries.',
      checks: ['Every call site is listed.', 'The retry is described.'],
      files: ['src/routes/index.tsx', 'src/routes/detail.tsx'],
    },
    { id: 'T-013', title: 'Implement useSession', status: 'active', storyId: 'US-002' },
    { id: 'T-031', title: 'Expandable history rows', status: 'todo', storyId: 'US-004' },
  ],
  focus: { task: 'T-013', chip: 'watching', note: 'Writing the hook, then the three call sites.' },
};

async function openTasks(payload: Record<string, unknown> = REPORT): Promise<void> {
  // Since feature 011 this destination leaves when the Spec-Kit tree arrives,
  // unless the developer had already opened one of the two. This spec is about
  // what the task view shows, not about whether it is offered, so it takes the
  // path of a developer who was already there.
  await keepOldViews(board);
  await board.push({ ...envelope(), ...payload });
  await board.page.getByTestId('tab-tasks').click();
  await expect(board.page.getByTestId('tasks')).toBeVisible();
}

/** Open the picker and choose a scope by the name `scopeKey` gives it. */
async function chooseScope(key: string): Promise<void> {
  await board.page.getByTestId('scope-picker').click();
  await board.page.getByTestId(`scope-picker-option-${key}`).click();
}

test.describe('the scoped story', () => {
  test('lists that story s tasks and no others', async () => {
    await openTasks();

    await expect(board.page.locator('.tasklist__id')).toHaveText(['T-011', 'T-013']);
    await expect(board.page.getByTestId('task-count')).toHaveText('2');
  });

  test('is chosen from a picker that is there at every width', async () => {
    // Not a narrow-layout fallback: without it there is no way to reach the
    // other stories' tasks at all.
    await openTasks();

    await expect(board.page.getByTestId('scope-picker')).toBeVisible();
    await expect(board.page.getByTestId('scope-picker')).toContainText('US-002');
  });

  test('moves the list and the detail together when it changes', async () => {
    await openTasks();
    await chooseScope('US-004');

    await expect(board.page.locator('.tasklist__id')).toHaveText(['T-031']);
    await expect(board.page.getByTestId('task-detail-id')).toHaveText('T-031');
    await expect(board.page.getByTestId('task-detail-from')).toHaveText(
      'US-004 · Read the prompt history without leaving the panel',
    );
  });

  test('says so when the story has no tasks', async () => {
    // US2 scenario 5. A story can be reported with none, and an empty column
    // beside an empty detail reads as a failure to load.
    await openTasks({
      ...REPORT,
      stories: [...REPORT.stories, { id: 'US-009', title: 'Nothing planned yet' }],
    });
    await chooseScope('US-009');

    await expect(board.page.getByTestId('task-list-empty')).toBeVisible();
    await expect(board.page.getByTestId('task-detail-empty')).toBeVisible();
  });
});

test.describe('one task in full', () => {
  test('shows the first of the scope before anything is clicked', async () => {
    await openTasks();

    await expect(board.page.getByTestId('task-detail-id')).toHaveText('T-011');
    await expect(board.page.getByTestId('task-row-T-011')).toHaveAttribute('data-selected', 'true');
  });

  test('shows detail, checks and files exactly as reported', async () => {
    await openTasks();

    const { page } = board;
    await expect(page.getByTestId('task-detail-title')).toHaveText('Audit the three call sites');
    await expect(page.getByTestId('task-detail-detail')).toHaveText(
      'Each route mounts the fetch itself; the third also retries.',
    );
    await expect(page.locator('.taskdetail__check-text')).toHaveText([
      'Every call site is listed.',
      'The retry is described.',
    ]);
    await expect(page.locator('.taskdetail__file')).toHaveText([
      'src/routes/index.tsx',
      'src/routes/detail.tsx',
    ]);
    await expect(page.getByTestId('task-detail-from')).toHaveText(
      'US-002 · Share one session fetch across routes',
    );
  });

  test('omits the blocks whose fields were not reported', async () => {
    // FR-017 again: a "Checks" heading over nothing is emptiness drawn.
    await openTasks();
    await board.page.getByTestId('task-row-T-013').click();

    const { page } = board;
    await expect(page.getByTestId('task-detail-detail')).toHaveCount(0);
    await expect(page.locator('.taskdetail__check')).toHaveCount(0);
    await expect(page.locator('.taskdetail__file')).toHaveCount(0);
    // Only the block that is always there.
    await expect(page.locator('.taskdetail__heading')).toHaveText(['From the story']);
  });

  test('is operable from the keyboard', async () => {
    await openTasks();

    await board.page.getByTestId('task-row-T-013').focus();
    await board.page.keyboard.press('Enter');

    await expect(board.page.getByTestId('task-detail-id')).toHaveText('T-013');
  });
});

test.describe('the task the agent said it was on', () => {
  test('is marked in the list with the report s age', async () => {
    await openTasks();

    const { page } = board;
    await expect(page.getByTestId('task-row-T-013')).toHaveAttribute('data-current', 'true');
    await expect(page.getByTestId('task-age-T-013')).toHaveText(/^(now|\d+[smhd])$/u);
    await expect(page.getByTestId('task-age-T-011')).toHaveCount(0);
  });

  test('carries the age in its detail, said outright to be the report s', async () => {
    // The export draws a per-task `updated`. No per-task timestamp exists, so
    // this is the report's age and the `title` says so rather than letting a
    // bare `4m` beside a task be read as the task's own.
    await openTasks();
    await board.page.getByTestId('task-row-T-013').click();

    const age = board.page.getByTestId('task-detail-age');
    await expect(age).toHaveText(/^(now|\d+[smhd])$/u);
    await expect(age).toHaveAttribute('title', /^The agent last reported /u);
  });

  test("shows the agent's note against that task and no other", async () => {
    // `focus.note` is reported against the session. Under any other task it
    // would be attributing the agent's words to work it did not describe.
    await openTasks();
    await board.page.getByTestId('task-row-T-013').click();
    await expect(board.page.getByTestId('task-detail-focus')).toHaveText(
      'Writing the hook, then the three call sites.',
    );

    await board.page.getByTestId('task-row-T-011').click();
    await expect(board.page.getByTestId('task-detail-focus')).toHaveCount(0);
  });
});

test.describe('a task belonging to no reported story', () => {
  test('is reachable, and is not listed under a story it does not belong to', async () => {
    // FR-018. Nothing validates that an agent reports a consistent graph, and a
    // task that vanished because its parent was missing would be invisible.
    await openTasks({
      ...REPORT,
      tasks: [
        ...REPORT.tasks,
        { id: 'T-099', title: 'Belongs to nothing', status: 'todo' },
        { id: 'T-098', title: 'Names a story nobody sent', status: 'todo', storyId: 'US-404' },
      ],
    });

    // Not under the story that happens to be scoped first.
    await expect(board.page.locator('.tasklist__id')).toHaveText(['T-011', 'T-013']);

    await chooseScope('unassigned');
    await expect(board.page.locator('.tasklist__id')).toHaveText(['T-099', 'T-098']);

    await expect(board.page.getByTestId('task-detail-id')).toHaveText('T-099');
    await expect(board.page.getByTestId('task-detail-from')).toHaveText(
      'Reported with no story, or with one that was not reported.',
    );
  });

  test('does not offer the scope when every task has a home', async () => {
    await openTasks();
    await board.page.getByTestId('scope-picker').click();

    await expect(board.page.getByTestId('scope-picker-option-unassigned')).toHaveCount(0);
    await expect(board.page.locator('.scopepicker__option')).toHaveCount(2);
  });
});

test.describe('at the contract s ceiling and past the panel s edge', () => {
  test('stays navigable when one story holds all 500 tasks', async () => {
    // SC-007, and the worst arrangement of it: every task in a single scope, so
    // the list is as long as the contract permits and the last row is the one
    // a truncating list would lose.
    const tasks = Array.from({ length: 500 }, (_, i) => ({
      id: `T-${String(i).padStart(3, '0')}`,
      title: `Task number ${i}`,
      status: i % 3 === 0 ? 'done' : 'todo',
      storyId: 'US-002',
    }));

    await openTasks({ ...REPORT, tasks });

    const { page } = board;
    await expect(page.locator('.tasklist__row')).toHaveCount(500);

    const last = page.getByTestId('task-row-T-499');
    await last.scrollIntoViewIfNeeded();
    await last.click();
    await expect(page.getByTestId('task-detail-id')).toHaveText('T-499');
    await expect(page.getByTestId('task-detail-title')).toHaveText('Task number 499');
  });

  test('truncates long values and keeps every one of them retrievable', async () => {
    const id = 'T-'.padEnd(200, 'I');
    const title = 'T'.repeat(200);
    const status = 'S'.repeat(200);
    const check = `It ${'really '.repeat(200)}passes.`;
    const path = `src/${'deeply/'.repeat(60)}client.ts`;

    await board.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(380, 320);
    });
    await openTasks({
      ...REPORT,
      stories: [{ id: 'US-002', title: 'One story' }],
      tasks: [{ id, title, status, storyId: 'US-002', checks: [check], files: [path] }],
      focus: { task: id, chip: 'watching' },
    });

    const { page } = board;
    await expect(page.locator('.tasklist__id')).toHaveAttribute('title', id);
    await expect(page.locator('.tasklist__title')).toHaveAttribute('title', title);
    await expect(page.locator('.tasklist__row .status')).toHaveAttribute('title', status);
    await expect(page.locator('.taskdetail__file')).toHaveAttribute('title', path);
    // Prose wraps rather than truncating, so the assertion is that all of it is
    // present, not that it fits.
    await expect(page.locator('.taskdetail__check-text')).toHaveText(check);

    const overflow = await page.evaluate(() => {
      const el = document.querySelector('.app__body');
      return {
        body: document.body.scrollWidth - document.body.clientWidth,
        panel: el === null ? 0 : el.scrollWidth - el.clientWidth,
      };
    });
    expect(overflow.body).toBeLessThanOrEqual(0);
    expect(overflow.panel).toBeLessThanOrEqual(0);
  });

  test('renders markup in every task field as visible characters', async () => {
    const hostile = '<script>window.__pwned = true</script><img src=x onerror="window.__pwned=1">';

    await openTasks({
      ...REPORT,
      stories: [{ id: 'US-002', title: hostile }],
      tasks: [
        {
          id: 'T-011',
          title: hostile,
          status: hostile,
          storyId: 'US-002',
          detail: hostile,
          checks: [hostile],
          files: [hostile],
        },
      ],
      focus: { task: 'T-011', note: hostile, chip: 'watching' },
    });

    const { page } = board;
    await expect(page.getByTestId('task-detail-title')).toContainText('<script>');
    await expect(page.getByTestId('task-detail-detail')).toContainText('<script>');
    await expect(page.getByTestId('task-detail-focus')).toContainText('<script>');
    await expect(page.locator('.taskdetail__check-text')).toContainText('<script>');
    // Including the "From the story" line, which the board composes itself out
    // of two agent-supplied values.
    await expect(page.getByTestId('task-detail-from')).toContainText('<script>');
    expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined();
    await expect(page.locator('img')).toHaveCount(0);
  });
});

test.describe('an arriving report does not move the developer', () => {
  test('keeps the selected task when it is still there', async () => {
    await openTasks();
    await board.page.getByTestId('task-row-T-013').click();

    await board.push({ ...envelope(), ...REPORT, focus: { task: 'T-011', chip: 'needs-you' } });
    await expect(board.page.locator('.chip')).toHaveAttribute('data-chip', 'needs-you');

    await expect(board.page.getByTestId('task-detail-id')).toHaveText('T-013');
  });

  test('falls back to the first of the scope when the selected task is dropped', async () => {
    await openTasks();
    await board.page.getByTestId('task-row-T-013').click();

    await board.push({
      ...envelope(),
      ...REPORT,
      tasks: REPORT.tasks.filter((task) => task.id !== 'T-013'),
    });

    await expect(board.page.getByTestId('task-detail-id')).toHaveText('T-011');
    await expect(board.page.getByTestId('tasks')).toBeVisible();
  });

  test('falls back with the story when the scoped one disappears', async () => {
    await openTasks();
    await chooseScope('US-004');
    await expect(board.page.getByTestId('task-detail-id')).toHaveText('T-031');

    await board.push({
      ...envelope(),
      ...REPORT,
      stories: REPORT.stories.filter((story) => story.id !== 'US-004'),
      tasks: REPORT.tasks.filter((task) => task.storyId !== 'US-004'),
    });

    await expect(board.page.getByTestId('scope-picker')).toContainText('US-002');
    await expect(board.page.getByTestId('task-detail-id')).toHaveText('T-011');
  });

  test('does not move the developer off the tab', async () => {
    await openTasks();

    await board.push({ ...envelope(), ...REPORT, focus: { task: 'T-011', chip: 'thinking' } });

    await expect(board.page.getByTestId('body')).toHaveAttribute('data-tab', 'tasks');
  });
});
