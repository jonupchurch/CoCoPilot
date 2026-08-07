import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

const FIXTURES = fileURLToPath(new URL('../fixtures/transcripts/', import.meta.url));

/**
 * The slug rule, applied to whatever temporary repository path a test invents:
 * every character that is not alphanumeric becomes a hyphen.
 */
const slug = (repoPath: string): string => repoPath.replace(/[^A-Za-z0-9]/g, '-');

let board: Board;
let home: string;
let repo: string;
let projects: string;

/** Put a fixture in place as the transcript for `transcriptId`. */
function install(fixture: string, transcriptId: string): string {
  const path = join(projects, `${transcriptId}.jsonl`);
  copyFileSync(join(FIXTURES, fixture), path);
  return path;
}

/**
 * The same, with `REPO/` replaced by this test's temporary repository.
 *
 * The transcript records absolute paths, and the section shows them relative to
 * the repository it was told about — which cannot be asserted at all unless the
 * two actually agree. Forward slashes throughout: the comparison normalises
 * separators, so the fixture stays readable on every platform.
 */
function installUnder(fixture: string, transcriptId: string): string {
  const path = join(projects, `${transcriptId}.jsonl`);
  const text = readFileSync(join(FIXTURES, fixture), 'utf8');
  writeFileSync(path, text.replaceAll('REPO/', `${repo.replaceAll('\\', '/')}/`));
  return path;
}

test.beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'cocoapilot-e2e-home-'));
  repo = mkdtempSync(join(tmpdir(), 'cocoapilot-e2e-repo-'));
  projects = join(home, '.claude', 'projects', slug(repo));
  mkdirSync(projects, { recursive: true });
});

