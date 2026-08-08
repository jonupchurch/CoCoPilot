import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { glob } from 'node:fs/promises';

import { envelope, launchBoard, type Board } from './board.js';

/**
 * More than one agent reporting at once.
 *
 * Nearly everything here is something the board must **not** do: not appear
 * when there is one session, not switch itself, not reorder, not expire, not
 * promote one agent over another. The one thing it must do is keep an
 * unselected agent's request for a human visible — which is the whole reason
 * pills carry state rather than just names.
 */

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
  await board.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(900, 700);
  });
});

test.afterEach(async () => {
  await board.close();
});

const REPO_A = process.cwd();
/** A second real directory, since `repo` must exist to be accepted. */
const REPO_B = `${process.cwd()}/apps`;

async function declare(
  repo: string,
  sessionId: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  await board.push({
    ...envelope({ repo, sessionId, branch: `feat/${sessionId}` }),
    tasks: [{ id: `T-${sessionId}`, title: `Work in ${sessionId}`, status: 'active' }],
    ...overrides,
  });
}

/** The pill for a session, found by the visible identity rather than by key. */
function pill(index: number) {
  return board.page.locator('.pill').nth(index);
}

test.describe('one session pays nothing for the possibility of two', () => {
  test('shows no switcher with nothing held, or with one session', async () => {
    const { page } = board;
    // Nothing at all.
    await expect(page.getByTestId('session-switcher')).toHaveCount(0);

    await declare(REPO_A, 'a1');
    await expect(page.getByTestId('overview')).toBeVisible();
    await expect(page.getByTestId('session-switcher')).toHaveCount(0);

    // And it does not appear because the same session keeps talking.
    for (let i = 0; i < 5; i += 1) await declare(REPO_A, 'a1');
    await expect(page.getByTestId('session-switcher')).toHaveCount(0);
  });

  test('reserves no space for a switcher it is not showing', async () => {
    /*
     * SC-001 by comparison rather than by eye — and the comparison has to be
     * against the *two*-session case to mean anything. Measuring one session
     * against itself cannot fail, which is a test that reads as proof and is
     * not one.
     *
     * What is actually being claimed: the tab strip sits at the same height
     * with one session as it would if the switcher were absent, moves down when
     * the row genuinely appears, and returns when it goes. Permanent chrome
     * reserved for a rare case would make the first and second equal.
     */
    const tabsTop = async (): Promise<number> =>
      board.page.evaluate(() => document.querySelector('.tabstrip')?.getBoundingClientRect().top ?? 0);

    await declare(REPO_A, 'a1');
    const alone = await tabsTop();
    expect(alone).toBeGreaterThan(0);

    await declare(REPO_B, 'b2');
    await expect(board.page.getByTestId('session-switcher')).toBeVisible();
    const withRow = await tabsTop();
    // The row is real: it took space that was not previously reserved.
    expect(withRow).toBeGreaterThan(alone);

    await pill(1).locator('.pill__dismiss').click();
    await expect(board.page.getByTestId('session-switcher')).toHaveCount(0);
    expect(await tabsTop()).toBe(alone);
  });

  test('appears at two and is gone again when one is dismissed', async () => {
    // FR-002 in both directions. The row is not a one-way door.
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');

    await expect(page.getByTestId('session-switcher')).toBeVisible();
    await expect(page.locator('.pill')).toHaveCount(2);

    await pill(1).locator('.pill__dismiss').click();

    await expect(page.getByTestId('session-switcher')).toHaveCount(0);
    await expect(page.getByTestId('overview')).toBeVisible();
  });
});

