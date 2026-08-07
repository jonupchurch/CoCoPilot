import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

test.beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'cocopilot-e2e-home-'));
  repo = mkdtempSync(join(tmpdir(), 'cocopilot-e2e-repo-'));
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
