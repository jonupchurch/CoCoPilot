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
