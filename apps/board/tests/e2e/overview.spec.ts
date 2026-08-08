import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
});

test.afterEach(async () => {
  await board.close();
});

/**
 * The title bar, having counted past zero. Matched as a band rather than an
 * exact tick, so a loaded machine cannot miss the one-second window and fail
 * for a reason that has nothing to do with the code.
 */
const ADVANCED_PHRASE = /^heard [1-9]\d*s ago$/;

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

  test('states a duration and never changes treatment while time passes', async () => {
    const { page } = board;

    await board.push({ ...envelope(), focus: { task: 'T-013', note: 'Reading the middleware.' } });

    const tag = page.getByTestId('focus-elapsed');
    const treatment = async (): Promise<Record<string, string>> =>
      tag.evaluate((el) => {
        const style = getComputedStyle(el);
        return { color: style.color, weight: style.fontWeight, opacity: style.opacity };
      });

    await expect(tag).toHaveText('now');
    const before = await treatment();

    // The clock is ticking -- the title bar proves it -- and the focus tag is
    // unmoved and unrestyled. There is no threshold here to test *at*; the band
    // boundaries are covered exhaustively in `lib/elapsed.test.ts`, and what
    // matters at this level is that nothing about the tag's appearance is a
    // function of age (FR-003).
    await expect(page.getByTestId('elapsed')).toHaveText(ADVANCED_PHRASE, { timeout: 5_000 });

    await expect(tag).toHaveText('now');
    expect(await treatment()).toEqual(before);
    await expect(page.getByTestId('focus-note')).toBeVisible();
  });

  test('keeps showing the focus when a note arrives', async () => {
    const { page } = board;

    await board.push({ ...envelope(), focus: { task: 'T-013' } });
    await board.note({ ...envelope(), text: 'noticed while editing' });

    // A note moves `lastHeardAt` and must not move `reportedAt` -- the tag says
    // how long since the agent said what it was *working on*. Within the first
    // minute both read as fresh, so the discriminating assertion is the unit
    // test in `tests/unit/view.test.ts`; what this covers is that a note does
    // not blank or replace the focus that a report established.
    await expect(page.getByTestId('elapsed')).toHaveText('heard 0s ago');
    await expect(page.getByTestId('focus-task')).toHaveText('T-013');
    await expect(page.getByTestId('focus-elapsed')).toHaveText('now');
  });
});

test.describe('Spec — the feature and its tasks', () => {
  const FEATURE = {
    id: 'US-002',
    title: 'Share one session fetch across routes',
    specPath: 'specs/002-session-hook/spec.md',
  };

  test('shows the feature and every task with identifier, title and status', async () => {
    const { page } = board;

    await board.push({
      ...envelope(),
      feature: FEATURE,
      tasks: [
        { id: 'T-011', title: 'Audit the three call sites', status: 'done' },
        { id: 'T-013', title: 'Implement useSession', status: 'active' },
        { id: 'T-014', title: 'Swap the call sites', status: 'todo' },
      ],
      focus: { task: 'T-013' },
    });

    await expect(page.getByTestId('feature-id')).toHaveText('US-002');
    await expect(page.getByTestId('feature-title')).toHaveText(
      'Share one session fetch across routes',
    );
    await expect(page.getByTestId('feature-path')).toHaveText('specs/002-session-hook/spec.md');

    await expect(page.getByTestId('task-T-011')).toContainText('Audit the three call sites');
    await expect(page.getByTestId('task-T-011')).toContainText('done');
    await expect(page.getByTestId('task-T-014')).toContainText('todo');

    await expect(page.getByTestId('section-summary-spec')).toHaveText('US-002 · 1 of 3 done');
  });

  test('marks the focused task and no other', async () => {
    const { page } = board;

    await board.push({
      ...envelope(),
      tasks: [
        { id: 'T-011', title: 'Audit the three call sites', status: 'done' },
        { id: 'T-013', title: 'Implement useSession', status: 'active' },
      ],
      focus: { task: 'T-013' },
    });

    await expect(page.getByTestId('task-T-013')).toHaveAttribute('data-focused', 'true');
    await expect(page.getByTestId('task-T-011')).toHaveAttribute('data-focused', 'false');
    await expect(page.getByTestId('task-elapsed-T-013')).toBeVisible();
  });

  test('still shows a focused task that is absent from the task list', async () => {
    const { page } = board;

    await board.push({
      ...envelope(),
      tasks: [{ id: 'T-011', title: 'Audit the three call sites', status: 'done' }],
      focus: { task: 'T-999', note: 'Something the task list does not mention.' },
    });

    // Shown as reported rather than discarded for failing to match.
    await expect(page.getByTestId('focus-task')).toHaveText('T-999');
    await expect(page.getByTestId('task-T-011')).toHaveAttribute('data-focused', 'false');
  });

  test('leaves the section out entirely when nothing was reported for it', async () => {
    const { page } = board;

    await board.push({ ...envelope(), focus: { task: 'T-013' } });

    await expect(page.getByTestId('section-focus')).toBeVisible();
    await expect(page.getByTestId('section-spec')).toHaveCount(0);
  });
});

