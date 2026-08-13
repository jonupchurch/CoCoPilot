import { expect, test } from '@playwright/test';

import { envelope, keepOldViews, launchBoard, type Board } from './board.js';

/**
 * The Stories tab: which stories exist, and one of them in full.
 *
 * Everything here is a read of reported content. The two things that are *not*
 * reported — the task summary and the current-story marker — are derived from
 * the report and declared in `only-reported.spec.ts`, which is where the line
 * between "summarising what was sent" and "inventing content" is held.
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
    {
      id: 'US-002',
      title: 'Share one session fetch across routes',
      priority: 'P1',
      status: 'active',
      asA: 'developer',
      want: 'one hook that fetches the session',
      soThat: 'three route components stop doing it themselves',
      criteria: ['The hook is used by every route.', 'Error handling is unchanged.'],
      files: ['src/hooks/useSession.ts', 'src/routes/index.tsx'],
    },
    {
      id: 'US-004',
      title: 'Read the prompt history without leaving the panel',
      priority: 'P2',
      status: 'todo',
    },
  ],
  tasks: [
    { id: 'T-011', title: 'Audit the three call sites', status: 'done', storyId: 'US-002' },
    { id: 'T-013', title: 'Implement useSession', status: 'active', storyId: 'US-002' },
    { id: 'T-031', title: 'Expandable history rows', status: 'todo', storyId: 'US-004' },
  ],
  focus: { task: 'T-013', chip: 'watching' },
};

/** Land on the Stories tab, which requires at least one reported story. */
async function openStories(payload: Record<string, unknown> = REPORT): Promise<void> {
  // Since feature 011 this destination leaves when the Spec-Kit tree arrives,
  // unless the developer had already opened one of the two. This spec is about
  // what the story view shows, not about whether it is offered, so it takes the
  // path of a developer who was already there.
  await keepOldViews(board);
  await board.push({ ...envelope(), ...payload });
  await board.page.getByTestId('tab-stories').click();
  await expect(board.page.getByTestId('stories')).toBeVisible();
}

test.describe('the story list', () => {
  test('lists every story with identifier, title, priority and status', async () => {
    await openStories();

    const { page } = board;
    await expect(page.locator('.storylist__id')).toHaveText(['US-002', 'US-004']);
    await expect(page.locator('.storylist__title')).toHaveText([
      'Share one session fetch across routes',
      'Read the prompt history without leaving the panel',
    ]);
    await expect(page.locator('.storylist__priority')).toHaveText(['P1', 'P2']);
    await expect(page.locator('.storylist__row .status')).toHaveText(['active', 'todo']);
  });

  test('keeps the reported order rather than sorting by identifier', async () => {
    await openStories({
      ...REPORT,
      stories: [
        { id: 'US-009', title: 'Ninth' },
        { id: 'US-001', title: 'First' },
        { id: 'US-005', title: 'Fifth' },
      ],
      tasks: [],
    });

    // Which no sort by id would produce, and which the board must not improve.
    await expect(board.page.locator('.storylist__id')).toHaveText([
      'US-009',
      'US-001',
      'US-005',
    ]);
  });

  test('marks the story that owns the current task', async () => {
    await openStories();

    await expect(board.page.getByTestId('story-current-US-002')).toBeVisible();
    await expect(board.page.getByTestId('story-current-US-004')).toHaveCount(0);
  });

  test('summarises each story by how many of its tasks are done', async () => {
    await openStories();

    await expect(board.page.locator('.storylist__tasks')).toHaveText(['1/2', '0/1']);
  });
});

test.describe('selecting a story', () => {
  test('shows the first one before anything is clicked', async () => {
    await openStories();

    await expect(board.page.getByTestId('story-detail-id')).toHaveText('US-002');
    await expect(board.page.getByTestId('story-row-US-002')).toHaveAttribute(
      'data-selected',
      'true',
    );
  });

  test('shows the chosen one and marks it in the list', async () => {
    await openStories();

    await board.page.getByTestId('story-row-US-004').click();

    await expect(board.page.getByTestId('story-detail-id')).toHaveText('US-004');
    await expect(board.page.getByTestId('story-row-US-004')).toHaveAttribute(
      'data-selected',
      'true',
    );
    await expect(board.page.getByTestId('story-row-US-002')).toHaveAttribute(
      'data-selected',
      'false',
    );
  });

  test('is operable from the keyboard', async () => {
    await openStories();

    await board.page.getByTestId('story-row-US-004').focus();
    await board.page.keyboard.press('Enter');

    await expect(board.page.getByTestId('story-detail-id')).toHaveText('US-004');
  });
});

