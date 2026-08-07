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
 * The absence test (SC-006).
 *
 * What is on screen changes because an agent caused it to. This is what catches
 * a polling loop, a staleness badge, or an automatic "looks stuck" state added
 * later as an apparent improvement — each of which looks like a feature and each
 * of which quietly deletes decision 12.
 */
test.describe('nothing changes on a timer', () => {
  test('only the elapsed counter moves while an agent is quiet', async () => {
    const { page } = board;

    await board.push({
      ...envelope(),
      focus: { task: 'T025', note: 'gone quiet on purpose', chip: 'watching' },
      tasks: [{ id: 'T025', title: 'A task', status: 'todo' }],
    });
    await expect(page.getByTestId('identity')).toBeVisible();

    const snapshot = async (): Promise<string> => {
      // Everything except the elapsed figure, which is supposed to advance.
      const html = await page.locator('.app').innerHTML();
      return html.replace(/heard \d+[smhd] ago/g, 'heard <elapsed> ago');
    };

    const before = await snapshot();
    const elapsedBefore = await page.getByTestId('elapsed').innerText();

    await page.waitForTimeout(4_000);

    expect(await snapshot()).toBe(before);
    // ...and it did advance, so the comparison above proved something.
    expect(await page.getByTestId('elapsed').innerText()).not.toBe(elapsedBefore);
  });

  test('the chip never moves on its own, at any duration', async () => {
    const { page } = board;

    await board.push({ ...envelope(), focus: { chip: 'watching' } });
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'watching');

    await page.waitForTimeout(4_000);

    // A healthy agent goes quiet for minutes during a typecheck. Elapsed time is
    // a fact; "stuck" is a guess, and the board never guesses.
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'watching');
    await expect(page.locator('.chip')).toHaveText('Watching');
  });

  test('the window issues no request of its own while idle', async () => {
    const { page } = board;
    await board.push(envelope());

    const requests: string[] = [];
    page.on('request', (request) => {
      requests.push(request.url());
    });

    await page.waitForTimeout(4_000);

    // The elapsed tick re-renders state the window already has. If it ever
    // reaches for the bridge, the window has started refreshing itself.
    expect(requests.filter((url) => !url.startsWith('devtools://'))).toEqual([]);
  });

  test('never describes the agent as stalled, stuck or failed', async () => {
    const { page } = board;
    await board.push({ ...envelope(), focus: { chip: 'thinking' } });

    await page.waitForTimeout(3_000);

    const text = await page.locator('.app').innerText();
    expect(text).not.toMatch(/stall|stuck|unresponsive|no response|failed|hung/i);
  });
});