test.afterEach(async () => {
  await board?.close();
  rmSync(home, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

/** An envelope pointing at this test's repository and transcript. */
const session = (transcriptId: string | null = 'session-1'): Record<string, unknown> =>
  envelope({ repo, transcriptId });

test.describe('the last prompt', () => {
  test('shows the most recent prompt from the transcript', async () => {
    install('typical.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());

    // The second prompt in the file, not the first, and not a `last-prompt`
    // record -- of which the fixture has one, pointing at the *earlier* prompt.
    await expect(board.page.getByTestId('last-prompt-text')).toHaveText(
      'Why does the route rerender on every keystroke?',
    );
  });

  test('shows no tool output, whatever the record types say', async () => {
    // Ten user records, three prompts. If the board is counting record types,
    // "ok" and "12 passed" appear here as things the developer typed.
    install('tool-results.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.getByTestId('last-prompt-text')).toHaveText('Good. Commit that.');
    await expect(board.page.getByTestId('overview')).not.toContainText('12 passed');
  });

  test('updates as the transcript grows, with no developer action', async () => {
    const path = install('typical.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());
    await expect(board.page.getByTestId('last-prompt-text')).toContainText('rerender');

    writeFileSync(
      path,
      `${JSON.stringify({
        type: 'user',
        uuid: 'u9',
        isSidechain: false,
        timestamp: '2026-08-07T11:00:00.000Z',
        message: { role: 'user', content: [{ type: 'text', text: 'And now deploy it' }] },
      })}\n`,
      { flag: 'a' },
    );

    await expect(board.page.getByTestId('last-prompt-text')).toHaveText('And now deploy it');
  });

  test('keeps a prompt containing markup as visible characters', async () => {
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      `${JSON.stringify({
        type: 'user',
        uuid: 'u1',
        isSidechain: false,
        timestamp: '2026-08-07T10:00:00.000Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: '<script>window.__pwned = true</script> fix the bug' }],
        },
      })}\n`,
    );
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.getByTestId('last-prompt-text')).toContainText('<script>');
    expect(
      await board.page.evaluate(() => (window as { __pwned?: boolean }).__pwned),
    ).toBeUndefined();
  });
});

test.describe('unavailable is not empty', () => {
  test('says unavailable when no transcript exists for the session', async () => {
    board = await launchBoard({ home });

    await board.push(session('missing-session'));

    await expect(board.page.getByTestId('last-prompt-unavailable')).toBeVisible();
    await expect(board.page.getByTestId('last-prompt-none')).toHaveCount(0);
    await expect(board.page.getByTestId('section-summary-last-prompt')).toHaveText('unavailable');
  });

  test('says unavailable rather than showing garbled content', async () => {
    install('garbage.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());

    // Every line fails to parse, so there are no prompts -- reported as empty
    // rather than as an error, because the file was read fine. What matters is
    // that none of its content reached the screen.
    await expect(board.page.getByTestId('overview')).not.toContainText('a proxy error page');
    await expect(board.page.getByTestId('last-prompt-text')).toHaveCount(0);
  });

  test('distinguishes a session with no prompts from one it could not read', async () => {
    // SC-006: the two states must be visibly different, not merely worded
    // differently. Empty is bare text; unavailable is a bordered block in a
    // heavier ink.
    install('garbage.jsonl', 'has-file');
    board = await launchBoard({ home });
    await board.push(session('has-file'));

    const emptyState = board.page.getByTestId('last-prompt-none');
    await expect(emptyState).toBeVisible();
    const empty = await emptyState.evaluate((el) => {
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, border: style.borderTopStyle, ink: style.color };
    });

    await board.close();

    board = await launchBoard({ home });
    await board.push({ ...session('absent'), sessionId: 'other' });

    const failed = board.page.getByTestId('last-prompt-unavailable');
    await expect(failed).toBeVisible();
    const unavailable = await failed.evaluate((el) => {
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, border: style.borderTopStyle, ink: style.color };
    });

    expect(unavailable.background).not.toBe(empty.background);
    expect(unavailable.border).not.toBe(empty.border);
    expect(unavailable.ink).not.toBe(empty.ink);
  });

  test('keeps the two apart when the section is collapsed', async () => {
    // The case the body treatment cannot cover. Collapsed, the body is
    // unmounted and the summary is the whole section — so "unavailable" and
    // "none yet" were the same muted mono text in the same place, and a failed
    // read looked exactly like a session that had not been asked anything yet.
    install('garbage.jsonl', 'has-file');
    board = await launchBoard({ home });
    await board.push(session('has-file'));

    await board.page.getByTestId('section-toggle-last-prompt').click();
    await expect(board.page.getByTestId('last-prompt-none')).toHaveCount(0);
    const emptySummary = await board.page
      .getByTestId('section-summary-last-prompt')
      .evaluate((el) => getComputedStyle(el).color);

    await board.close();

    board = await launchBoard({ home });
    await board.push({ ...session('absent'), sessionId: 'other' });

    await board.page.getByTestId('section-toggle-last-prompt').click();
    await expect(board.page.getByTestId('last-prompt-unavailable')).toHaveCount(0);

    const marked = board.page.getByTestId('last-prompt-summary-unavailable');
    await expect(marked).toBeVisible();
    const failedSummary = await marked.evaluate((el) => {
      const style = getComputedStyle(el);
      return { ink: style.color, border: style.borderBottomStyle };
    });

    expect(failedSummary.ink).not.toBe(emptySummary);
    expect(failedSummary.border).toBe('dashed');
  });
});

/**
 * A transcript of `count` prompts, oldest first, one minute apart and ending
 * `count` minutes ago — so every row has a distinct, predictable age.
 */
function prompts(count: number, at = Date.now()): string {
  return Array.from({ length: count }, (_, i) => {
    const minutes = count - i;
    return `${JSON.stringify({
      type: 'user',
      uuid: `u${i}`,
      isSidechain: false,
      timestamp: new Date(at - minutes * 60_000).toISOString(),
      message: { role: 'user', content: [{ type: 'text', text: `Prompt number ${i}` }] },
    })}\n`;
  }).join('');
}

test.describe('earlier prompts', () => {
  test('lists them newest first, with how long ago each was given', async () => {
    writeFileSync(join(projects, 'session-1.jsonl'), prompts(4));
    board = await launchBoard({ home });

    await board.push(session());

    // Four prompts: the newest is the card above, so three are "earlier", and
    // they run backwards from there.
    await expect(board.page.locator('.history__text')).toHaveText([
      'Prompt number 2',
      'Prompt number 1',
      'Prompt number 0',
    ]);
    await expect(board.page.locator('.history__age')).toHaveText(['2m', '3m', '4m']);
    await expect(board.page.getByTestId('section-summary-history')).toHaveText('3');
  });

  test('never repeats the prompt shown in the card above it', async () => {
    install('typical.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.getByTestId('last-prompt-text')).toHaveText(
      'Why does the route rerender on every keystroke?',
    );
    await expect(board.page.locator('.history__text')).toHaveText([
      'Pull the repeated session fetch out of the three route components and give me a hook. Keep the existing error handling.',
    ]);
  });

  test('expands a row in place to its full untruncated text', async () => {
    const long = 'Rework the reducer.\n\nCover the refresh race, and the logout-during-refresh case.';
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      `${JSON.stringify({
        type: 'user',
        uuid: 'u0',
        isSidechain: false,
        timestamp: '2026-08-07T10:00:00.000Z',
        message: { role: 'user', content: [{ type: 'text', text: long }] },
      })}\n${JSON.stringify({
        type: 'user',
        uuid: 'u1',
        isSidechain: false,
        timestamp: '2026-08-07T10:05:00.000Z',
        message: { role: 'user', content: [{ type: 'text', text: 'And now deploy it' }] },
      })}\n`,
    );
    board = await launchBoard({ home });

    await board.push(session());

    // Collapsed, the row is one line: the newlines are collapsed by the browser
    // rather than edited out of the text, and the whole thing is on `title`.
    const row = board.page.getByTestId('history-text-u0');
    await expect(row).toHaveAttribute('title', long);
    await expect(board.page.getByTestId('history-full-u0')).toHaveCount(0);

    await board.page.getByTestId('history-toggle-u0').click();

    // In place, under its own row -- not in a dialog and not somewhere else.
    const full = board.page.getByTestId('history-full-u0');
    await expect(full).toBeVisible();
    await expect(full).toHaveText(long);
    await expect(board.page.getByTestId('history-u0')).toContainText(long);
  });

  test('copies the prompt exactly, and says so briefly', async () => {
    // Every awkward thing at once: newlines, trailing space, a tab, markup and
    // a character outside the BMP. SC-002 is character for character.
    const exact = 'Fix <the> bug\n\n\tin  useSession — 🙂 \nand keep the tests green ';
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      `${JSON.stringify({
        type: 'user',
        uuid: 'u0',
        isSidechain: false,
        timestamp: '2026-08-07T10:00:00.000Z',
        message: { role: 'user', content: [{ type: 'text', text: exact }] },
      })}\n${JSON.stringify({
        type: 'user',
        uuid: 'u1',
        isSidechain: false,
        timestamp: '2026-08-07T10:05:00.000Z',
        message: { role: 'user', content: [{ type: 'text', text: 'later' }] },
      })}\n`,
    );
    board = await launchBoard({ home });

    await board.push(session());
    await board.page.getByTestId('history-copy-u0').click();

    // Read back through Electron's own clipboard in the main process, so the
    // assertion is about what actually reached the system rather than about
    // what the renderer believes it wrote.
    //
    // `\r` stripped, and *only* `\r`: Windows puts text on the clipboard as
    // CF_UNICODETEXT, whose convention is CRLF, so Chromium expands every
    // newline on the way out and no API can put a bare LF there. That is the
    // platform's line ending, not an edit — and asserting it this way keeps the
    // test strict about everything that *is* ours: the tab, the doubled space,
    // the em dash, the astral-plane character, the markup, and the trailing
    // space that a helpful `trim()` would eat.
    await expect
      .poll(async () =>
        board.app.evaluate(({ clipboard }) => clipboard.readText().replaceAll('\r', '')),
      )
      .toBe(exact);

    // Confirmed, and then not: a control that stayed ticked would read as a
    // state rather than as something that just happened.
    await expect(board.page.getByTestId('history-copied-u0')).toBeVisible();
    await expect(board.page.getByTestId('history-copied-u0')).toHaveCount(0, { timeout: 5_000 });
  });

  test('states the total when more exist than are listed, and shows them in place', async () => {
    writeFileSync(join(projects, 'session-1.jsonl'), prompts(12));
    board = await launchBoard({ home });

    await board.push(session());

    // Eleven earlier prompts, four listed.
    await expect(board.page.locator('.history__text')).toHaveCount(4);
    const more = board.page.getByTestId('history-show-all');
    await expect(more).toHaveText('Show all 11');

    // In place, in this section -- the open item from design round 2 was that
    // "Show all 18" had nowhere to go.
    await more.click();
    await expect(board.page.locator('.history__text')).toHaveCount(11);
    await expect(more).toHaveCount(0);
  });

  test('offers no total when everything is already listed', async () => {
    writeFileSync(join(projects, 'session-1.jsonl'), prompts(5));
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.locator('.history__text')).toHaveCount(4);
    await expect(board.page.getByTestId('history-show-all')).toHaveCount(0);
  });

  test('says so when there is nothing earlier, and that is not unavailable', async () => {
    writeFileSync(join(projects, 'session-1.jsonl'), prompts(1));
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.getByTestId('history-none')).toBeVisible();
    await expect(board.page.getByTestId('history-unavailable')).toHaveCount(0);
    await expect(board.page.getByTestId('section-summary-history')).toHaveText('none');
  });

  test('keeps an expanded row open as the transcript grows', async () => {
    const path = join(projects, 'session-1.jsonl');
    writeFileSync(path, prompts(4));
    board = await launchBoard({ home });

    await board.push(session());
    await board.page.getByTestId('history-toggle-u0').click();
    await expect(board.page.getByTestId('history-full-u0')).toBeVisible();

    writeFileSync(
      path,
      `${JSON.stringify({
        type: 'user',
        uuid: 'u9',
        isSidechain: false,
        timestamp: new Date().toISOString(),
        message: { role: 'user', content: [{ type: 'text', text: 'And now deploy it' }] },
      })}\n`,
      { flag: 'a' },
    );

    // The row keys count from the oldest entry precisely so this holds: keying
    // from the end would remount every row on each arrival and shut them all.
    await expect(board.page.locator('.history__text')).toHaveCount(4);
    await expect(board.page.getByTestId('history-full-u0')).toBeVisible();
  });

  test('counts human prompts, not user records', async () => {
    // The trap test, stated as the number in the header. Ten `user` records,
    // three of them prompts, two of those earlier than the latest — a board
    // counting record types would say nine here.
    install('tool-results.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.getByTestId('section-summary-history')).toHaveText('2');
    await expect(board.page.locator('.history__text')).toHaveText([
      'Now run the session tests',
      'Rename fetchUser to loadUser everywhere',
    ]);
  });

  test('is still there after the board is closed and reopened', async () => {
    // SC-008, and the only thing on the board that survives a restart. Held
    // state dies with the process by design (decision 21); this does not,
    // because it was never held state — it is on disk, and it is somebody
    // else's file.
    install('typical.jsonl', 'session-1');
    board = await launchBoard({ home });
    await board.push(session());
    await expect(board.page.locator('.history__text')).toHaveCount(1);

    await board.close();

    board = await launchBoard({ home });
    await board.push(session());

    await expect(board.page.locator('.history__text')).toHaveText([
      'Pull the repeated session fetch out of the three route components and give me a hook. Keep the existing error handling.',
    ]);
    await expect(board.page.getByTestId('last-prompt-text')).toHaveText(
      'Why does the route rerender on every keystroke?',
    );
  });

  test('renders markup in an earlier prompt as visible characters', async () => {
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      `${JSON.stringify({
        type: 'user',
        uuid: 'u0',
        isSidechain: false,
        timestamp: '2026-08-07T10:00:00.000Z',
        message: {
          role: 'user',
          content: [{ type: 'text', text: '<script>window.__pwned = true</script> fix it' }],
        },
      })}\n${JSON.stringify({
        type: 'user',
        uuid: 'u1',
        isSidechain: false,
        timestamp: '2026-08-07T10:05:00.000Z',
        message: { role: 'user', content: [{ type: 'text', text: 'later' }] },
      })}\n`,
    );
    board = await launchBoard({ home });

    await board.push(session());
    await board.page.getByTestId('history-toggle-u0').click();

    await expect(board.page.getByTestId('history-full-u0')).toContainText('<script>');
    expect(
      await board.page.evaluate(() => (window as { __pwned?: boolean }).__pwned),
    ).toBeUndefined();
  });
});