test.describe('two agents, and the board following one of them', () => {
  test('lists both in declaration order, and never in recency order', async () => {
    // FR-004. The first-declared session speaks most recently of all, which is
    // exactly the case a recency sort would reorder.
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');
    await declare(REPO_A, 'a1');

    await expect(page.locator('.pill__branch')).toHaveText(['feat/a1', 'feat/b2']);
  });

  test('shows the first declared until the developer chooses otherwise', async () => {
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');

    await expect(pill(0)).toHaveAttribute('data-selected', 'true');
    await expect(board.page.getByTestId('task-T-a1')).toBeVisible();
  });

  test('makes every view follow the selection', async () => {
    // FR-010. Not just the Overview: the selection is the session, and a tab
    // showing the other one's tasks would be the worst possible failure here.
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2', {
      stories: [{ id: 'US-b2', title: 'Only in b2' }],
      tasks: [{ id: 'T-b2', title: 'Work in b2', status: 'active', storyId: 'US-b2' }],
    });

    await pill(1).locator('.pill__select').click();

    await expect(page.getByTestId('task-T-b2')).toBeVisible();
    await expect(page.getByTestId('task-T-a1')).toHaveCount(0);

    await page.getByTestId('tab-stories').click();
    await expect(page.locator('.storylist__id')).toHaveText(['US-b2']);

    await page.getByTestId('tab-tasks').click();
    await expect(page.locator('.tasklist__id')).toHaveText(['T-b2']);
  });

  test('does not move the selection when the other session reports', async () => {
    // FR-009 and SC-003, the temptation this feature exists to resist.
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');
    await pill(1).locator('.pill__select').click();
    await expect(page.getByTestId('task-T-b2')).toBeVisible();

    await declare(REPO_A, 'a1', { focus: { chip: 'watching' } });

    await expect(pill(1)).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('task-T-b2')).toBeVisible();
  });

  test('appends a third without disturbing order or selection', async () => {
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');
    await pill(1).locator('.pill__select').click();

    await declare(REPO_A, 'c3');

    await expect(page.locator('.pill__branch')).toHaveText(['feat/a1', 'feat/b2', 'feat/c3']);
    await expect(pill(1)).toHaveAttribute('data-selected', 'true');
  });

  test('shows the target session s current state on switching back', async () => {
    // SC-009, in one action. The board holds every session's latest word, so
    // switching is a read rather than a refetch.
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');

    await pill(1).locator('.pill__select').click();
    await declare(REPO_A, 'a1', {
      tasks: [{ id: 'T-new', title: 'Something newer', status: 'done' }],
    });

    await pill(0).locator('.pill__select').click();
    await expect(page.getByTestId('task-T-new')).toBeVisible();
  });

  test('keeps two sessions in the same repository and branch apart', async () => {
    // The edge case a key by repository alone would silently merge.
    const { page } = board;
    await board.push({
      ...envelope({ repo: REPO_A, sessionId: 'one', branch: 'main' }),
      tasks: [{ id: 'T-one', title: 'First', status: 'active' }],
    });
    await board.push({
      ...envelope({ repo: REPO_A, sessionId: 'two', branch: 'main' }),
      tasks: [{ id: 'T-two', title: 'Second', status: 'active' }],
    });

    await expect(page.locator('.pill')).toHaveCount(2);
    await pill(1).locator('.pill__select').click();
    await expect(page.getByTestId('task-T-two')).toBeVisible();
    await expect(page.getByTestId('task-T-one')).toHaveCount(0);
  });

  test('shows every pill s own state and age, selected or not', async () => {
    // FR-006 and FR-007. Without these the board's only way of asking for a
    // human is silently dropped for every session but the one being watched.
    const { page } = board;
    await declare(REPO_A, 'a1', { focus: { chip: 'thinking' } });
    await declare(REPO_B, 'b2', { focus: { chip: 'watching' } });

    await expect(pill(0).locator('.chip')).toHaveAttribute('data-chip', 'thinking');
    await expect(pill(1).locator('.chip')).toHaveAttribute('data-chip', 'watching');
    await expect(page.locator('.pill__elapsed')).toHaveText([
      /^\d+[smhd]$/u,
      /^\d+[smhd]$/u,
    ]);
  });

  test('says when a session is a script rather than an agent', async () => {
    // FR-011. "The agent has gone quiet" reads very differently from "a script
    // reported once and was never going to report again".
    const { page } = board;
    await declare(REPO_A, 'a1');
    // No `sessionId`, which is how the service records an unattributed push.
    await board.push({
      repo: REPO_B,
      branch: 'main',
      tasks: [{ id: 'T-s', title: 'From a script', status: 'done' }],
    });

    await expect(page.locator('.pill')).toHaveCount(2);
    await expect(page.locator('.pill__script')).toHaveCount(1);
  });
});