test.describe('a story in full', () => {
  test('shows the narrative, criteria, tasks and files as reported', async () => {
    await openStories();

    const { page } = board;
    await expect(page.getByTestId('story-detail-title')).toHaveText(
      'Share one session fetch across routes',
    );
    await expect(page.getByTestId('story-narrative')).toContainText('As a developer');
    await expect(page.getByTestId('story-narrative')).toContainText(
      'I want one hook that fetches the session',
    );
    await expect(page.getByTestId('story-narrative')).toContainText(
      'so that three route components stop doing it themselves',
    );
    await expect(page.locator('.storydetail__criterion-text')).toHaveText([
      'The hook is used by every route.',
      'Error handling is unchanged.',
    ]);
    await expect(page.locator('.storydetail__task-id')).toHaveText(['T-011', 'T-013']);
    await expect(page.locator('.storydetail__file')).toHaveText([
      'src/hooks/useSession.ts',
      'src/routes/index.tsx',
    ]);
  });

  test('marks the current task with how long ago the report arrived', async () => {
    await openStories();

    await expect(board.page.getByTestId('story-task-T-013')).toHaveAttribute(
      'data-current',
      'true',
    );
    await expect(board.page.getByTestId('story-task-age-T-013')).toHaveText(/^(now|\d+[smhd])$/u);
    await expect(board.page.getByTestId('story-task-age-T-011')).toHaveCount(0);
  });

  test('labels the spec path as the feature s, since a story has none', async () => {
    // The export draws `story.spec` in this header. The contract has no such
    // field — only `ReportedFeature` carries one — so showing it unlabelled
    // would assert a per-story path nobody reported.
    await openStories();

    const path = board.page.getByTestId('story-detail-spec');
    await expect(path).toHaveText('specs/002/spec.md');
    await expect(path).toHaveAttribute('title', 'Feature spec: specs/002/spec.md');
  });

  test('omits every block whose field was not reported', async () => {
    // FR-017: emptiness stated rather than drawn. An "Acceptance criteria"
    // heading over nothing is the drawn kind.
    await openStories();
    await board.page.getByTestId('story-row-US-004').click();

    const { page } = board;
    await expect(page.getByTestId('story-narrative')).toHaveCount(0);
    await expect(page.locator('.storydetail__criterion')).toHaveCount(0);
    await expect(page.locator('.storydetail__file')).toHaveCount(0);
    await expect(page.getByTestId('story-detail-title')).toBeVisible();
    // The headings went with them.
    await expect(page.locator('.storydetail__heading')).toHaveText(['Tasks']);
  });

  test('says so when a story has no tasks at all', async () => {
    await openStories({
      ...REPORT,
      stories: [{ id: 'US-007', title: 'Nothing planned yet' }],
      tasks: [],
    });

    await expect(board.page.getByTestId('story-no-tasks')).toBeVisible();
  });
});

test.describe('tasks belonging to no reported story', () => {
  test('are reachable through their own scope', async () => {
    // FR-018. Nothing validates that an agent reports a consistent graph, and a
    // task that vanished because its parent was missing would be invisible.
    await openStories({
      ...REPORT,
      tasks: [
        ...REPORT.tasks,
        { id: 'T-099', title: 'Belongs to nothing', status: 'todo' },
        { id: 'T-098', title: 'Names a story nobody sent', status: 'todo', storyId: 'US-404' },
      ],
    });

    const { page } = board;
    // Last, after every reported story.
    await expect(page.locator('.storylist__id').last()).toHaveText('—');

    await page.locator('.storylist__row').last().click();
    await expect(page.locator('.storydetail__task-id')).toHaveText(['T-099', 'T-098']);
  });

  test('do not appear when every task has a home', async () => {
    await openStories();

    await expect(board.page.locator('.storylist__row')).toHaveCount(2);
    await expect(board.page.locator('.storylist__id')).not.toContainText(['—']);
  });
});