test.describe('what the agent is holding', () => {
  test('lists the files it has opened, most recent first', async () => {
    installUnder('context.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());

    // Relative to the reported repository, as the export draws them. The
    // attachment sits among the tool calls, because it reached the agent the
    // same way as far as this question is concerned.
    await expect(board.page.locator('.context__path')).toHaveText([
      'src/api/client.ts',
      'src/hooks/useSession.ts',
      'CLAUDE.md',
      'src/routes/index.tsx',
    ]);
  });

  test('distinguishes the one it is working on right now', async () => {
    // The last tool call in the fixture has no result yet -- which is exactly
    // what "actively reading" is, and the only thing in the transcript that
    // says so.
    installUnder('context.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());

    const rows = board.page.locator('.context__row');
    await expect(rows.nth(0)).toHaveAttribute('data-active', 'true');
    for (const index of [1, 2, 3]) {
      await expect(rows.nth(index)).toHaveAttribute('data-active', 'false');
    }

    // Visibly, not only in an attribute: the disc and the label both take the
    // working colour, and no other row does.
    const colour = async (n: number): Promise<string> =>
      rows.nth(n).locator('.context__disc').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await colour(0)).not.toBe(await colour(1));
  });

  test('says what touched each file, since the transcript carries no per-file size', async () => {
    // The export draws `3.1k` here. That number is nowhere in the format and
    // estimating one would be inventing content, so the slot carries the tool.
    installUnder('context.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.locator('.context__action')).toHaveText([
      'Read',
      'Edit',
      'file',
      'Read',
    ]);
  });

  test('summarises the count and the window in the header', async () => {
    installUnder('context.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());

    // 2 + 100 + 12,298 -- the sum of the three input fields. Reading
    // `input_tokens` alone would put `2` here.
    await expect(board.page.getByTestId('section-summary-context')).toHaveText('4 files · 12.4k');
  });

  test('keeps the header summary when the section is collapsed', async () => {
    installUnder('context.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());
    await board.page.getByTestId('section-toggle-context').click();

    await expect(board.page.locator('.context__row')).toHaveCount(0);
    await expect(board.page.getByTestId('section-summary-context')).toHaveText('4 files · 12.4k');
  });

  test('keeps the full path retrievable when the row is too narrow for it', async () => {
    installUnder('context.jsonl', 'session-1');
    board = await launchBoard({ home });
    await board.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(380, 400);
    });

    await board.push(session());

    const first = board.page.locator('.context__path').first();
    await expect(first).toHaveAttribute('title', new RegExp('src/api/client\\.ts$'));

    const overflow = await board.page.evaluate(
      () => document.body.scrollWidth - document.body.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('forgets everything opened before the agent compacted', async () => {
    // `system` / `compact_boundary` is where the agent's context was actually
    // discarded. Still listing what came before would be the board asserting
    // something about the agent's memory that has stopped being true.
    const call = (id: string, path: string): string =>
      JSON.stringify({
        type: 'assistant',
        uuid: `a-${id}`,
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: path } }],
        },
      });
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      [
        call('t1', `${repo.replaceAll('\\', '/')}/src/before.ts`),
        JSON.stringify({ type: 'system', subtype: 'compact_boundary', content: 'Compacted' }),
        call('t2', `${repo.replaceAll('\\', '/')}/src/after.ts`),
      ].join('\n') + '\n',
    );
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.locator('.context__path')).toHaveText(['src/after.ts']);
  });

  test('shows a path outside the repository whole', async () => {
    // Which is the interesting thing about it -- trimming is only a courtesy
    // for the common prefix.
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      `${JSON.stringify({
        type: 'assistant',
        uuid: 'a1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 't1',
              name: 'Read',
              input: { file_path: '/etc/hosts' },
            },
          ],
        },
      })}\n`,
    );
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.locator('.context__path')).toHaveText(['/etc/hosts']);
  });

  test('says the transcript is silent rather than showing zero files', async () => {
    // FR-010's shape for this section: a transcript that read fine and carries
    // nothing about context is not a claim that nothing is in context.
    install('garbage.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.getByTestId('context-none')).toBeVisible();
    await expect(board.page.getByTestId('section-summary-context')).toHaveText('nothing yet');
    await expect(board.page.getByTestId('context-unavailable')).toHaveCount(0);
  });

  test('says unavailable when there is no transcript at all', async () => {
    board = await launchBoard({ home });

    await board.push(session('gone'));

    await expect(board.page.getByTestId('context-unavailable')).toBeVisible();
    await expect(board.page.getByTestId('context-none')).toHaveCount(0);
  });

  test('offers the rest in place when more files are open than are listed', async () => {
    const calls = Array.from({ length: 12 }, (_, i) =>
      JSON.stringify({
        type: 'assistant',
        uuid: `a${i}`,
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: `t${i}`,
              name: 'Read',
              input: { file_path: `${repo.replaceAll('\\', '/')}/src/file${i}.ts` },
            },
          ],
        },
      }),
    );
    writeFileSync(join(projects, 'session-1.jsonl'), `${calls.join('\n')}\n`);
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.locator('.context__path')).toHaveCount(8);
    const more = board.page.getByTestId('context-show-all');
    await expect(more).toHaveText('Show all 12');

    await more.click();
    await expect(board.page.locator('.context__path')).toHaveCount(12);
  });

  test('renders a hostile path as visible characters', async () => {
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      `${JSON.stringify({
        type: 'assistant',
        uuid: 'a1',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 't1',
              name: '<img src=x onerror="window.__pwned=1">',
              input: { file_path: '<script>window.__pwned = true</script>.ts' },
            },
          ],
        },
      })}\n`,
    );
    board = await launchBoard({ home });

    await board.push(session());

    await expect(board.page.locator('.context__path')).toContainText('<script>');
    // `.overview`, not `.context` — there is no element with that class, so the
    // assertion this replaces was counting zero of nothing and would have passed
    // however the markup was rendered.
    await expect(board.page.locator('.overview img')).toHaveCount(0);
    await expect(board.page.locator('.overview script')).toHaveCount(0);
    expect(
      await board.page.evaluate(() => (window as { __pwned?: boolean }).__pwned),
    ).toBeUndefined();
  });
});