test.describe('an agent the developer is not watching asks for a human', () => {
  test('shows on its own pill without the board switching to it', async () => {
    // US3, and the reason it is equal in priority to being able to switch at
    // all: the chip is the only channel an agent has (decision 15), and the
    // board shows one session at a time.
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');
    await expect(pill(0)).toHaveAttribute('data-selected', 'true');

    await declare(REPO_B, 'b2', { focus: { chip: 'needs-you' } });

    await expect(pill(1)).toHaveAttribute('data-attention', 'true');
    await expect(pill(1).locator('.chip')).toHaveAttribute('data-chip', 'needs-you');
    // And the board did not help.
    await expect(pill(0)).toHaveAttribute('data-selected', 'true');
    await expect(page.getByTestId('task-T-a1')).toBeVisible();
  });

  test('names the state in words even on an unselected pill', async () => {
    // The label is dropped for width on ordinary unselected pills, but never on
    // this one: an ember edge says "something", and the word says what.
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2', { focus: { chip: 'needs-you' } });

    await expect(pill(1).locator('.chip')).toHaveText('Needs you');
    await expect(pill(1).locator('.chip')).toHaveAttribute('data-labelled', 'true');
  });

  test('does not reorder the pills or move the window', async () => {
    // FR-019 and US3 scenario 5. Nothing moves under the cursor, and the window
    // belongs to the developer.
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');

    /*
     * Bounds, always-on-top and minimised state — the things the *application*
     * would have to change to raise itself.
     *
     * `isFocused()` is deliberately not compared, and this was found the hard
     * way: it passed alone and flaked in the full suite, because focus belongs
     * to the window manager and the previous test's window closing hands it
     * over. Asserting it was asserting the environment. The "does not steal
     * focus" half of FR-019 is covered by the source assertion below instead,
     * which is what actually distinguishes the app raising itself from the OS
     * moving focus around.
     */
    const state = async (): Promise<unknown> =>
      board.app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        return {
          bounds: window?.getBounds(),
          alwaysOnTop: window?.isAlwaysOnTop(),
          minimized: window?.isMinimized(),
        };
      });

    const before = await state();

    await declare(REPO_B, 'b2', { focus: { chip: 'needs-you' } });
    await expect(pill(1)).toHaveAttribute('data-attention', 'true');

    expect(await state()).toEqual(before);
    // The one asking is still second, where it was declared.
    await expect(page.locator('.pill__branch')).toHaveText(['feat/a1', 'feat/b2']);
  });

  test('returns to ordinary when a later report says so', async () => {
    // US3 scenario 4. The board never clears an attention state on its own, and
    // it never keeps one the agent has withdrawn either.
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2', { focus: { chip: 'needs-you' } });
    await expect(pill(1)).toHaveAttribute('data-attention', 'true');

    await declare(REPO_B, 'b2', { focus: { chip: 'thinking' } });

    await expect(pill(1)).toHaveAttribute('data-attention', 'false');
  });

  test('promotes none of several sessions asking at once', async () => {
    const { page } = board;
    await declare(REPO_A, 'a1', { focus: { chip: 'needs-you' } });
    await declare(REPO_B, 'b2', { focus: { chip: 'needs-you' } });
    await declare(REPO_A, 'c3', { focus: { chip: 'needs-you' } });

    await expect(page.locator('.pill[data-attention="true"]')).toHaveCount(3);
    // Still declaration order. No queue, no first-served, no promotion.
    await expect(page.locator('.pill__branch')).toHaveText([
      'feat/a1',
      'feat/b2',
      'feat/c3',
    ]);
  });
});

