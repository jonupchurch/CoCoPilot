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