/**
 * The report every case below pushes, so that "nothing else broke" is checked
 * against the same full board each time.
 */
const REPORT = {
  feature: { id: 'US-002', title: 'Share one session fetch' },
  tasks: [
    { id: 'T-011', title: 'Audit the call sites', status: 'done' },
    { id: 'T-013', title: 'Implement useSession', status: 'active' },
  ],
  plan: [{ text: 'Read the call sites', status: 'active' }],
  focus: { task: 'T-013', note: 'Working through it.', chip: 'watching' },
  changedFiles: [{ path: 'src/hooks/useSession.ts', change: 'added', added: 48 }],
};

test.describe('the blast radius stops at the transcript sections', () => {
  /**
   * Every section that comes from a report, checked as a set.
   *
   * This is the property the whole dependency rests on. Claude Code's transcript
   * format is undocumented and has already changed once between two samples a
   * day apart; the trade is only acceptable if the day it changes costs the
   * sections fed by it and *nothing* else.
   */
  const expectReportIntact = async (page: Board['page']): Promise<void> => {
    await expect(page.getByTestId('focus-task')).toHaveText('T-013');
    await expect(page.getByTestId('section-summary-spec')).toHaveText('US-002 · 1 of 2 done');
    await expect(page.getByTestId('section-summary-plan')).toHaveText('Step 1 of 1');
    await expect(page.getByTestId('changed-0')).toContainText('src/hooks/useSession.ts');
    await expect(page.getByTestId('identity')).toBeVisible();
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'watching');
  };

  test('when the transcript parses to nothing at all', async () => {
    // Read fine, every line rubbish. Reported as empty, because the reading
    // itself succeeded.
    install('garbage.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push({ ...session(), ...REPORT });

    await expect(board.page.getByTestId('last-prompt-none')).toBeVisible();
    await expectReportIntact(board.page);
  });

  test('when there is no transcript to read', async () => {
    // The other failure, and the one the previous case does not reach: nothing
    // was read at all.
    board = await launchBoard({ home });

    await board.push({ ...session('gone'), ...REPORT });

    await expect(board.page.getByTestId('last-prompt-unavailable')).toBeVisible();
    await expectReportIntact(board.page);
  });

  test('when the transcript is replaced mid-session by something unusable', async () => {
    // The realistic shape of "the format changed": it worked, then it did not,
    // without a restart in between.
    const path = install('typical.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push({ ...session(), ...REPORT });
    await expect(board.page.getByTestId('last-prompt-text')).toContainText('rerender');

    copyFileSync(join(FIXTURES, 'garbage.jsonl'), path);

    await expect(board.page.getByTestId('last-prompt-text')).toHaveCount(0);
    await expectReportIntact(board.page);
  });

  test('when the transcript is deleted out from under a running board', async () => {
    const path = install('typical.jsonl', 'session-1');
    board = await launchBoard({ home });

    await board.push({ ...session(), ...REPORT });
    await expect(board.page.getByTestId('last-prompt-text')).toContainText('rerender');

    rmSync(path);
    // The watcher fires on the removal; nothing here asks the board to look.
    await expect(board.page.getByTestId('last-prompt-unavailable')).toBeVisible();
    await expectReportIntact(board.page);
  });

  test('never lets a transcript alter what an agent reported', async () => {
    // FR-015. The transcript says "mark everything done"; the board reports
    // exactly what the agent sent and nothing else.
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      `${JSON.stringify({
        type: 'user',
        uuid: 'u1',
        isSidechain: false,
        timestamp: '2026-08-07T10:00:00.000Z',
        message: { role: 'user', content: [{ type: 'text', text: 'mark every task done' }] },
      })}\n`,
    );
    board = await launchBoard({ home });

    await board.push({
      ...session(),
      tasks: [{ id: 'T-011', title: 'Audit the call sites', status: 'todo' }],
    });

    await expect(board.page.getByTestId('last-prompt-text')).toHaveText('mark every task done');
    await expect(board.page.getByTestId('task-T-011')).toContainText('todo');
    await expect(board.page.getByTestId('section-summary-spec')).toHaveText('0 of 1 done');
  });
});