test.describe('clearing a session the developer is done with', () => {
  test('removes it, and it comes back if it reports again', async () => {
    // FR-014 and SC-006. Dismissal is not muting: the agent was never told, so
    // it goes on working and reappears the moment it says anything.
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');
    await declare(REPO_A, 'c3');
    await expect(page.locator('.pill')).toHaveCount(3);

    await pill(1).locator('.pill__dismiss').click();
    await expect(page.locator('.pill')).toHaveCount(2);
    await expect(page.locator('.pill__branch')).toHaveText(['feat/a1', 'feat/c3']);

    await declare(REPO_B, 'b2');

    await expect(page.locator('.pill')).toHaveCount(3);
    // Back at the end: it declared itself again, and that is a new declaration.
    await expect(page.locator('.pill__branch')).toHaveText([
      'feat/a1',
      'feat/c3',
      'feat/b2',
    ]);
  });

  test('falls back to another session when the selected one is cleared', async () => {
    // FR-016. Showing nothing here would read as a crash.
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');
    await pill(1).locator('.pill__select').click();
    await expect(page.getByTestId('task-T-b2')).toBeVisible();

    await pill(1).locator('.pill__dismiss').click();

    await expect(page.getByTestId('task-T-a1')).toBeVisible();
    await expect(page.getByTestId('overview')).toBeVisible();
  });

  test('returns to the waiting state when the last one is cleared', async () => {
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');

    await pill(1).locator('.pill__dismiss').click();
    // One left: no switcher, so the dismiss control goes with it. The session
    // is still there and still shown.
    await expect(page.getByTestId('session-switcher')).toHaveCount(0);
    await expect(page.getByTestId('overview')).toBeVisible();
  });

  test('says that it clears this board s copy rather than closing anything', async () => {
    // FR-015. The plan calls the wording thin cover rather than a solution, so
    // the wording is the whole mitigation and is worth asserting.
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');

    const dismiss = pill(1).locator('.pill__dismiss');
    await expect(dismiss).toHaveAttribute('title', /Clear .* from this board/u);
    await expect(dismiss).toHaveAttribute('title', /agent is not told and keeps working/u);
    await expect(dismiss).toHaveAttribute('title', /reappears if it reports again/u);
    await expect(dismiss).toHaveAttribute('aria-label', /Clear .* from this board/u);
  });
});

