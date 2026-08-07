import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { glob } from 'node:fs/promises';

import { envelope, launchBoard, type Board } from './board.js';

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
});

test.afterEach(async () => {
  await board.close();
});

const HOSTILE = '<script>window.__pwned = true</script><img src=x onerror="window.__pwned = true">';

/** The absence test for SC-009. */
test.describe('agent text is inert', () => {
  test('renders markup as visible characters and executes none of it', async () => {
    const { page } = board;

    await board.push({
      ...envelope({ branch: HOSTILE }),
      focus: { note: HOSTILE, chip: 'watching' },
      tasks: [{ id: 'T001', title: HOSTILE, status: HOSTILE }],
    });
    // Same envelope: a note carries a branch too, and one with the default
    // would overwrite the hostile branch this test is checking.
    await board.note({ ...envelope({ branch: HOSTILE }), text: HOSTILE });

    await expect(page.getByTestId('identity')).toContainText('<script>');
    expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined();
    // Nothing was parsed as markup, so no element from it exists.
    await expect(page.locator('img')).toHaveCount(0);
  });

  test('has no dangerouslySetInnerHTML anywhere in the renderer', async () => {
    const root = fileURLToPath(new URL('../../src/renderer', import.meta.url));

    const offenders: string[] = [];
    for await (const file of glob('**/*.{ts,tsx}', { cwd: root })) {
      const source = readFileSync(`${root}/${file}`, 'utf8');
      if (source.includes('dangerouslySetInnerHTML')) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });
});

test.describe('the window belongs to the developer', () => {
  test('does not change its own width when views are switched', async () => {
    const { page, app } = board;

    await board.push({
      ...envelope(),
      tasks: [{ id: 'T001', title: 'A task', status: 'todo' }],
    });
    await board.note({ ...envelope(), text: 'a note' });

    const width = async (): Promise<number> =>
      app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBounds().width ?? 0);

    const before = await width();
    await page.getByTestId('tab-tasks').click();
    expect(await width()).toBe(before);
    await page.getByTestId('tab-notes').click();
    expect(await width()).toBe(before);
  });

  test('honours a resize and keeps it across views', async () => {
    const { page, app } = board;
    await board.push({
      ...envelope(),
      tasks: [{ id: 'T001', title: 'A task', status: 'todo' }],
    });

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(560, 500);
    });
    await page.getByTestId('tab-tasks').click();

    const bounds = await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBounds(),
    );
    expect(bounds?.width).toBe(560);
  });

  test('enforces a minimum rather than allowing an unusable window', async () => {
    const { app } = board;

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(120, 100);
    });

    const bounds = await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBounds(),
    );
    expect(bounds?.width).toBeGreaterThanOrEqual(380);
    expect(bounds?.height).toBeGreaterThanOrEqual(320);
  });

  test('never scrolls sideways, even at the minimum width with long content', async () => {
    const { page, app } = board;

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(380, 320);
    });
    await board.push({
      ...envelope({
        repo: process.cwd(),
        branch: 'feature/a-quite-unreasonably-long-branch-name-that-nobody-would-choose',
      }),
      tasks: [{ id: 'T001', title: 'A task', status: 'todo' }],
    });

    await expect(page.getByTestId('identity')).toBeVisible();
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      app: (() => {
        const el = document.querySelector('.app');
        return el === null ? 0 : el.scrollWidth - el.clientWidth;
      })(),
    }));

    expect(overflow.body).toBeLessThanOrEqual(0);
    expect(overflow.app).toBeLessThanOrEqual(0);
  });

  test('leaves the developer where they were when a report arrives', async () => {
    const { page } = board;

    await board.push({
      ...envelope(),
      tasks: [{ id: 'T001', title: 'A task', status: 'todo' }],
    });
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('body')).toHaveAttribute('data-tab', 'tasks');

    await board.push({
      ...envelope(),
      focus: { chip: 'needs-you' },
      tasks: [{ id: 'T002', title: 'Another task', status: 'done' }],
    });

    // The chip changed, so the report definitely landed -- and the view did not.
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'needs-you');
    await expect(page.getByTestId('body')).toHaveAttribute('data-tab', 'tasks');
  });
});
