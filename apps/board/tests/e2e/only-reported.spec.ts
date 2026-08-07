import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
});

test.afterEach(async () => {
  await board.close();
});

const PAYLOAD = {
  feature: {
    id: 'US-002',
    title: 'Share one session fetch across routes',
    specPath: 'specs/002-session-hook/spec.md',
  },
  tasks: [
    { id: 'T-011', title: 'Audit the three call sites', status: 'done' },
    { id: 'T-013', title: 'Implement useSession', status: 'active' },
    { id: 'T-014', title: 'Swap the call sites and run tests', status: 'waiting on CI' },
  ],
  plan: [
    { text: 'Read the three call sites', status: 'done' },
    { text: 'Write the hook', status: 'active', detail: 'editing src/hooks/useSession.ts' },
    { text: 'Replace the call sites', status: 'todo' },
  ],
  focus: {
    task: 'T-013',
    note: 'Moving the error handling across unchanged.',
    chip: 'watching',
  },
  changedFiles: [
    { path: 'src/hooks/useSession.ts', change: 'added', added: 48 },
    { path: 'src/routes/index.tsx', change: 'modified', added: 21, removed: 18, note: 'conflict' },
  ],
};

/** Every string the payload above actually contains. */
const REPORTED: string[] = [
  PAYLOAD.feature.id,
  PAYLOAD.feature.title,
  PAYLOAD.feature.specPath,
  ...PAYLOAD.tasks.flatMap((t) => [t.id, t.title, t.status]),
  ...PAYLOAD.plan.flatMap((s) => [s.text, s.status, ...(s.detail === undefined ? [] : [s.detail])]),
  PAYLOAD.focus.task,
  PAYLOAD.focus.note,
  ...PAYLOAD.changedFiles.flatMap((f) => [f.path, f.change, ...(f.note === undefined ? [] : [f.note])]),
];

/**
 * Everything the board is allowed to put on screen that the agent did not send.
 *
 * This list is the whole point of the test below. Adding a derived value to the
 * view — a percentage, a "stale" badge, a count nobody asked for — fails the
 * test until someone writes it down here and has to justify it. FR-016 forbids
 * inferring content; FR-013 requires derived summaries. The line between them is
 * exactly this array.
 */
const DERIVED: readonly RegExp[] = [
  // Uppercase because that is how `innerText` reports a `text-transform` label,
  // and matching the rendered form keeps the pattern from reaching into a
  // lowercase path like `specs/002-session-hook/spec.md`.
  /CHANGED FILES|LAST PROMPT|HISTORY|IN CONTEXT|FOCUS|SPEC|PLAN/g,
  /*
   * Feature 005 put sections above these whose content comes from the transcript
   * rather than from a report. The harness points the board at a home directory
   * with no transcripts in it, so all that appears here is their own "cannot
   * read this" chrome — which is board text, and therefore has to be declared
   * like every other piece of it. Both sections use the same sentence, so one
   * pattern covers them.
   *
   * If a *prompt* ever shows up in this test, that is a real finding: it would
   * mean the fixture home stopped being empty and the suite had started reading
   * someone's actual session.
   */
  /Unavailable — no transcript could be read for this session\.|unavailable/g,
  /[▼▶]/g, // disclosure carets
  /[✓!]/g, // status discs
  /Step \d+ of \d+/g, // plan position
  /\d+ of \d+ done/g, // completion counts
  /[+−]\d+/g, // line-count sums and per-file counts
  /\b\d+[smhd]\b|\bnow\b/g, // elapsed tags, and the focus tag's first band
];

