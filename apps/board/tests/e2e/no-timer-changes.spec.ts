import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

let board: Board;
let home: string;
let repo: string;

/**
 * Every test here runs with a real transcript in place.
 *
 * It did not, until feature 005 put two transcript-fed sections on the Overview
 * — and with the harness pointing at an empty home, both of them rendered as
 * "unavailable" and the History rows that tick were never on screen at all. The
 * absence test would have kept passing while the values it exists to watch went
 * unwatched.
 */
test.beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'cocoapilot-timer-home-'));
  repo = mkdtempSync(join(tmpdir(), 'cocoapilot-timer-repo-'));
  const projects = join(home, '.claude', 'projects', repo.replace(/[^A-Za-z0-9]/g, '-'));
  mkdirSync(projects, { recursive: true });

  const at = Date.now();
  writeFileSync(
    join(projects, 'session-1.jsonl'),
    Array.from({ length: 3 }, (_, i) =>
      JSON.stringify({
        type: 'user',
        uuid: `u${i}`,
        isSidechain: false,
        timestamp: new Date(at - (3 - i) * 1_000).toISOString(),
        message: { role: 'user', content: [{ type: 'text', text: `Prompt number ${i}` }] },
      }),
    ).join('\n').concat('\n'),
  );

  board = await launchBoard({ home });
});

test.afterEach(async () => {
  await board.close();
  rmSync(home, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

/** An envelope pointing at this file's repository and transcript. */
const reporting = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  ...envelope({ repo, transcriptId: 'session-1' }),
  ...overrides,
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

    await board.push(
      reporting({
        focus: { task: 'T025', note: 'gone quiet on purpose', chip: 'watching' },
        tasks: [{ id: 'T025', title: 'A task', status: 'todo' }],
      }),
    );
    await expect(page.getByTestId('identity')).toBeVisible();
    // The rows whose ages tick are actually on screen, so the snapshot below is
    // comparing something.
    await expect(page.locator('.history__age')).toHaveCount(2);

    /**
     * Everything except the elapsed figures, which are supposed to advance.
     *
     * The exemption is a list of specific elements rather than a pattern applied
     * to the whole tree, which is what keeps the test honest: a new counter, a
     * staleness badge or an age-driven class lands outside the list and fails
     * here. Feature 004 added three entries to it, deliberately and visibly;
     * feature 005 added the History row ages, the same way.
     */
    const snapshot = async (): Promise<string> =>
      page.evaluate(() => {
        const root = document.querySelector('.app')?.cloneNode(true) as HTMLElement;
        const allowedToTick = [
          '[data-testid="elapsed"]', // the title bar
          '[data-testid="focus-elapsed"]', // the Focus card
          '[data-testid^="task-elapsed-"]', // the focused task row
          '[data-testid="section-summary-focus"]', // the Focus header summary
          '[data-testid^="history-age-"]', // how long ago each earlier prompt
          '[data-testid="section-summary-last-prompt"]', // how long ago the latest one
        ].join(',');

        for (const el of root.querySelectorAll(allowedToTick)) {
          el.textContent = (el.textContent ?? '').replace(/\b\d+[smhd]\b/g, '<elapsed>');
        }
        return root.innerHTML;
      });

    const before = await snapshot();
    const elapsedBefore = await page.getByTestId('elapsed').innerText();

    await page.waitForTimeout(4_000);

    expect(await snapshot()).toBe(before);
    // ...and it did advance, so the comparison above proved something.
    expect(await page.getByTestId('elapsed').innerText()).not.toBe(elapsedBefore);
  });

  test('the chip never moves on its own, at any duration', async () => {
    const { page } = board;

    await board.push({ ...reporting(), focus: { chip: 'watching' } });
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'watching');

    await page.waitForTimeout(4_000);

    // A healthy agent goes quiet for minutes during a typecheck. Elapsed time is
    // a fact; "stuck" is a guess, and the board never guesses.
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'watching');
    await expect(page.locator('.chip')).toHaveText('Watching');
  });

  test('the window issues no request of its own while idle', async () => {
    const { page } = board;
    await board.push(reporting());

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
    await board.push({ ...reporting(), focus: { chip: 'thinking' } });

    await page.waitForTimeout(3_000);

    const text = await page.locator('.app').innerText();
    expect(text).not.toMatch(/stall|stuck|unresponsive|no response|failed|hung/i);
  });
});
