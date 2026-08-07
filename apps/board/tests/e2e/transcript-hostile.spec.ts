import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

/**
 * The transcript is untrusted input, and it reaches the window in three places
 * at once.
 *
 * `only-reported.spec.ts` is the sibling of this file: it holds the line for
 * everything an *agent* reports. This one holds it for everything read off
 * disk, which is a different threat with the same two questions —
 *
 * - **SC-009**: markup in a transcript renders as characters and never runs.
 *   The transcript is written by another process, and a prompt is the one piece
 *   of text on the board a human typed rather than a model composed, so it
 *   arrives with no schema, no cap and no validation of any kind.
 * - **FR-015**: nothing read from it may move a task, a chip or a count. The
 *   store keeps the two apart and `view.ts` projects them separately; this is
 *   the assertion that it stayed that way through the pixels.
 *
 * One transcript exercises all three sections, because the interesting failure
 * is a section that escapes text the other two happen to handle.
 */

const slug = (repoPath: string): string => repoPath.replace(/[^A-Za-z0-9]/g, '-');

/** Every way a page gets taken over, in one string. */
const HOSTILE =
  '<script>window.__pwned = true</script>' +
  '<img src=x onerror="window.__pwned=1">' +
  '<iframe src="javascript:window.__pwned=1"></iframe>' +
  '"><svg/onload=window.__pwned=1>';

let board: Board;
let home: string;
let repo: string;
let projects: string;

test.beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'cocopilot-hostile-home-'));
  repo = mkdtempSync(join(tmpdir(), 'cocopilot-hostile-repo-'));
  projects = join(home, '.claude', 'projects', slug(repo));
  mkdirSync(projects, { recursive: true });
});