test.describe('the view shows only what was reported', () => {
  test('renders every reported value', async () => {
    const { page } = board;
    await board.push({ ...envelope(), ...PAYLOAD });

    const text = (await page.getByTestId('overview').innerText()).replace(/\s+/gu, ' ');

    for (const value of REPORTED) {
      expect(text, value).toContain(value);
    }
  });

  test('renders nothing that was not reported or declared as derived', async () => {
    const { page } = board;
    await board.push({ ...envelope(), ...PAYLOAD });

    let remaining = (await page.getByTestId('overview').innerText()).replace(/\s+/gu, ' ');

    // Derived first. The other order breaks `1 of 3 done`: `done` is also a
    // reported status, so subtracting reported values first leaves `1 of 3`
    // with nothing left to match it.
    for (const pattern of DERIVED) {
      remaining = remaining.replace(pattern, ' ');
    }
    // Then longest first, so a short value cannot punch a hole in a longer one.
    for (const value of [...REPORTED].sort((a, b) => b.length - a.length)) {
      remaining = remaining.split(value).join(' ');
    }

    // `·` is the board's own separator; whitespace is layout.
    expect(remaining.replace(/[\s·]/gu, '')).toBe('');
  });

  test('does not sort, group or renumber what it was given', async () => {
    const { page } = board;
    await board.push({ ...envelope(), ...PAYLOAD });

    // Reported order is done, active, unrecognised -- which no sort by status
    // would produce, and which the board must not improve upon.
    await expect(page.locator('.taskrow__id')).toHaveText(['T-011', 'T-013', 'T-014']);
    await expect(page.locator('.plan__label')).toHaveText(PAYLOAD.plan.map((s) => s.text));
    await expect(page.locator('.changed__path')).toHaveText(
      PAYLOAD.changedFiles.map((f) => f.path),
    );
  });
});

/**
 * The same subtraction, on the Stories tab.
 *
 * A second copy rather than a parameterised one: the two views derive different
 * things, and a shared allowlist would let a value declared for one tab pass
 * silently on the other. The point of this test is that each addition costs
 * somebody a line of justification.
 */
const STORY_PAYLOAD = {
  feature: { id: 'F-01', title: 'Session handling', specPath: 'specs/002/spec.md' },
  stories: [
    {
      id: 'US-002',
      title: 'Share one session fetch across routes',
      priority: 'P1',
      status: 'active',
      asA: 'developer',
      want: 'one hook that fetches the session',
      soThat: 'the routes stop doing it themselves',
      criteria: ['The hook is used by every route.'],
      files: ['src/hooks/useSession.ts'],
    },
    { id: 'US-004', title: 'Read the prompt history', priority: 'P2', status: 'todo' },
  ],
  tasks: [
    { id: 'T-011', title: 'Audit the three call sites', status: 'done', storyId: 'US-002' },
    { id: 'T-013', title: 'Implement useSession', status: 'active', storyId: 'US-002' },
  ],
  focus: { task: 'T-013', chip: 'watching' },
};

const STORY_REPORTED: string[] = [
  STORY_PAYLOAD.feature.specPath,
  ...STORY_PAYLOAD.stories.flatMap((s) => [
    s.id,
    s.title,
    ...(s.priority === undefined ? [] : [s.priority]),
    ...(s.status === undefined ? [] : [s.status]),
    ...(s.asA === undefined ? [] : [s.asA]),
    ...(s.want === undefined ? [] : [s.want]),
    ...(s.soThat === undefined ? [] : [s.soThat]),
    ...(s.criteria ?? []),
    ...(s.files ?? []),
  ]),
  ...STORY_PAYLOAD.tasks.flatMap((t) => [t.id, t.title, t.status]),
];

/** Everything the Stories tab is allowed to draw that nobody reported. */
const STORY_DERIVED: readonly RegExp[] = [
  /STORIES|ACCEPTANCE CRITERIA|TASKS|TOUCHES/g, // section labels
  /As a|I want|so that/g, // the narrative's own scaffolding
  /· current/g, // which story owns the current task
  /\b\d+\/\d+\b|no tasks/g, // the per-story task summary
  /\b\d+[smhd]\b|\bnow\b/g, // the current task's elapsed tag
  /[✓!]/g, // status discs, as on the Overview tab
  // The story count and the criteria ordinals, and *only* those: a bare `\d+`
  // here reaches inside `US-002` and `specs/002/spec.md` and punches holes in
  // reported values, which then survive the subtraction below as `US-P` and
  // `specs//spec.md`. A standalone number is the narrowest thing that matches
  // both and neither.
  /(?<=^|\s)\d+(?=\s|$)/g,
];