test.describe('many sessions, long names, and the passage of time', () => {
  test('keeps six distinguishable and selectable at the panel floor', async () => {
    // SC-007 and FR-018. The row wraps rather than scrolling sideways: a pill
    // that ran off the right edge could be the one asking for a human.
    const { page } = board;
    for (let i = 0; i < 6; i += 1) await declare(i % 2 === 0 ? REPO_A : REPO_B, `s${i}`);

    const applied = await board.app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window?.setContentSize(380, 700);
      return window?.getContentSize()[0] ?? 0;
    });
    expect(applied).toBe(380);
    await page.waitForFunction(() => window.innerWidth === 380, undefined, { timeout: 5_000 });

    await expect(page.locator('.pill')).toHaveCount(6);
    // Every one of them reachable, and the board follows each.
    for (let i = 0; i < 6; i += 1) {
      await pill(i).locator('.pill__select').click();
      await expect(page.getByTestId(`task-T-s${i}`)).toBeVisible();
    }

    const overflow = await page.evaluate(() => {
      const row = document.querySelector('[data-testid="session-switcher"]');
      return {
        body: document.body.scrollWidth - document.body.clientWidth,
        row: row === null ? 0 : row.scrollWidth - row.clientWidth,
      };
    });
    expect(overflow.body).toBeLessThanOrEqual(0);
    expect(overflow.row).toBeLessThanOrEqual(0);
  });

  test('degrades a very long repository and branch name legibly', async () => {
    const { page } = board;
    const long = 'a-quite-unreasonably-long-branch-name-that-nobody-would-ever-choose';

    await board.push({
      ...envelope({ repo: REPO_A, sessionId: 'one', branch: long }),
      tasks: [{ id: 'T-one', title: 'First', status: 'active' }],
    });
    await board.push({
      ...envelope({ repo: `${process.cwd()}/apps`, sessionId: 'two', branch: long }),
      tasks: [{ id: 'T-two', title: 'Second', status: 'active' }],
    });

    await board.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(380, 700);
    });
    await page.waitForFunction(() => window.innerWidth === 380, undefined, { timeout: 5_000 });

    // Truncated with the whole of it retrievable, and still selectable.
    await expect(pill(1).locator('.pill__branch')).toHaveAttribute('title', long);
    await pill(1).locator('.pill__select').click();
    await expect(page.getByTestId('task-T-two')).toBeVisible();

    const bodyOverflow = await page.evaluate(
      () => document.body.scrollWidth - document.body.clientWidth,
    );
    expect(bodyOverflow).toBeLessThanOrEqual(0);
  });

  test('renders a hostile repository or branch name as visible characters', async () => {
    const { page } = board;
    const hostile = '<script>window.__pwned = true</script>';

    await declare(REPO_A, 'a1');
    await board.push({
      ...envelope({ repo: `${process.cwd()}/apps`, sessionId: 'b2', branch: hostile }),
      tasks: [{ id: 'T-b2', title: 'Second', status: 'active' }],
    });

    await expect(pill(1).locator('.pill__branch')).toContainText('<script>');
    expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined();
  });

  test('never removes or hides a session because time has passed', async () => {
    /*
     * FR-017 and SC-008. Every other product in this space eventually decides a
     * quiet agent is a finished one; this board refuses, because a healthy
     * agent goes silent for minutes during a typecheck and there is no duration
     * that means anything.
     *
     * Driven by moving the clock the elapsed values are computed against rather
     * than by waiting: what is being asserted is that nothing is *scheduled* to
     * remove a session, and a real wait could only ever test a short one.
     */
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');
    await expect(page.locator('.pill')).toHaveCount(2);

    const ages = await page.locator('.pill__elapsed').allInnerTexts();

    // A real wait, the way `no-timer-changes.spec.ts` does it. Faking the clock
    // was tried and does not work here: `page.clock.install()` cannot patch
    // timers the page created before it ran, and the board's tick starts at
    // launch — the elapsed values simply stayed at `0s`, which would have made
    // this test pass for the wrong reason at any duration.
    await page.waitForTimeout(4_000);

    await expect(page.locator('.pill')).toHaveCount(2);
    await expect(page.getByTestId('session-switcher')).toBeVisible();
    await expect(page.locator('.pill__branch')).toHaveText(['feat/a1', 'feat/b2']);
    // ...and time really did pass, so the assertions above proved something.
    expect(await page.locator('.pill__elapsed').allInnerTexts()).not.toEqual(ages);
  });

  test('has no way to raise itself, whatever an agent reports', async () => {
    /*
     * The rest of FR-019, asserted structurally because it is an absence: an
     * arriving `needs-you` is exactly the event that tempts an application to
     * demand attention, and the whole design says the window belongs to the
     * developer.
     *
     * One `show()` exists — the initial paint, deferred until `ready-to-show`
     * so the window never appears half-drawn. It is named, so a second call
     * site has to be argued for rather than merely added. Anything that
     * flashes, bounces, floats or focuses would land outside this list.
     */
    const root = fileURLToPath(new URL('../../src/main', import.meta.url));
    const DEMANDS = /\.(focus|moveTop|flashFrame|setAlwaysOnTop|restore|maximize|setVisibleOnAllWorkspaces)\s*\(/u;

    const offenders: string[] = [];
    const shows: string[] = [];

    for await (const file of glob('**/*.ts', { cwd: root })) {
      const source = readFileSync(`${root}/${file}`, 'utf8');
      const name = file.replaceAll('\\', '/');

      if (DEMANDS.test(source)) offenders.push(name);
      if (/\.show\s*\(/u.test(source)) shows.push(name);
    }

    expect(offenders).toEqual([]);
    expect(shows).toEqual(['window.ts']);
  });

  test('schedules nothing at all that could remove a session', async () => {
    /*
     * The other half of FR-017, and the half a wait cannot give: four seconds
     * proves nothing about a thirty-minute expiry. What is actually being
     * claimed is that no such thing is *scheduled*, so it is asserted over the
     * source of the process that holds the sessions.
     *
     * One timer exists in the main process — the transcript reader's debounce —
     * and it is named here so that a second one has to be argued for rather
     * than merely added.
     */
    const root = fileURLToPath(new URL('../../src/main', import.meta.url));
    const timers: string[] = [];

    for await (const file of glob('**/*.ts', { cwd: root })) {
      const source = readFileSync(`${root}/${file}`, 'utf8');
      if (/\bset(Interval|Timeout)\s*\(/u.test(source)) timers.push(file.replaceAll('\\', '/'));
    }

    expect(timers).toEqual(['transcript/index.ts']);
  });
});

test.describe('density never costs the ability to tell sessions apart', () => {
  test('drops the branch when the row is crowded and the repository is unique', async () => {
    const { page } = board;
    // Four sessions, every repository name distinct.
    for (const [repo, id] of [
      [REPO_A, 's0'],
      [REPO_B, 's1'],
      [`${process.cwd()}/packages`, 's2'],
      [`${process.cwd()}/specs`, 's3'],
    ] as const) {
      await declare(repo, id);
    }

    await expect(page.locator('.pill')).toHaveCount(4);
    // The repository name alone tells them apart, so the branch is the thing
    // that goes when space runs out.
    await expect(page.locator('.pill__branch')).toHaveCount(0);
    // `CoCoPilot` is this checkout's directory name, not the product's — the
    // repository was never renamed alongside the product, so do not "correct"
    // it to CoCoapilot. It comes from `process.cwd()` via REPO_A.
    await expect(page.locator('.pill__repo')).toHaveText([
      'CoCoPilot',
      'apps',
      'packages',
      'specs',
    ]);
  });

  test('keeps the branch on sessions that share a repository, however crowded', async () => {
    /*
     * FR-005 outranks the density rule, and this is the case that makes them
     * disagree — named in the spec's own edge cases: two sessions in the same
     * repository on different branches. The plan's rule (drop the branch past
     * two sessions) would draw two identical pills here.
     */
    const { page } = board;
    await declare(REPO_A, 's0');
    await declare(REPO_A, 's1');
    await declare(REPO_B, 's2');
    await declare(`${process.cwd()}/packages`, 's3');

    await expect(page.locator('.pill')).toHaveCount(4);
    // Only the two sharing `CoCoPilot` — this checkout's directory — keep theirs.
    await expect(page.locator('.pill__branch')).toHaveText(['feat/s0', 'feat/s1']);

    // And they are genuinely separable, not merely different-looking.
    await pill(1).locator('.pill__select').click();
    await expect(page.getByTestId('task-T-s1')).toBeVisible();
    await expect(page.getByTestId('task-T-s0')).toHaveCount(0);
  });
});

test('holds no session across a restart', async () => {
  // FR-020 and SC-010. The store is in memory and the process exiting is the
  // whole of the retention policy — the same reason notes do not survive.
  await declare(REPO_A, 'a1');
  await declare(REPO_B, 'b2');
  await expect(board.page.locator('.pill')).toHaveCount(2);

  await board.close();
  board = await launchBoard();

  await expect(board.page.getByTestId('session-switcher')).toHaveCount(0);
  // Nothing held at all: the waiting state, not a board with one session left.
  await expect(board.page.getByTestId('waiting-state')).toBeVisible();
});

test.describe('what switching does to the rest of the window', () => {
  test('does not raise an unread mark for notes the developer never missed', async () => {
    /*
     * The interaction feature 007 wrote a defensive line for and could not
     * reach: the unread rule compares the note count against what was last
     * seen, and that count belongs to whichever session is *selected*. Switching
     * from a busy session to a quiet one makes it drop.
     *
     * Without the guard the dot appears for a note nobody wrote — and worse,
     * never clears, because visiting the tab only ever records a count that is
     * already lower.
     */
    const { page } = board;
    await declare(REPO_A, 'a1');
    await declare(REPO_B, 'b2');

    // The first session accumulates notes; the developer reads them.
    for (let i = 0; i < 5; i += 1) {
      await board.note({ ...envelope({ repo: REPO_A, sessionId: 'a1' }), text: `Note ${i}` });
    }
    await page.getByTestId('tab-notes').click();
    await expect(page.locator('.noterow')).toHaveCount(5);
    await page.getByTestId('tab-overview').click();
    await expect(page.getByTestId('tab-notes-unread')).toHaveCount(0);

    // Switch to the quiet one: no notes at all, so no notes tab either.
    await pill(1).locator('.pill__select').click();
    await expect(page.getByTestId('tab-notes')).toHaveCount(0);

    // One genuine note for the quiet session, read where the developer is not.
    await board.note({ ...envelope({ repo: REPO_B, sessionId: 'b2' }), text: 'The first here' });
    await expect(page.getByTestId('tab-notes-unread')).toBeVisible();

    // Read it, and it clears -- rather than being stuck behind a count from the
    // other session.
    await page.getByTestId('tab-notes').click();
    await expect(page.locator('.noterow')).toHaveCount(1);
    await expect(page.getByTestId('tab-notes-unread')).toHaveCount(0);

    // And back to the busy session, whose five notes are still its own.
    await pill(0).locator('.pill__select').click();
    await expect(page.locator('.noterow')).toHaveCount(5);
  });
});