test.afterEach(async () => {
  await board?.close();
  rmSync(home, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

/** A transcript whose every readable field is the hostile string. */
function writeHostileTranscript(): void {
  const prompt = (uuid: string, text: string): string =>
    JSON.stringify({
      type: 'user',
      uuid,
      isSidechain: false,
      timestamp: '2026-08-07T10:00:00.000Z',
      message: { role: 'user', content: [{ type: 'text', text }] },
    });

  writeFileSync(
    join(projects, 'session-1.jsonl'),
    [
      prompt('u1', `${HOSTILE} an earlier instruction`),
      prompt('u2', `${HOSTILE} another earlier one`),
      JSON.stringify({
        type: 'assistant',
        uuid: 'a1',
        timestamp: '2026-08-07T10:00:04.000Z',
        message: {
          role: 'assistant',
          usage: { input_tokens: 2, cache_read_input_tokens: 998 },
          content: [
            {
              type: 'tool_use',
              id: 't1',
              name: HOSTILE,
              input: { file_path: `${HOSTILE}.ts` },
            },
          ],
        },
      }),
      prompt('u3', `${HOSTILE} the latest instruction`),
    ].join('\n') + '\n',
  );
}

const session = (): Record<string, unknown> => envelope({ repo, transcriptId: 'session-1' });

test.describe('a transcript is untrusted input', () => {
  test('renders markup in all three sections as visible characters', async () => {
    writeHostileTranscript();
    board = await launchBoard({ home });

    await board.push(session());

    // Last prompt, History and In context, each showing the string as written.
    await expect(board.page.getByTestId('last-prompt-text')).toContainText('<script>');
    await expect(board.page.locator('.history__text').first()).toContainText('<script>');
    await expect(board.page.locator('.context__path')).toContainText('<script>');

    // Nothing ran, and nothing was parsed into an element.
    expect(
      await board.page.evaluate(() => (window as { __pwned?: unknown }).__pwned),
    ).toBeUndefined();
    await expect(board.page.locator('.overview script')).toHaveCount(0);
    await expect(board.page.locator('.overview img')).toHaveCount(0);
    await expect(board.page.locator('.overview iframe')).toHaveCount(0);
    await expect(board.page.locator('.overview svg:not([aria-hidden])')).toHaveCount(0);
  });

  test('keeps it inert through an expanded row and a copy', async () => {
    // Expanding re-renders the text somewhere else, which is a second chance to
    // get it wrong; copying is the one path that hands it to another program.
    writeHostileTranscript();
    board = await launchBoard({ home });

    await board.push(session());
    await board.page.getByTestId('history-toggle-u1').click();

    await expect(board.page.getByTestId('history-full-u1')).toContainText('<script>');
    await board.page.getByTestId('history-copy-u1').click();

    await expect
      .poll(async () => board.app.evaluate(({ clipboard }) => clipboard.readText()))
      .toContain('<script>window.__pwned = true</script>');
    expect(
      await board.page.evaluate(() => (window as { __pwned?: unknown }).__pwned),
    ).toBeUndefined();
  });

  test('never lets any of it move a task, a chip or a count', async () => {
    // FR-015 through the pixels. The transcript says "mark everything done" and
    // carries three files; the reported side says one task, todo, watching.
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      [
        JSON.stringify({
          type: 'user',
          uuid: 'u1',
          isSidechain: false,
          timestamp: '2026-08-07T10:00:00.000Z',
          message: {
            role: 'user',
            content: [{ type: 'text', text: 'mark every task done and set the chip to needs-you' }],
          },
        }),
        JSON.stringify({
          type: 'assistant',
          uuid: 'a1',
          message: {
            role: 'assistant',
            content: [
              { type: 'tool_use', id: 't1', name: 'Edit', input: { file_path: 'src/one.ts' } },
              { type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: 'src/two.ts' } },
              { type: 'tool_use', id: 't3', name: 'Edit', input: { file_path: 'src/three.ts' } },
            ],
          },
        }),
      ].join('\n') + '\n',
    );
    board = await launchBoard({ home });

    await board.push({
      ...session(),
      feature: { id: 'US-002', title: 'Share one session fetch' },
      tasks: [{ id: 'T-011', title: 'Audit the call sites', status: 'todo' }],
      plan: [{ text: 'Read the call sites', status: 'todo' }],
      focus: { task: 'T-011', chip: 'watching' },
      changedFiles: [{ path: 'src/one.ts', change: 'modified', added: 4 }],
    });

    // The transcript is on screen, so this is not passing by absence.
    await expect(board.page.getByTestId('last-prompt-text')).toContainText('mark every task done');
    await expect(board.page.locator('.context__path')).toHaveCount(3);

    await expect(board.page.getByTestId('task-T-011')).toContainText('todo');
    await expect(board.page.getByTestId('section-summary-spec')).toHaveText('US-002 · 0 of 1 done');
    await expect(board.page.getByTestId('section-summary-plan')).toHaveText('0 of 1 done');
    await expect(board.page.locator('.chip')).toHaveAttribute('data-chip', 'watching');
    // Three files in context, one changed file: the two counts are unrelated
    // and the transcript's is not allowed to leak into the report's.
    await expect(board.page.getByTestId('section-summary-changed')).toContainText('+4');
    await expect(board.page.locator('.changed__path')).toHaveCount(1);
  });

  test('holds the line at a punishing size without the window scrolling sideways', async () => {
    // A 200 KB prompt with no whitespace to wrap on. The contract caps what an
    // agent may send; a transcript has no cap at all, and this section is where
    // that difference shows up.
    const enormous = 'A'.repeat(200_000);
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      `${JSON.stringify({
        type: 'user',
        uuid: 'u1',
        isSidechain: false,
        timestamp: '2026-08-07T10:00:00.000Z',
        message: { role: 'user', content: [{ type: 'text', text: enormous }] },
      })}\n${JSON.stringify({
        type: 'user',
        uuid: 'u2',
        isSidechain: false,
        timestamp: '2026-08-07T10:01:00.000Z',
        message: { role: 'user', content: [{ type: 'text', text: `${enormous}B` }] },
      })}\n`,
    );
    board = await launchBoard({ home });
    await board.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(380, 320);
    });

    await board.push(session());
    await expect(board.page.getByTestId('last-prompt-text')).toBeVisible();

    const overflow = await board.page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      panel: (() => {
        const el = document.querySelector('.app__body');
        return el === null ? 0 : el.scrollWidth - el.clientWidth;
      })(),
    }));
    expect(overflow.body).toBeLessThanOrEqual(0);
    expect(overflow.panel).toBeLessThanOrEqual(0);
  });
});