test.describe('the stories tab shows only what was reported', () => {
  /**
   * Wide enough for the side-by-side arrangement.
   *
   * Not incidental: below the breakpoint this tab draws a picker with a
   * disclosure caret and no story list at all, so a test that inherited the
   * default window size would be subtracting from a different view than the one
   * it names. The narrow arrangement has its own spec.
   */
  test.beforeEach(async () => {
    await board.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
    });
  });

  test('renders nothing that was not reported or declared as derived', async () => {
    const { page } = board;
    await board.push({ ...envelope(), ...STORY_PAYLOAD });
    await page.getByTestId('tab-stories').click();
    await expect(page.getByTestId('stories')).toBeVisible();

    let remaining = (await page.getByTestId('stories').innerText()).replace(/\s+/gu, ' ');

    for (const pattern of STORY_DERIVED) remaining = remaining.replace(pattern, ' ');
    for (const value of [...STORY_REPORTED].sort((a, b) => b.length - a.length)) {
      remaining = remaining.split(value).join(' ');
    }

    expect(remaining.replace(/[\s·]/gu, '')).toBe('');
  });

  test('does not sort, group or renumber the stories it was given', async () => {
    const { page } = board;
    await board.push({
      ...envelope(),
      stories: [
        { id: 'US-009', title: 'Ninth' },
        { id: 'US-001', title: 'First' },
      ],
      tasks: [{ id: 'T-1', title: 'A task', status: 'todo', storyId: 'US-009' }],
    });
    await page.getByTestId('tab-stories').click();

    await expect(page.locator('.storylist__id')).toHaveText(['US-009', 'US-001']);
  });
});

/**
 * And again on the Tasks tab, for the reason the second copy exists: this view
 * derives things neither of the others does — the scope picker's summary of a
 * story it is not currently showing, and a "From the story" line assembled from
 * two reported values — and a shared allowlist would let either pass unexamined.
 */
const TASK_PAYLOAD = {
  stories: [
    { id: 'US-002', title: 'Share one session fetch across routes' },
    { id: 'US-004', title: 'Read the prompt history' },
  ],
  tasks: [
    {
      id: 'T-011',
      title: 'Audit the three call sites',
      status: 'done',
      storyId: 'US-002',
      detail: 'Each route mounts the fetch itself.',
      checks: ['Every call site is listed.'],
      files: ['src/routes/index.tsx'],
    },
    { id: 'T-013', title: 'Implement useSession', status: 'active', storyId: 'US-002' },
  ],
  focus: { task: 'T-013', note: 'Writing the hook.', chip: 'watching' },
};

const TASK_REPORTED: string[] = [
  ...TASK_PAYLOAD.stories.flatMap((s) => [s.id, s.title]),
  ...TASK_PAYLOAD.tasks.flatMap((t) => [
    t.id,
    t.title,
    t.status,
    ...(t.detail === undefined ? [] : [t.detail]),
    ...(t.checks ?? []),
    ...(t.files ?? []),
  ]),
  TASK_PAYLOAD.focus.note,
];

/** Everything the Tasks tab is allowed to draw that nobody reported. */
const TASK_DERIVED: readonly RegExp[] = [
  /TASKS|CHECKS|FILES|FROM THE STORY/g, // section labels
  /[▼▲]/g, // the scope picker's caret
  /[✓!]/g, // status discs, as on both other tabs
  /\b\d+\/\d+\b|no tasks/g, // the scope picker's task summary
  /\b\d+[smhd]\b|\bnow\b/g, // the report's age against the current task
  /(?<=^|\s)\d+(?=\s|$)/g, // the task count, and only a standalone number
];

test.describe('the tasks tab shows only what was reported', () => {
  test.beforeEach(async () => {
    await board.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
    });
  });

  test('renders nothing that was not reported or declared as derived', async () => {
    const { page } = board;
    await board.push({ ...envelope(), ...TASK_PAYLOAD });
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('tasks')).toBeVisible();

    let remaining = (await page.getByTestId('tasks').innerText()).replace(/\s+/gu, ' ');

    for (const pattern of TASK_DERIVED) remaining = remaining.replace(pattern, ' ');
    for (const value of [...TASK_REPORTED].sort((a, b) => b.length - a.length)) {
      remaining = remaining.split(value).join(' ');
    }

    expect(remaining.replace(/[\s·]/gu, '')).toBe('');
  });

  test('does not sort or renumber the tasks it was given', async () => {
    const { page } = board;
    await board.push({
      ...envelope(),
      stories: [{ id: 'US-002', title: 'One story' }],
      tasks: [
        { id: 'T-9', title: 'Ninth', status: 'todo', storyId: 'US-002' },
        { id: 'T-1', title: 'First', status: 'done', storyId: 'US-002' },
      ],
    });
    await page.getByTestId('tab-tasks').click();

    await expect(page.locator('.tasklist__id')).toHaveText(['T-9', 'T-1']);
  });
});

