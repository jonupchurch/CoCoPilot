import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { glob } from 'node:fs/promises';

import { envelope, keepOldViews, launchBoard, type Board } from './board.js';

/**
 * SC-008 and FR-020: the detail views cannot send anything anywhere.
 *
 * This is an **absence** test, and absence is only ever proved structurally.
 * "No approve button" is not a property of a rendered page — a page with no
 * button today grows one the day someone adds a reasonable-looking control to
 * the most detailed screen in the product. So there are three assertions here,
 * and they fail for three different reasons:
 *
 * 1. The bridge exposes five members, and each is named individually. Anything a
 *    view could call to reach the main process has to come through it.
 * 2. No source file in either view tree names a way of sending — `fetch`,
 *    `XMLHttpRequest`, `WebSocket`, `sendBeacon` — or reaches the bridge at all
 *    outside the one file that owns it.
 * 3. Every control in both views is activated, and the window issues zero
 *    outbound requests across the whole exercise.
 *
 * The third alone would pass on a build that simply had no controls yet; the
 * first two alone would pass on a build that sent something a way nobody
 * thought to grep for. Together they are worth having.
 */

let board: Board;

/** Requests the window makes on its own account, recorded from launch. */
let outbound: string[];

test.beforeEach(async () => {
  board = await launchBoard();
  outbound = [];

  // Everything the built app needs is on disk, so any http/ws request at all
  // is the finding — no allowlist to keep in step with the bundler.
  board.page.on('request', (request) => {
    const url = request.url();
    if (/^(https?|wss?):/u.test(url)) outbound.push(`${request.method()} ${url}`);
  });

  await board.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(900, 700);
  });
});

test.afterEach(async () => {
  await board.close();
});

const REPORT = {
  feature: { id: 'F-01', title: 'Session handling', specPath: 'specs/002/spec.md' },
  stories: [
    { id: 'US-002', title: 'Share one session fetch', priority: 'P1', status: 'active' },
    { id: 'US-004', title: 'Read the prompt history', status: 'todo' },
  ],
  tasks: [
    {
      id: 'T-011',
      title: 'Audit the three call sites',
      status: 'done',
      storyId: 'US-002',
      checks: ['Every call site is listed.'],
      files: ['src/routes/index.tsx'],
    },
    { id: 'T-013', title: 'Implement useSession', status: 'active', storyId: 'US-002' },
    { id: 'T-031', title: 'Expandable history rows', status: 'todo', storyId: 'US-004' },
    { id: 'T-099', title: 'Belongs to nothing', status: 'todo' },
  ],
  focus: { task: 'T-013', note: 'Writing the hook.', chip: 'watching' },
};

test('the bridge is two reads, three writes, and nothing else', async () => {
  const surface = await board.page.evaluate(() => {
    const api = (window as unknown as { cocoapilot: Record<string, unknown> }).cocoapilot;
    return Object.keys(api).sort();
  });

  /*
   * This list was `['getState', 'subscribe']` until feature 008, with a note
   * saying a third member should fail here and be argued for. It did, and here
   * is the argument.
   *
   * FR-012 requires a control that clears the board's copy of a session, and
   * the store lives in the main process — there is no version of that feature
   * without a write. So the property this test protects was restated rather
   * than the test being loosened, and it is the one that was always the real
   * one: **the window may change what it is showing and what this board holds,
   * and still send nothing to any agent.**
   *
   * `select` and `dismiss` do not leave the process. No agent can observe that
   * either happened; a dismissed session is not told and keeps working. The
   * outbound-request assertion below is what holds that line, and it covers
   * both of these as well as everything else.
   *
   * **`openLink` is the fourth member, and it is the one that breaks the "does
   * not leave the process" half of that sentence** — deliberately, and it is
   * feature 010's FR-019. Here is that argument.
   *
   * It hands a URL to the operating system's URL handler, and that is the whole
   * of what it does. The property being protected is unchanged, because it was
   * never "the window sends nothing": it was *nothing reaches an agent, and this
   * application makes no request of its own*. Both still hold. The board does
   * not fetch the address, resolve a redirect, or render a preview, and the
   * outbound-request assertion below covers this member exactly as it covers the
   * other three — a browser opening is not this process making a request.
   *
   * What makes it acceptable rather than merely explained: `main/links.ts`
   * parses the address and requires the protocol to be exactly `http:` or
   * `https:` before `shell.openExternal` sees it, so a renderer full of
   * agent-composed text cannot reach `file:`, `javascript:` or a registered
   * application handler however it is compromised. The renderer runs the same
   * rule first, but only so that no control is drawn for an address that would
   * be dropped; the main-process check is the one that counts.
   *
   * Still named individually. A fifth member should fail here too.
   */
  expect(surface).toEqual(['dismiss', 'getState', 'openLink', 'select', 'subscribe']);
});

test('selecting and dismissing a session sends nothing outbound', async () => {
  // SC-005, and the reason the widened bridge is not a widened blast radius.
  const { page } = board;
  const repoB = `${process.cwd()}/apps`;

  await board.push({ ...envelope({ sessionId: 'a1' }), ...REPORT });
  await board.push({ ...envelope({ repo: repoB, sessionId: 'b2' }), ...REPORT });
  await expect(page.getByTestId('session-switcher')).toBeVisible();

  // Switch to it, switch back, then clear it — the whole of the feature's
  // write surface, exercised.
  const pills = page.locator('.pill');
  await expect(pills).toHaveCount(2);
  await pills.nth(1).locator('.pill__select').click();
  await pills.nth(0).locator('.pill__select').click();
  await pills.nth(1).locator('.pill__dismiss').click();
  await expect(page.getByTestId('session-switcher')).toHaveCount(0);

  expect(outbound).toEqual([]);
});