test.describe('at the contract s ceiling and past the panel s edge', () => {
  test('stays navigable at 200 stories and 500 tasks', async () => {
    // SC-007, at exactly the caps the contract allows. The interesting part is
    // not that it renders — it is that selecting the *last* story still answers,
    // because that is the one a virtualising or truncating list would lose.
    const stories = Array.from({ length: 200 }, (_, i) => ({
      id: `US-${String(i).padStart(3, '0')}`,
      title: `Story number ${i}`,
    }));
    const tasks = Array.from({ length: 500 }, (_, i) => ({
      id: `T-${String(i).padStart(3, '0')}`,
      title: `Task number ${i}`,
      status: i % 3 === 0 ? 'done' : 'todo',
      storyId: `US-${String(i % 200).padStart(3, '0')}`,
    }));

    await openStories({ ...REPORT, stories, tasks });

    const { page } = board;
    await expect(page.locator('.storylist__row')).toHaveCount(200);

    const last = page.getByTestId('story-row-US-199');
    await last.scrollIntoViewIfNeeded();
    await last.click();
    await expect(page.getByTestId('story-detail-id')).toHaveText('US-199');
    await expect(page.locator('.storydetail__task-id')).toHaveText(['T-199', 'T-399']);
  });

  test('truncates long values and keeps every one of them retrievable', async () => {
    const title = 'S'.repeat(200);
    const criterion = `The hook ${'really '.repeat(200)}works.`;
    const path = `src/${'deeply/'.repeat(60)}client.ts`;

    await board.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(380, 320);
    });
    await openStories({
      ...REPORT,
      stories: [{ id: 'US-002', title, criteria: [criterion], files: [path] }],
      tasks: [],
    });

    const { page } = board;
    // FR-009 satisfied rather than asserted: the whole value is on `title`.
    // The picker rather than the list, because at the panel's minimum width
    // this tab is in its narrow arrangement and there is no list — asserting on
    // `.storylist__title` here would mean the test had quietly widened itself.
    await expect(page.locator('.scopepicker__title')).toHaveAttribute('title', title);
    await expect(page.locator('.storydetail__file')).toHaveAttribute('title', path);
    // A criterion is prose and wraps rather than truncating, so the test is
    // that all of it is there, not that it fits.
    await expect(page.locator('.storydetail__criterion-text')).toHaveText(criterion);

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

  test('renders markup in every story field as visible characters', async () => {
    // SC-009. Every field here was composed by an AI agent, which is the whole
    // reason this window has `contextIsolation` and no `innerHTML` anywhere.
    const hostile = '<script>window.__pwned = true</script><img src=x onerror="window.__pwned=1">';

    await openStories({
      ...REPORT,
      stories: [
        {
          id: hostile,
          title: hostile,
          priority: hostile,
          status: hostile,
          asA: hostile,
          want: hostile,
          soThat: hostile,
          criteria: [hostile],
          files: [hostile],
        },
      ],
      tasks: [],
    });

    const { page } = board;
    await expect(page.getByTestId('story-detail-title')).toContainText('<script>');
    await expect(page.getByTestId('story-narrative')).toContainText('<script>');
    await expect(page.locator('.storydetail__criterion-text')).toContainText('<script>');
    expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined();
    await expect(page.locator('img')).toHaveCount(0);
  });
});

test.describe('an arriving report does not move the developer', () => {
  test('keeps the selected story when it is still there', async () => {
    await openStories();
    await board.page.getByTestId('story-row-US-004').click();
    await expect(board.page.getByTestId('story-detail-id')).toHaveText('US-004');

    // A new snapshot with the same stories and a different chip, so the report
    // definitely landed.
    await board.push({ ...envelope(), ...REPORT, focus: { task: 'T-013', chip: 'needs-you' } });
    await expect(board.page.locator('.chip')).toHaveAttribute('data-chip', 'needs-you');

    await expect(board.page.getByTestId('story-detail-id')).toHaveText('US-004');
  });

  test('falls back to a valid story when the selected one is dropped', async () => {
    // Reports replace wholesale, so this is ordinary rather than an edge case.
    // A view rendering nothing here would read as a crash.
    await openStories();
    await board.page.getByTestId('story-row-US-004').click();

    await board.push({
      ...envelope(),
      ...REPORT,
      stories: REPORT.stories.filter((story) => story.id !== 'US-004'),
    });

    await expect(board.page.getByTestId('story-detail-id')).toHaveText('US-002');
    await expect(board.page.getByTestId('stories')).toBeVisible();
  });

  test('does not move the developer off the tab', async () => {
    await openStories();

    await board.push({ ...envelope(), ...REPORT, focus: { task: 'T-011', chip: 'thinking' } });

    await expect(board.page.getByTestId('body')).toHaveAttribute('data-tab', 'stories');
  });

  test('leaves the list scrolled where it was', async () => {
    // The quickstart claims this and nothing was checking it. It holds because
    // reconciliation is derivation rather than synchronisation — the list is
    // the same DOM element before and after, so the browser keeps its scroll —
    // and it would stop holding the moment someone remounted on report.
    const stories = Array.from({ length: 60 }, (_, i) => ({
      id: `US-${String(i).padStart(3, '0')}`,
      title: `Story number ${i}`,
    }));
    await openStories({ ...REPORT, stories, tasks: [] });

    const { page } = board;
    const list = page.getByTestId('story-list');
    await list.evaluate((el) => {
      el.scrollTop = 400;
    });
    const before = await list.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(0);

    await board.push({
      ...envelope(),
      ...REPORT,
      stories,
      tasks: [],
      focus: { task: 'T-011', chip: 'needs-you' },
    });
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'needs-you');

    expect(await list.evaluate((el) => el.scrollTop)).toBe(before);
  });
});