/**
 * And a fourth time, on the Notes tab.
 *
 * A fourth copy rather than a parameterised one, for the reason the second gives
 * — and this tab makes the case best. Its board text is not chrome: the footer
 * is a *claim*, and the header counts. Both have to be declared by someone who
 * has read them, which a shared allowlist would let them skip.
 */
const NOTE_TEXTS = [
  'The refresh race guard only worked because the routes mounted in a fixed order.',
  'api/client.ts changed on disk between my read and my write. I stopped.',
];

/** Everything the Notes tab is allowed to draw that no agent wrote. */
const NOTE_DERIVED: readonly RegExp[] = [
  /THIS SESSION/g, // the section label
  /\d+ notes? · over \d+[smhd]|none yet/g, // the header summary
  /\b\d+[smhd]\b/g, // each note's age in the gutter
  // The footer, in full and quoted exactly. Not a loose pattern: this sentence
  // is the feature's central claim, and a test that matched it approximately
  // would keep passing while it drifted into something less true.
  /Notes live in this window only\. Closing it clears all \d+ — ask the agent to write anything worth keeping into the repository\./g,
];

test.describe('the notes tab shows only what was reported', () => {
  test('renders nothing that was not written by an agent or declared as derived', async () => {
    const { page } = board;
    await board.push({ ...envelope(), tasks: [{ id: 'T-1', title: 'A task', status: 'todo' }] });
    for (const text of NOTE_TEXTS) {
      await board.note({ ...envelope(), text, source: 'noticed while editing' });
    }

    await page.getByTestId('tab-notes').click();
    await expect(page.getByTestId('notes')).toBeVisible();

    let remaining = (await page.getByTestId('notes').innerText()).replace(/\s+/gu, ' ');

    for (const pattern of NOTE_DERIVED) remaining = remaining.replace(pattern, ' ');
    for (const value of [...NOTE_TEXTS, 'noticed while editing'].sort(
      (a, b) => b.length - a.length,
    )) {
      remaining = remaining.split(value).join(' ');
    }

    expect(remaining.replace(/[\s·]/gu, '')).toBe('');
  });

  test('does not reorder or renumber the notes it was given', async () => {
    const { page } = board;
    await board.push({ ...envelope(), tasks: [{ id: 'T-1', title: 'A task', status: 'todo' }] });
    await board.note({ ...envelope(), text: 'First to arrive' });
    await board.note({ ...envelope(), text: 'Second to arrive' });

    await page.getByTestId('tab-notes').click();

    // Newest first is the one ordering rule this board applies, and it is
    // arrival reversed rather than a sort on anything.
    await expect(page.locator('.noterow__text')).toHaveText([
      'Second to arrive',
      'First to arrive',
    ]);
  });
});

/**
 * And the switcher row, which is chrome rather than a view but draws
 * agent-composed text like everything else.
 *
 * Three derived values, each earning its place: the repository's *name* rather
 * than its path, the elapsed time, and the word `script` for a push with no
 * process behind it. Nothing else may appear — in particular no count, no
 * ordinal, and nothing about how long is "too long".
 */
