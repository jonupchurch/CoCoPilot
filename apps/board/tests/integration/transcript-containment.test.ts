import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { FsCall } from '../helpers/fs-calls.js';

/**
 * The reader reads one file. This is the test that says so in calls rather than
 * in prose.
 *
 * SC-004 (writes nothing, anywhere) and SC-005 (reads nothing inside the user's
 * repository) already have an absence test for the service. Feature 005 is the
 * first thing in the product that opens a file at all, so it needs its own — and
 * a stricter one, because the file it opens sits in a directory full of files it
 * is not entitled to:
 *
 * - **a sibling session's transcript**, right beside the target in the same
 *   directory. Reading it would show one session another session's prompts.
 * - **the `subagents/` tree**, `<sessionId>/subagents/agent-*.jsonl`. FR-016
 *   forbids it, and a guard against it is easy to write and easier to lose.
 *
 * Every `node:fs` call the reader makes during a full cycle — locate, first
 * read, incremental read, restart after replacement, the no-id fallback,
 * dismissal — is recorded and then named. The test's own setup writes are kept
 * outside the recording window, so a write appearing in it is the product's.
 */

const recorder = vi.hoisted(() => ({ calls: [] as FsCall[] }));

vi.mock('node:fs', async (importOriginal) => {
  const { recordInto } = await import('../helpers/fs-calls.js');
  return recordInto(recorder.calls, 'node:fs', await importOriginal<Record<string, unknown>>());
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const { recordInto } = await import('../helpers/fs-calls.js');
  return recordInto(
    recorder.calls,
    'node:fs/promises',
    await importOriginal<Record<string, unknown>>(),
  );
});

const { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import(
  'node:fs'
);
const { homedir, tmpdir } = await import('node:os');
const { join } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const { PushRequest } = await import('cocoapilot-contract');
const { normalise, pathish, WRITE_APIS } = await import('../helpers/fs-calls.js');
const { sessionKey, Store } = await import('../../src/main/store.js');
const { TranscriptSource } = await import('../../src/main/transcript/index.js');
const { slug } = await import('../../src/main/transcript/locate.js');

const FIXTURES = fileURLToPath(new URL('../fixtures/transcripts/', import.meta.url));

/** Everything the reader is entitled to touch, and everything it is not. */
let home: string;
let named: { repo: string; projects: string; transcript: string; sibling: string; agent: string };
let fallback: { repo: string; projects: string; transcript: string };

/** Calls made while the window was open, across every stage of the cycle. */
const calls: FsCall[] = [];

/**
 * Run one stage with the recorder open, and keep what it saw.
 *
 * Everything between stages — the appends and rewrites that stand in for the
 * agent writing its own transcript — happens with the window shut, because those
 * writes are the test's and counting them would make SC-004 unassertable.
 */
function capture(run: () => void): void {
  recorder.calls.length = 0;
  run();
  calls.push(...recorder.calls);
  recorder.calls.length = 0;
}

/** A repository stocked with the files a "helpful" future change would read. */
function makeRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'cocoapilot-containment-repo-'));
  writeFileSync(join(repo, 'tasks.md'), '- [x] T001 A task\n- [ ] T002 Another\n');
  mkdirSync(join(repo, 'specs'));
  writeFileSync(join(repo, 'specs', 'spec.md'), '# A spec\n');
  mkdirSync(join(repo, '.git'));
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  return repo;
}

function projectsFor(repo: string): string {
  const projects = join(home, '.claude', 'projects', slug(repo));
  mkdirSync(projects, { recursive: true });
  return projects;
}

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), 'cocoapilot-containment-home-'));

  // The session that names its transcript, in a directory that also holds a
  // sibling session and a subagents tree. Neither is ours to read.
  const namedRepo = makeRepo();
  const namedProjects = projectsFor(namedRepo);
  const agents = join(namedProjects, 'session-1', 'subagents');
  mkdirSync(agents, { recursive: true });
  const agent = join(agents, 'agent-1.jsonl');
  writeFileSync(
    agent,
    `${JSON.stringify({
      type: 'user',
      uuid: 'sub',
      message: { role: 'user', content: 'a subagent instruction, not the developer' },
    })}\n`,
  );
  const transcript = join(namedProjects, 'session-1.jsonl');
  const sibling = join(namedProjects, 'session-2.jsonl');
  copyFileSync(join(FIXTURES, 'typical.jsonl'), transcript);
  copyFileSync(join(FIXTURES, 'tool-results.jsonl'), sibling);
  named = { repo: namedRepo, projects: namedProjects, transcript, sibling, agent };

  // The session that names nothing, so the newest-file fallback runs. Its own
  // repository, so that "the one located transcript" stays a single file.
  const fallbackRepo = makeRepo();
  const fallbackProjects = projectsFor(fallbackRepo);
  const only = join(fallbackProjects, 'only.jsonl');
  copyFileSync(join(FIXTURES, 'string-content.jsonl'), only);
  fallback = { repo: fallbackRepo, projects: fallbackProjects, transcript: only };
});

afterAll(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(named.repo, { recursive: true, force: true });
  rmSync(fallback.repo, { recursive: true, force: true });
});

