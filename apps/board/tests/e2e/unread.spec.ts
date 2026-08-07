import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

/**
 * The unread mark: a note arrived while the developer was looking elsewhere.
 *
 * The whole of US3 is that this is noticeable and **nothing more**. Every test
 * here is as much about what does not happen — no count, no focus change, no
 * window raised, no sound — as about the dot appearing, because the failure
 * this feature can actually cause is being annoying rather than being wrong.
 */

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
});

test.afterEach(async () => {
  await board.close();
});

/** A report first, so there is an Overview tab to be standing on. */
async function session(): Promise<void> {
  await board.push({
    ...envelope(),
    tasks: [{ id: 'T-011', title: 'A task', status: 'active' }],
  });
  await expect(board.page.getByTestId('overview')).toBeVisible();
}

async function record(text: string): Promise<void> {
  await board.note({ ...envelope(), text });
}

test('appears on the notes tab when a note arrives from another view', async () => {
  await session();
  await record('Something worth knowing.');

  await expect(board.page.getByTestId('tab-notes-unread')).toBeVisible();
  await expect(board.page.getByTestId('tab-notes')).toHaveAttribute('data-unread', 'true');
});

test('carries no count, however many arrive', async () => {
  // FR-012, asserted on the tab's *text* rather than on the absence of some
  // particular badge element: a number rendered anywhere in the tab would read
  // as an inbox with something to clear, and there is nothing to clear.
  await session();
  for (let i = 0; i < 7; i += 1) await record(`Note ${i}`);

  await expect(board.page.getByTestId('tab-notes-unread')).toBeVisible();
  await expect(board.page.getByTestId('tab-notes')).toHaveText('Notesnew');
  expect(await board.page.getByTestId('tab-notes').innerText()).not.toMatch(/\d/u);
});

test('clears when the notes view is opened, and stays clear', async () => {
  await session();
  await record('A note');
  await expect(board.page.getByTestId('tab-notes-unread')).toBeVisible();

  await board.page.getByTestId('tab-notes').click();
  await expect(board.page.getByTestId('tab-notes-unread')).toHaveCount(0);

  // And going elsewhere afterwards does not bring it back: it marks arrivals,
  // not unvisited tabs.
  await board.page.getByTestId('tab-overview').click();
  await expect(board.page.getByTestId('tab-notes-unread')).toHaveCount(0);
});

test('never appears while the notes view is the one being read', async () => {
  // US3 scenario 4. A dot on the tab you are looking at is noise about
  // something already on screen.
  await session();
  await record('First');
  await board.page.getByTestId('tab-notes').click();
  await expect(board.page.getByTestId('notes')).toBeVisible();

  await record('Second');
  await expect(board.page.locator('.noterow')).toHaveCount(2);

  await expect(board.page.getByTestId('tab-notes-unread')).toHaveCount(0);
});

test('appears again for the next note after a visit', async () => {
  await session();
  await record('First');
  await board.page.getByTestId('tab-notes').click();
  await board.page.getByTestId('tab-overview').click();
  await expect(board.page.getByTestId('tab-notes-unread')).toHaveCount(0);

  await record('Second');
  await expect(board.page.getByTestId('tab-notes-unread')).toBeVisible();
});

test('does not steal focus, raise the window, or move it', async () => {
  // FR-014 and SC-005. The window belongs to the developer — feature 003's
  // rule, and an arriving note is exactly the kind of event that tempts an app
  // to break it.
  await session();

  // `isFocused()` is deliberately not among these: focus belongs to the window
  // manager, so comparing it asserts the environment rather than the app. The
  // app-raises-itself half is covered structurally in `sessions.spec.ts`, which
  // asserts the main process calls nothing that focuses, flashes or floats.
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

  await record('A note that must not demand anything.');
  await expect(board.page.getByTestId('tab-notes-unread')).toBeVisible();

  expect(await state()).toEqual(before);
  // And the developer was not moved off the view they were reading.
  await expect(board.page.getByTestId('body')).toHaveAttribute('data-tab', 'overview');
});
