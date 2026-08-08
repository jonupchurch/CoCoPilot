import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PushRequest } from 'cocoapilot-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Store, type Session, type TranscriptState } from '../../../src/main/store.js';
import { TranscriptSource } from '../../../src/main/transcript/index.js';
import { slug } from '../../../src/main/transcript/locate.js';

/**
 * What happens when the transcript is not what we expect — every case, stated.
 *
 * This is the test that makes depending on an undocumented, externally-owned
 * format acceptable at all (FR-002, FR-011, FR-012). Its subject is not the
 * happy path through `locate` → `reader` → `classify`; it is the whole source
 * driven against files that are missing, hostile, half-written, or shaped like
 * something nobody has shipped yet, asserting that each one lands in a defined
 * state and that **nothing throws** out of any of them.
 *
 * **Two failure states, not one, and they are not interchangeable.** `tasks.md`
 * asks for `unreadable` from all six of its cases. That is one state too few,
 * and shipping it would have made SC-006 unsatisfiable — so the rule this file
 * encodes is the one the reader actually implements:
 *
 * - **`unreadable`** — the source could not be read. Missing, denied, a
 *   directory, a rejected id. Something is wrong and the developer should know.
 * - **`empty`** — the source was read fine and holds no prompts. Nothing is
 *   wrong. `garbage.jsonl` is this case, not the one above: every line failed to
 *   parse, every line was skipped per FR-012, and the reading itself succeeded.
 *
 * Collapsing the two would either cry wolf on an ordinary empty session or,
 * far worse, draw a failed read as a confident "nothing here".
 */

const FIXTURES = fileURLToPath(new URL('../../fixtures/transcripts/', import.meta.url));

/**
 * Paths whose `openSync` fails with `EACCES`, the way an unreadable file fails
 * on POSIX: the entry stats fine and the open is refused.
 *
 * Injected rather than produced for real because no portable API produces it —
 * `chmod` does not deny read access on Windows, and `icacls` is neither portable
 * nor present in every container. The denial is per-path and narrow: every other
 * call in this file, including every other `openSync`, reaches the real
 * filesystem. That the mock is not simply breaking everything is asserted rather
 * than assumed — the same file reads normally once its path leaves the set.
 */
const denied = vi.hoisted(() => new Set<string>());

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  const mocked = {
    ...actual,
    openSync(path: unknown, ...rest: unknown[]): number {
      if (typeof path === 'string' && denied.has(path)) {
        const error: NodeJS.ErrnoException = new Error(`EACCES: permission denied, open '${path}'`);
        error.code = 'EACCES';
        throw error;
      }
      return (actual.openSync as unknown as (...args: unknown[]) => number)(path, ...rest);
    },
  };
  return { ...mocked, default: mocked };
});

let home: string;
let repo: string;
let projects: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'cocoapilot-degradation-home-'));
  repo = mkdtempSync(join(tmpdir(), 'cocoapilot-degradation-repo-'));
  projects = join(home, '.claude', 'projects', slug(repo));
  mkdirSync(projects, { recursive: true });
});