test('neither view tree contains a way to send anything', async () => {
  const root = fileURLToPath(new URL('../../src/renderer/src', import.meta.url));
  const SENDS = /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|navigator\.send/u;

  /*
   * **Every member named on the bridge, wherever it is named**, and `[?.]*`
   * rather than `\.` is the whole of what makes this test true.
   *
   * It read `\bcocoapilot\.(?!getState\b|subscribe\b)\w+` until feature 010, and
   * that pattern could not match the way this codebase has always called the
   * bridge: `window.cocoapilot?.select(key)`, with optional chaining, because
   * the bridge is absent outside Electron. So it was scanning for a syntax that
   * appears nowhere and passing on files that call `select` and `dismiss` — the
   * two members it was written to notice. Widened here, on the occasion of a
   * third write, rather than left agreeing with itself.
   */
  const MEMBER = /\bcocoapilot\s*[?.]*\.\s*(\w+)/gu;
  const KNOWN = new Set(['getState', 'subscribe', 'select', 'dismiss', 'openLink']);

  /*
   * One file may name a member, and it is the one that owns the bridge. Every
   * component reaches the operating system, the store and the selection through
   * the free functions there — which is what keeps "who can send what" a
   * question with one file for an answer rather than a grep.
   */
  const OWNER = 'state/useBoardState.ts';

  const offenders: string[] = [];
  let checked = 0;
  for await (const file of glob('{views,components,state,app}/**/*.{ts,tsx}', { cwd: root })) {
    if (/\.test\.tsx?$/u.test(file)) continue;

    checked += 1;
    const source = readFileSync(`${root}/${file}`, 'utf8');
    if (SENDS.test(source)) offenders.push(`${file}: can send`);

    for (const [, member] of source.matchAll(MEMBER)) {
      // `cocoapilot-contract` is a package name, not the bridge.
      if (member === undefined || member === 'contract') continue;
      if (file.replace(/\\/gu, '/') !== OWNER) {
        offenders.push(`${file}: reaches the bridge directly (${member})`);
      } else if (!KNOWN.has(member)) {
        offenders.push(`${file}: calls an unknown bridge member (${member})`);
      }
    }
  }

  expect(offenders).toEqual([]);
  // A glob that matched nothing would make every assertion above vacuous.
  expect(checked).toBeGreaterThan(20);
});

test('activating every control in both views sends nothing', async () => {
  const { page } = board;
  // Since feature 011 these two destinations leave when the Spec-Kit tree
  // arrives, unless the developer had already opened one. This test is about
  // what their controls do, so it takes the path of a developer who was there.
  await keepOldViews(board);
  await board.push({ ...envelope(), ...REPORT });

  // --- The Stories tab, wide: every row, and the detail each one produces.
  await page.getByTestId('tab-stories').click();
  await expect(page.getByTestId('stories')).toBeVisible();
  // Counted before looping. A `for` over an empty list is a test that clicks
  // nothing and passes, which is the failure mode of every absence test.
  await expect(page.locator('.storylist__row')).toHaveCount(3);
  for (const row of await page.locator('.storylist__row').all()) {
    await row.click();
    await expect(page.getByTestId('story-detail')).toBeVisible();
  }

  // --- The Stories tab, narrow: the picker, opened, dismissed, and used.
  await board.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(420, 700);
  });
  await expect(page.getByTestId('story-picker')).toBeVisible();
  await page.getByTestId('story-picker').click();
  await page.keyboard.press('Escape');
  await page.getByTestId('story-picker').click();
  await page.getByTestId('story-picker-option-US-004').click();

  // --- The Tasks tab, at both widths: every scope, and every task in each.
  await board.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(900, 700);
  });
  await page.getByTestId('tab-tasks').click();
  await expect(page.getByTestId('tasks')).toBeVisible();

  for (const [scope, rows] of [
    ['US-002', 2],
    ['US-004', 1],
    ['unassigned', 1],
  ] as const) {
    await page.getByTestId('scope-picker').click();
    await page.getByTestId(`scope-picker-option-${scope}`).click();

    await expect(page.locator('.tasklist__row')).toHaveCount(rows);
    for (const row of await page.locator('.tasklist__row').all()) {
      await row.click();
      await expect(page.getByTestId('task-detail')).toBeVisible();
    }
  }

  // --- And back to Overview, whose sections are the only other controls.
  await page.getByTestId('tab-overview').click();
  const toggles = page.locator('.section__header');
  expect(await toggles.count()).toBeGreaterThan(0);
  for (const toggle of await toggles.all()) {
    await toggle.click();
  }

  // A report arriving in the middle of all that changes nothing about it: the
  // views have no handler that could answer one.
  await board.push({ ...envelope(), ...REPORT, focus: { task: 'T-011', chip: 'needs-you' } });
  await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'needs-you');

  expect(outbound).toEqual([]);
});