describe('the reader touches one file per session, and nothing else', () => {
  it('drives a full read cycle with every call recorded', () => {
    const store = new Store();
    const source = new TranscriptSource(store, { home, now: () => 2_000 });

    const push = (repo: string, sessionId: string, transcriptId: string | null): void => {
      store.putReport(
        PushRequest.parse({ repo, branch: 'main', sessionId, transcriptId }),
        1_000,
      );
    };

    push(named.repo, 'a1', 'session-1');

    // Locate, watch, first read.
    capture(() => {
      source.start();
    });

    // The agent appends to its own transcript. Not the product's write, so not
    // in the window.
    appendFileSync(
      named.transcript,
      `${JSON.stringify({
        type: 'user',
        uuid: 'u4',
        isSidechain: false,
        timestamp: '2026-08-07T11:00:00.000Z',
        message: { role: 'user', content: [{ type: 'text', text: 'And now deploy it' }] },
      })}\n`,
    );

    const key = sessionKey(named.repo, 'a1');
    capture(() => {
      source.refresh(key);
    });

    // Replaced wholesale, which sends the reader back to the beginning.
    writeFileSync(named.transcript, '{"type":"user","uuid":"z"}\n');
    capture(() => {
      source.refresh(key);
    });

    // A second session with no id at all, so the newest-file fallback lists a
    // directory. Following it is triggered by the push itself.
    capture(() => {
      push(fallback.repo, 'b2', null);
      source.refresh(sessionKey(fallback.repo, 'b2'));
    });

    capture(() => {
      store.dismiss(fallback.repo, 'b2');
      source.stop();
    });

    // The cycle really ran: a read that produced nothing would make every
    // assertion below pass for the wrong reason.
    expect(calls.length).toBeGreaterThan(5);
    expect(store.getSession(named.repo, 'a1')?.transcript).not.toBeNull();
  });

  it('writes nothing, anywhere', () => {
    const writes = calls
      .filter((call) => WRITE_APIS.has(call.fn))
      .map((call) => `${call.module}.${call.fn}(${pathish(call)[0] ?? ''})`);

    expect(writes).toEqual([]);
  });

  it('names exactly three paths: one transcript, one directory, one fallback', () => {
    const paths = [...new Set(calls.flatMap((call) => pathish(call)))].sort();

    // Not "no forbidden path appeared" but "only these appeared". A containment
    // test written as a denylist only ever catches what someone thought of.
    expect(paths).toEqual([named.transcript, fallback.projects, fallback.transcript].sort());
  });

  it('uses only the calls a read needs', () => {
    const used = [...new Set(calls.map((call) => `${call.module}.${call.fn}`))].sort();

    // `readdirSync` is the fallback listing a directory; `watch` is how the view
    // stays live without polling. Everything else is one file being read.
    expect(used).toEqual([
      'node:fs.closeSync',
      'node:fs.openSync',
      'node:fs.readSync',
      'node:fs.readdirSync',
      'node:fs.statSync',
      'node:fs.watch',
    ]);
  });

  it('never reads the sibling session in the same directory', () => {
    // FR-016. The session asked for `session-1`; `session-2.jsonl` is right
    // beside it and belongs to somebody else's window.
    const touched = calls.filter((call) =>
      pathish(call).some((value) => normalise(value) === normalise(named.sibling)),
    );

    expect(touched).toEqual([]);
  });

  it('never reads the subagents tree beside the transcript', () => {
    // `<slug>/<sessionId>/subagents/agent-*.jsonl`. An agent's internal
    // delegation is not the developer's instructions, and showing it as one
    // would be worse than showing nothing.
    const prefix = `${normalise(join(named.projects, 'session-1'))}/`;
    const touched = calls.flatMap((call) =>
      pathish(call)
        .filter((value) => normalise(value).startsWith(prefix))
        .map((value) => `${call.fn}(${value})`),
    );

    expect(touched).toEqual([]);
  });

  it('never reads inside either repository', () => {
    // SC-005. `tasks.md` and `specs/spec.md` are sitting there in both, and the
    // agent is what reads them.
    const inside = calls.flatMap((call) =>
      pathish(call)
        .filter((value) =>
          [named.repo, fallback.repo].some((repo) =>
            normalise(value).startsWith(`${normalise(repo)}/`),
          ),
        )
        .map((value) => `${call.fn}(${value})`),
    );

    expect(inside).toEqual([]);
  });

  it('never reaches the real .claude directory', () => {
    // The suite points the reader at a temporary home; a path under the real
    // `~/.claude` would mean it had started reading actual sessions, which is
    // the failure that would be least visible and worst.
    //
    // The home directory itself is not the test, because on Windows `tmpdir()`
    // lives inside it — every fixture path here starts with `homedir()`, so
    // asserting on that would fail for a reason that has nothing to do with
    // containment.
    const real = `${normalise(join(homedir(), '.claude'))}/`;
    const escaped = calls.flatMap((call) =>
      pathish(call)
        .filter((value) => normalise(value).startsWith(real))
        .map((value) => `${call.fn}(${value})`),
    );

    expect(escaped).toEqual([]);
  });
});
