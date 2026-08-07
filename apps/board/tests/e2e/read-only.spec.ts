import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { glob } from 'node:fs/promises';

import { envelope, launchBoard, type Board } from './board.js';

/**
 * SC-008 and FR-020: the detail views cannot send anything anywhere.
 *
 * This is an **absence** test, and absence is only ever proved structurally.
 * "No approve button" is not a property of a rendered page — a page with no
 * button today grows one the day someone adds a reasonable-looking control to
 * the most detailed screen in the product. So there are three assertions here,
 * and they fail for three different reasons:
 *
 * 1. The bridge exposes two members, both of them reads. Anything a view could
 *    call to reach the main process has to come through it.
 * 2. No source file in either view tree names a way of sending — `fetch`,
 *    `XMLHttpRequest`, `WebSocket`, `sendBeacon`, or a bridge member that is
 *    not one of the two.
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

test('the bridge is two reads and nothing else', async () => {
  const surface = await board.page.evaluate(() => {
    const api = (window as unknown as { cocopilot: Record<string, unknown> }).cocopilot;
    return Object.keys(api).sort();
  });

  // Named individually rather than counted: a third member added later should
  // fail here and be argued for, whatever it is called.
  expect(surface).toEqual(['getState', 'subscribe']);
});

test('neither view tree contains a way to send anything', async () => {
  const root = fileURLToPath(new URL('../../src/renderer/src', import.meta.url));
  const SENDS = /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|navigator\.send/u;
  // The two members that exist. A call to anything else on the bridge would be
  // a channel this test has never heard of.
  const BRIDGE = /\bcocopilot\.(?!getState\b|subscribe\b)\w+/u;

  const offenders: string[] = [];
  for await (const file of glob('{views,components,state}/**/*.{ts,tsx}', { cwd: root })) {
    if (/\.test\.tsx?$/u.test(file)) continue;

    const source = readFileSync(`${root}/${file}`, 'utf8');
    if (SENDS.test(source)) offenders.push(`${file}: can send`);
    if (BRIDGE.test(source)) offenders.push(`${file}: calls an unknown bridge member`);
  }

  expect(offenders).toEqual([]);
});

test('activating every control in both views sends nothing', async () => {
  const { page } = board;
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