/**
 * Quickstart scenario 3, row for row. The last two entries are the ones that
 * matter: if `donee` renders as done, matching is too loose and the board is
 * confidently wrong about work nobody finished.
 */
test.describe('the status vocabulary', () => {
  const CASES = [
    { id: 'a', status: 'done', expect: 'done' },
    { id: 'b', status: 'DONE', expect: 'done' },
    { id: 'c', status: ' in progress ', expect: 'active' },
    { id: 'd', status: 'wip', expect: 'active' },
    { id: 'e', status: 'blocked', expect: 'blocked' },
    { id: 'f', status: 'waiting on CI', expect: 'unrecognised' },
    { id: 'g', status: 'donee', expect: 'unrecognised' },
  ] as const;

  test('classifies each reported status and shows its text as written', async () => {
    const { page } = board;

    await board.push({
      ...envelope(),
      tasks: CASES.map((c) => ({ id: c.id, title: `Task ${c.id}`, status: c.status })),
    });

    for (const c of CASES) {
      const row = page.getByTestId(`task-${c.id}`);
      await expect(row.locator('.status'), c.status).toHaveAttribute(
        'data-vocabulary',
        c.expect,
      );
      // The reported text, never a canonical form substituted for it.
      await expect(row.locator('.status'), c.status).toHaveText(c.status.trim());
    }

    // Two recognised, five rows -- and the count agrees with the rows beside it.
    await expect(page.getByTestId('section-summary-spec')).toHaveText('2 of 7 done');
  });

  test('gives an unrecognised status no colour and no disc', async () => {
    const { page } = board;

    await board.push({
      ...envelope(),
      tasks: [
        { id: 'known', title: 'Known', status: 'done' },
        { id: 'unknown', title: 'Unknown', status: 'waiting on CI' },
      ],
    });

    const neutral = page.getByTestId('task-unknown');
    const muted = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(),
    );
    const asRgb = (hex: string): string => {
      const n = Number.parseInt(hex.slice(1), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };

    await expect(neutral.locator('.status')).toHaveCSS('color', asRgb(muted));

    // The disc is drawn with no border and no fill: nothing that says "not
    // started" about a status the board cannot read.
    await expect(neutral.locator('.disc')).toHaveCSS('border-top-width', '0px');
    await expect(neutral.locator('.disc')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(neutral.locator('.disc')).toBeEmpty();

    await expect(page.getByTestId('task-known').locator('.disc')).not.toBeEmpty();
  });
});

test.describe('Plan — the sequence being worked through', () => {
  const PLAN = [
    { text: 'Read the three call sites', status: 'done' },
    { text: 'Write useSession with the existing error handling', status: 'active', detail: 'editing src/hooks/useSession.ts' },
    { text: 'Replace the call sites', status: 'todo' },
    { text: 'Run the session tests', status: 'todo' },
  ];

  test('shows the steps in the reported order and distinguishes the current one', async () => {
    const { page } = board;

    await board.push({ ...envelope(), plan: PLAN });

    const steps = page.locator('[data-testid^="plan-step-"] .plan__label');
    await expect(steps).toHaveText(PLAN.map((step) => step.text));

    // Distinguishable from both completed and upcoming, by the disc it carries.
    await expect(page.getByTestId('plan-step-1').locator('.disc')).toHaveAttribute(
      'data-vocabulary',
      'active',
    );
    await expect(page.getByTestId('plan-step-0').locator('.disc')).toHaveAttribute(
      'data-vocabulary',
      'done',
    );
    await expect(page.getByTestId('plan-step-1')).toContainText('editing src/hooks/useSession.ts');
  });

  test('states position in the header while a step is active', async () => {
    const { page } = board;

    await board.push({ ...envelope(), plan: PLAN });
    await expect(page.getByTestId('section-summary-plan')).toHaveText('Step 2 of 4');
  });

  test('falls back to completion when no step claims to be active', async () => {
    const { page } = board;

    await board.push({
      ...envelope(),
      plan: [
        { text: 'Read the call sites', status: 'done' },
        { text: 'Something the board cannot read', status: 'halfway' },
      ],
    });

    // "Step 2 of 2" here would claim a position no reported step supports.
    await expect(page.getByTestId('section-summary-plan')).toHaveText('1 of 2 done');
  });

  test('is absent rather than fabricated when no plan was reported', async () => {
    const { page } = board;

    await board.push({ ...envelope(), tasks: [{ id: 'T-011', title: 'A task', status: 'todo' }] });

    await expect(page.getByTestId('section-spec')).toBeVisible();
    await expect(page.getByTestId('section-plan')).toHaveCount(0);
  });
});

test.describe('Changed files — what the agent says it touched', () => {
  const FILES = [
    { path: 'src/hooks/useSession.ts', change: 'added', added: 48 },
    { path: 'src/routes/index.tsx', change: 'modified', added: 21, removed: 18 },
    { path: 'src/api/client.ts', change: 'modified', added: 17, removed: 13, note: 'conflict' },
  ];

  test('lists each file with its path and the kind of change reported', async () => {
    const { page } = board;

    await board.push({ ...envelope(), changedFiles: FILES });

    await expect(page.getByTestId('changed-0')).toContainText('src/hooks/useSession.ts');
    await expect(page.getByTestId('changed-0')).toContainText('added');
    await expect(page.getByTestId('changed-1')).toContainText('+21');
    await expect(page.getByTestId('changed-1')).toContainText('−18');
  });

  test('distinguishes a file the agent flagged', async () => {
    const { page } = board;

    await board.push({ ...envelope(), changedFiles: FILES });

    await expect(page.getByTestId('changed-2')).toHaveAttribute('data-flagged', 'true');
    await expect(page.getByTestId('changed-1')).toHaveAttribute('data-flagged', 'false');
    await expect(page.getByTestId('changed-note-2')).toHaveText('conflict');
  });

  test('carries an aggregate in the header that agrees with the rows', async () => {
    const { page } = board;

    await board.push({ ...envelope(), changedFiles: FILES });

    const summary = page.getByTestId('section-summary-changed');
    await expect(summary).toContainText('+86');
    await expect(summary).toContainText('−31');
  });

  test('shows nothing at all when the repository changes underneath it', async () => {
    const { page } = board;

    await board.push({ ...envelope(), changedFiles: FILES });
    await expect(page.getByTestId('changed-0')).toContainText('src/hooks/useSession.ts');

    const before = await page.getByTestId('section-changed').innerText();

    // Write a real file into the repository the session named. The board never
    // reads the repository, so this must produce no change of any kind: what is
    // on screen is a record of what was said, not a view of what is on disk.
    const scratch = join(process.cwd(), `cocoapilot-e2e-${process.pid}.tmp`);
    writeFileSync(scratch, 'touched outside the agent');
    try {
      await page.waitForTimeout(1_500);
      expect(await page.getByTestId('section-changed').innerText()).toBe(before);
    } finally {
      rmSync(scratch, { force: true });
    }
  });
});