test.describe('the session switcher shows only what was reported', () => {
  test('renders nothing that was not reported or declared as derived', async () => {
    const { page } = board;
    const repoB = `${process.cwd()}/apps`;

    await board.push({ ...envelope({ sessionId: 'a1', branch: 'feat/one' }) });
    await board.push({ ...envelope({ repo: repoB, sessionId: 'b2', branch: 'feat/two' }) });
    await expect(page.getByTestId('session-switcher')).toBeVisible();

    let remaining = (await page.getByTestId('session-switcher').innerText()).replace(/\s+/gu, ' ');

    for (const pattern of [
      /\b\d+[smhd]\b/g, // elapsed, per pill
      /Idle|Watching|Thinking|Needs you/g, // the reported chip, in its own words
      /\bscript\b/g, // an unattributed push, which is a fact about the sender
      /×/g, // the dismiss control
    ]) {
      remaining = remaining.replace(pattern, ' ');
    }

    // The reported branches, and the repository names the board derived from
    // the reported paths.
    for (const value of ['feat/one', 'feat/two', 'CoCoPilot', 'apps']) {
      remaining = remaining.split(value).join(' ');
    }

    expect(remaining.replace(/[\s·]/gu, '')).toBe('');
  });
});

test.describe('limits and hostile content', () => {
  test('stays navigable at 500 tasks with an accurate header summary', async () => {
    const { page } = board;

    const tasks = Array.from({ length: 500 }, (_, i) => ({
      id: `T-${String(i).padStart(3, '0')}`,
      title: `Task number ${i}`,
      status: i < 137 ? 'done' : 'todo',
    }));

    const started = Date.now();
    await board.push({ ...envelope(), tasks });
    await expect(page.getByTestId('task-T-499')).toHaveCount(1);
    expect(Date.now() - started).toBeLessThan(10_000);

    await expect(page.getByTestId('section-summary-spec')).toHaveText('137 of 500 done');

    // Reachable, not merely present.
    await page.getByTestId('task-T-499').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('task-T-499')).toBeInViewport();
  });

  test('truncates long text legibly and keeps the full value retrievable', async () => {
    const { page, app } = board;

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(380, 320);
    });

    // Every field below is capped at 200 or 500 by the contract, and every one
    // of them is unbroken -- no whitespace to wrap on, which is the case that
    // actually pushes a row past the panel edge.
    const id = 'T-'.padEnd(200, 'I');
    const title = 'T'.repeat(180);
    const status = 'S'.repeat(200);
    const path = `src/${'deeply/'.repeat(60)}client.ts`;
    const note = 'N'.repeat(200);

    await board.push({
      ...envelope(),
      tasks: [{ id, title, status }],
      focus: { task: id },
      changedFiles: [{ path, change: 'modified', note }],
    });

    // Full text on `title`, which is FR-009 satisfied rather than asserted.
    const row = page.getByTestId(`task-${id}`);
    await expect(row.locator('.taskrow__id')).toHaveAttribute('title', id);
    await expect(row.locator('.taskrow__title')).toHaveAttribute('title', title);
    await expect(row.locator('.status')).toHaveAttribute('title', status);
    await expect(page.getByTestId('focus-task')).toHaveAttribute('title', id);
    await expect(page.getByTestId('changed-0').locator('.changed__path')).toHaveAttribute(
      'title',
      path,
    );
    await expect(page.getByTestId('changed-note-0')).toHaveAttribute('title', note);

    // Nothing on the page may make the window scroll sideways, at any width.
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      panel: (() => {
        const el = document.querySelector('.app__body');
        return el === null ? 0 : el.scrollWidth - el.clientWidth;
      })(),
    }));
    expect(overflow.body).toBeLessThanOrEqual(0);
    expect(overflow.panel).toBeLessThanOrEqual(0);
  });

  test('renders markup in every reported field as visible characters', async () => {
    const { page } = board;
    const hostile = '<script>window.__pwned = true</script><img src=x onerror="window.__pwned=1">';

    await board.push({
      ...envelope(),
      feature: { id: hostile, title: hostile, specPath: hostile },
      tasks: [{ id: hostile, title: hostile, status: hostile }],
      plan: [{ text: hostile, status: hostile, detail: hostile }],
      focus: { task: hostile, note: hostile },
      changedFiles: [{ path: hostile, change: hostile, note: hostile }],
    });

    await expect(page.getByTestId('focus-note')).toHaveText(hostile);
    expect(await page.evaluate(() => (window as { __pwned?: unknown }).__pwned)).toBeUndefined();
    await expect(page.locator('.overview img')).toHaveCount(0);
    await expect(page.locator('.overview script')).toHaveCount(0);
  });
});