afterEach(() => {
  denied.clear();
  rmSync(home, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

/** Put a fixture in place as the transcript for `transcriptId`. */
function install(fixture: string, transcriptId = 'session-1'): string {
  const path = join(projects, `${transcriptId}.jsonl`);
  copyFileSync(join(FIXTURES, fixture), path);
  return path;
}

/**
 * One full read cycle for one session, from the store's point of view.
 *
 * Deliberately the whole source rather than a module of it. Every failure here
 * has to survive `locate`, the reader, the classifier and the publish before it
 * counts as contained, and testing the pieces separately would miss an exception
 * that escapes the seam between two of them.
 */
function readOnce(transcriptId: string | null = 'session-1'): {
  store: Store;
  state: TranscriptState;
} {
  const store = new Store();
  store.putReport(
    PushRequest.parse({
      repo,
      branch: 'main',
      sessionId: 'a1',
      transcriptId,
      tasks: [{ id: 'T-001', title: 'Hold a report', status: 'active' }],
      focus: { task: 'T-001', note: 'what the agent said, and only that' },
    }),
    1_000,
  );

  const source = new TranscriptSource(store, { home, now: () => 2_000 });
  source.start();
  source.stop();

  const { transcript } = session(store);
  if (transcript === null) throw new Error('the reader published nothing for the session');
  return { store, state: transcript };
}

function session(store: Store): Session {
  const found = store.getSession(repo, 'a1');
  if (found === undefined) throw new Error('the fixture session went missing');
  return found;
}

/** The state name alone — `available`, `empty` or `unreadable`. */
function name(state: TranscriptState): string {
  return state.prompts.state;
}

/** The prompt texts, or `[]` for any state that carries no value. */
function texts(state: TranscriptState): readonly string[] {
  return state.prompts.state === 'available' ? state.prompts.value.map((p) => p.text) : [];
}

describe('a source that could not be read reports unreadable', () => {
  it('when the named transcript is not there', () => {
    const { state } = readOnce('never-existed');

    expect(state.prompts).toEqual({ state: 'unreadable', reason: 'no-transcript' });
  });

  it('when the repository has no projects directory at all', () => {
    rmSync(projects, { recursive: true, force: true });

    // With no id to be exact about, the fallback needs the directory to list.
    expect(readOnce(null).state.prompts).toEqual({ state: 'unreadable', reason: 'no-directory' });
  });

  it('when a directory stands where the transcript should be', () => {
    mkdirSync(join(projects, 'session-1.jsonl'));

    expect(name(readOnce().state)).toBe('unreadable');
  });

  it('when the only .jsonl files are subagent transcripts in a subdirectory', () => {
    // The real layout: `<slug>/<sessionId>/subagents/agent-*.jsonl`. FR-016
    // forbids reading them, and the fallback must find nothing rather than
    // descend.
    const subagents = join(projects, 'session-1', 'subagents');
    mkdirSync(subagents, { recursive: true });
    writeFileSync(
      join(subagents, 'agent-1.jsonl'),
      `${JSON.stringify({
        type: 'user',
        uuid: 'x',
        message: { role: 'user', content: 'a subagent instruction' },
      })}\n`,
    );

    const { state } = readOnce(null);
    expect(state.prompts).toEqual({ state: 'unreadable', reason: 'no-transcript' });
    expect(texts(state)).toEqual([]);
  });

  it('when the id tries to walk out of the projects directory', () => {
    // A `Label` the contract is happy with: it only checks length.
    expect(readOnce('../../../../etc/passwd').state.prompts).toEqual({
      state: 'unreadable',
      reason: 'rejected-id',
    });
  });

  it('when the file stats fine but will not open', () => {
    const path = install('typical.jsonl');
    denied.add(path);

    expect(name(readOnce().state)).toBe('unreadable');

    // The denial, not the fixture: the same bytes read normally without it.
    denied.delete(path);
    expect(texts(readOnce().state)).toHaveLength(2);
  });
});

describe('a source that read fine but holds no prompts reports empty', () => {
  it('for a file where every single line fails to parse', () => {
    // HTML, ANSI noise, unbalanced braces, a bare number. Each line is skipped
    // and reading continues (FR-012); the read itself never failed, so this is
    // not an error state.
    install('garbage.jsonl');

    const { state } = readOnce();
    expect(name(state)).toBe('empty');
    expect(texts(state)).toEqual([]);
  });

  it('for an empty file', () => {
    writeFileSync(join(projects, 'session-1.jsonl'), '');

    expect(name(readOnce().state)).toBe('empty');
  });

  it('for a file holding only records that are not prompts', () => {
    // Every `user` record here is a tool result. A reader counting record types
    // would call this ten prompts.
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      `${JSON.stringify({
        type: 'user',
        uuid: 'u1',
        isSidechain: false,
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }],
        },
      })}\n`,
    );

    expect(name(readOnce().state)).toBe('empty');
  });

  it('and empty is a different state from unreadable, for a different cause', () => {
    // SC-006 in one assertion, at the source rather than in the pixels. The
    // renderer test that draws them differently is downstream of this.
    install('garbage.jsonl');
    const read = name(readOnce().state);
    const missing = name(readOnce('never-existed').state);

    expect(read).toBe('empty');
    expect(missing).toBe('unreadable');
    expect(read).not.toBe(missing);
  });
});

describe('junk around a prompt never costs the prompt', () => {
  it('keeps the whole lines of a transcript whose last line is half-written', () => {
    // The normal case for a file another process is appending to, not damage.
    install('truncated.jsonl');

    expect(texts(readOnce().state)).toEqual([
      'Pull the repeated session fetch out of the three route components and give me a hook. Keep the existing error handling.',
    ]);
  });

  it('keeps prompts surrounded by four record types it has never seen', () => {
    // `system`, `telemetry-batch`, `model-thought`, `attachment`. One of those
    // really did appear between two samples a day apart, which is the whole
    // argument for skipping the unfamiliar instead of rejecting it.
    install('unknown-types.jsonl');

    expect(texts(readOnce().state)).toEqual([
      'A prompt that must survive the types around it',
      'And a second one after them',
    ]);
  });

  it('keeps prompts whose content is a plain string rather than a block array', () => {
    // 10 of 1,129 in the real sample. A reader built on "content is always an
    // array" drops these without a trace.
    install('string-content.jsonl');

    expect(texts(readOnce().state)).toEqual(["ok, we're back with the new folder name", 'yes']);
  });

  it('keeps the one real prompt in a file that is otherwise all wrappers', () => {
    install('wrappers.jsonl');

    const kept = texts(readOnce().state);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toContain('Explain what <command-name> does');
  });

  it('keeps the prompts in a file that is mostly tool output', () => {
    install('tool-results.jsonl');

    expect(texts(readOnce().state)).toEqual([
      'Rename fetchUser to loadUser everywhere',
      'Now run the session tests',
      'Good. Commit that.',
    ]);
  });

  it('keeps the prompts on either side of a line of binary rubbish', () => {
    // A rotated log, a partially-overwritten file, a disk that lied. The line
    // will not parse, so it is skipped, and its neighbours are unaffected.
    const record = (text: string): string =>
      JSON.stringify({
        type: 'user',
        uuid: text,
        isSidechain: false,
        message: { role: 'user', content: [{ type: 'text', text }] },
      });
    writeFileSync(
      join(projects, 'session-1.jsonl'),
      `${record('before')}\n\u0000\u0001\u0002 binary\n${record('after')}\n`,
    );

    expect(texts(readOnce().state)).toEqual(['before', 'after']);
  });
});

describe('nothing throws, whatever is on disk', () => {
  const cases: readonly (readonly [string, () => string | null])[] = [
    ['a missing file', () => 'never-existed'],
    ['a rejected id', () => '../escape'],
    ['an id that is only a dot', () => '.'],
    ['an empty id', () => ''],
    ['a directory in place of the file', () => (mkdirSync(join(projects, 'd.jsonl')), 'd')],
    ['garbage', () => (install('garbage.jsonl'), 'session-1')],
    ['a truncated tail', () => (install('truncated.jsonl'), 'session-1')],
    ['unknown record types', () => (install('unknown-types.jsonl'), 'session-1')],
    ['string content', () => (install('string-content.jsonl'), 'session-1')],
    ['wrappers only', () => (install('wrappers.jsonl'), 'session-1')],
    ['tool results only', () => (install('tool-results.jsonl'), 'session-1')],
    ['a typical transcript', () => (install('typical.jsonl'), 'session-1')],
    ['no id at all, and nothing to fall back to', () => null],
    [
      'a file that will not open',
      () => {
        denied.add(install('typical.jsonl'));
        return 'session-1';
      },
    ],
    [
      'a transcript of one very long unterminated line',
      () => {
        writeFileSync(join(projects, 'session-1.jsonl'), 'x'.repeat((4 << 20) + 1_000));
        return 'session-1';
      },
    ],
  ];

  for (const [description, arrange] of cases) {
    it(`survives ${description}`, () => {
      const id = arrange();

      // The assertion is the absence of a throw; the state check is there so a
      // silently-skipped publish cannot pass as success.
      expect(['available', 'empty', 'unreadable']).toContain(name(readOnce(id).state));
    });
  }
});

describe('none of it reaches what the agent reported', () => {
  it('leaves the report exactly as pushed, for every hostile source', () => {
    for (const fixture of ['garbage.jsonl', 'truncated.jsonl', 'unknown-types.jsonl']) {
      install(fixture);
      const { store } = readOnce();
      const report = session(store).report;

      // FR-015. The transcript branch may say anything at all; this one is
      // untouched by it.
      expect(report?.tasks.map((task) => [task.id, task.status])).toEqual([['T-001', 'active']]);
      expect(report?.focus?.note).toBe('what the agent said, and only that');
      rmSync(join(projects, 'session-1.jsonl'));
    }
  });

  it('does not move lastHeardAt when the transcript is read', () => {
    // How long since the *agent* spoke. Another program appending to a file it
    // owns is not the agent speaking.
    install('typical.jsonl');

    expect(session(readOnce().store).lastHeardAt).toBe(1_000);
  });
});
