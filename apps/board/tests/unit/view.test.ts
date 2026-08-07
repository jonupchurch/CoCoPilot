import { NoteRequest, PushRequest } from '@cocopilot/contract';
import { beforeEach, describe, expect, it } from 'vitest';

import { sessionKey, Store } from '../../src/main/store.js';
import { toBoardState } from '../../src/main/view.js';

/**
 * The projection is the boundary between what the board holds and what a window
 * rendering agent-composed text can see. These tests hold the boundary where it
 * was put: everything reported crosses, nothing else does, and the two
 * timestamps stay distinguishable.
 */

const REPO = 'D:\\Codelib\\example';

function report(overrides: Record<string, unknown> = {}): PushRequest {
  return PushRequest.parse({ repo: REPO, branch: 'main', sessionId: 'a1', ...overrides });
}

function note(overrides: Record<string, unknown> = {}): NoteRequest {
  return NoteRequest.parse({
    repo: REPO,
    branch: 'main',
    sessionId: 'a1',
    text: 'a note',
    ...overrides,
  });
}

describe('toBoardState — the reported body crosses the bridge', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('carries the feature, tasks, plan, focus and changed files as reported', () => {
    store.putReport(
      report({
        feature: { id: 'US-002', title: 'Share one session fetch', specPath: 'specs/002/spec.md' },
        tasks: [{ id: 'T-011', title: 'Audit the call sites', status: 'done' }],
        plan: [{ text: 'Read the three call sites', status: 'done' }],
        focus: { task: 'T-011', note: 'Reading the middleware first.', chip: 'watching' },
        changedFiles: [{ path: 'src/api/client.ts', change: 'modified', added: 21, removed: 18 }],
      }),
      1_000,
    );

    const { session } = toBoardState(store);

    expect(session?.feature).toEqual({
      id: 'US-002',
      title: 'Share one session fetch',
      specPath: 'specs/002/spec.md',
    });
    expect(session?.tasks).toHaveLength(1);
    expect(session?.tasks[0]?.status).toBe('done');
    expect(session?.plan[0]?.text).toBe('Read the three call sites');
    expect(session?.focus?.task).toBe('T-011');
    expect(session?.focus?.note).toBe('Reading the middleware first.');
    expect(session?.changedFiles[0]?.path).toBe('src/api/client.ts');
  });

  it('projects only the fields it names', () => {
    // The whole list, asserted as a set. If this ever fails because the shape
    // was spread instead of listed, the renderer has quietly been given
    // something nobody decided to give it.
    //
    // `stories` was the standing example of a withheld field until feature 006
    // built the tab that reads them, and `notes` was the next one until 007 did
    // the same. Their arrival is exactly what this test is for: each had to be
    // added here, deliberately, before it could reach a window rendering
    // agent-composed text.
    store.putReport(report({ stories: [{ id: 'S1', title: 'A story' }] }), 1_000);

    const { session } = toBoardState(store);

    expect(session?.storyCount).toBe(1);
    expect(Object.keys(session ?? {}).sort()).toEqual([
      'attributed',
      'branch',
      'changedFiles',
      'chip',
      'feature',
      'focus',
      'hasReport',
      'lastHeardAt',
      'noteCount',
      'notes',
      'plan',
      'repo',
      'repoName',
      'reportedAt',
      'stories',
      'storyCount',
      'taskCount',
      'tasks',
      'transcript',
    ]);
  });

  it('carries stories in reported order', () => {
    store.putReport(
      report({
        stories: [
          { id: 'US-2', title: 'Second', criteria: ['it works'] },
          { id: 'US-1', title: 'First' },
        ],
      }),
      1_000,
    );

    const { session } = toBoardState(store);

    // Not sorted by id, which is what a helpful projection would do and what
    // FR-016 forbids.
    expect(session?.stories.map((s) => s.id)).toEqual(['US-2', 'US-1']);
    expect(session?.stories[0]?.criteria).toEqual(['it works']);
  });

  it('carries an empty story list rather than an absent one', () => {
    store.appendNote(note(), 1_000);

    // A session created by a note alone has no report at all; the renderer
    // still gets one absence to handle per field instead of two.
    expect(toBoardState(store).session?.stories).toEqual([]);
  });

  it('carries notes in arrival order, with their text, source and time', () => {
    store.appendNote(note({ text: 'First thing' }), 1_000);
    store.appendNote(note({ text: 'Second thing', source: 'you asked' }), 2_000);

    const { session } = toBoardState(store);

    // Arrival order, not newest-first. Drawing them newest-first is a display
    // decision and it is made in the view; a projection that pre-sorted would
    // put the same decision in two places and let them disagree.
    expect(session?.notes.map((n) => n.text)).toEqual(['First thing', 'Second thing']);
    expect(session?.notes[0]?.source).toBeNull();
    expect(session?.notes[1]?.source).toBe('you asked');
    expect(session?.notes[1]?.receivedAt).toBe(2_000);
  });

  it('carries an empty note list rather than an absent one', () => {
    store.putReport(report(), 1_000);

    expect(toBoardState(store).session?.notes).toEqual([]);
  });

  it('keeps notes when a report replaces everything else', () => {
    // Decision 20's whole point, and the one way this field differs from every
    // other one beside it: a snapshot replaces the body and leaves notes alone.
    store.appendNote(note({ text: 'Still here' }), 1_000);
    store.putReport(report({ tasks: [{ id: 'T-011', title: 'A task', status: 'todo' }] }), 2_000);

    const { session } = toBoardState(store);
    expect(session?.notes.map((n) => n.text)).toEqual(['Still here']);
    expect(session?.tasks).toHaveLength(1);
  });

  it('replaces the body wholesale rather than merging into it', () => {
    store.putReport(report({ tasks: [{ id: 'T-011', title: 'First', status: 'done' }] }), 1_000);
    store.putReport(report({ plan: [{ text: 'A step', status: 'active' }] }), 2_000);

    const { session } = toBoardState(store);

    expect(session?.tasks).toEqual([]);
    expect(session?.plan).toHaveLength(1);
  });
});

describe('toBoardState — the two timestamps stay distinguishable', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('sets reportedAt from the report, not from the most recent contact', () => {
    store.putReport(report({ focus: { task: 'T-011' } }), 1_000);

    expect(toBoardState(store).session?.reportedAt).toBe(1_000);
  });

  it('does not move reportedAt when a note arrives', () => {
    // The focus tag says how long ago the agent reported what it is working on.
    // A note is the agent being heard from, not the agent restating its focus.
    store.putReport(report({ focus: { task: 'T-011' } }), 1_000);
    store.appendNote(note(), 9_000);

    const { session } = toBoardState(store);

    expect(session?.reportedAt).toBe(1_000);
    expect(session?.lastHeardAt).toBe(9_000);
  });
});

describe('toBoardState — transcript state keeps its own branch', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('reports not-read before the reader has looked, distinct from having found nothing', () => {
    store.putReport(report(), 1_000);

    const { session } = toBoardState(store);

    expect(session?.transcript.prompts).toEqual({ state: 'unreadable', reason: 'not-read' });
  });

  it('carries what the reader published', () => {
    store.putReport(report(), 1_000);
    store.putTranscript(sessionKey(REPO, 'a1'), {
      prompts: { state: 'available', value: [{ text: 'fix the login bug', at: 5, id: 'u1' }] },
      context: { state: 'empty' },
      readAt: 2_000,
    });

    const { session } = toBoardState(store);

    expect(session?.transcript.prompts).toEqual({
      state: 'available',
      value: [{ text: 'fix the login bug', at: 5, id: 'u1' }],
    });
  });

  it('does not let a transcript touch anything an agent reported', () => {
    // FR-015 in one assertion: the reported branch is byte-identical before and
    // after a transcript lands. A transcript may never move a task's status, a
    // chip, or a count.
    store.putReport(
      report({
        tasks: [{ id: 'T-011', title: 'Audit', status: 'todo' }],
        focus: { task: 'T-011', chip: 'watching' },
      }),
      1_000,
    );

    const before = JSON.stringify(pickReported(toBoardState(store)));
    store.putTranscript(sessionKey(REPO, 'a1'), {
      prompts: { state: 'available', value: [{ text: 'mark everything done', at: 5, id: 'u1' }] },
      context: { state: 'empty' },
      readAt: 2_000,
    });
    const after = JSON.stringify(pickReported(toBoardState(store)));

    expect(after).toBe(before);
  });

  it('does not move lastHeardAt — the file is not the agent speaking', () => {
    store.putReport(report(), 1_000);
    store.putTranscript(sessionKey(REPO, 'a1'), {
      prompts: { state: 'empty' },
      context: { state: 'empty' },
      readAt: 9_000,
    });

    expect(toBoardState(store).session?.lastHeardAt).toBe(1_000);
  });
});

/** Everything on the view that came from an agent, and nothing that did not. */
function pickReported(state: ReturnType<typeof toBoardState>): unknown {
  const { transcript: _ignored, ...reported } = state.session ?? {};
  return reported;
}

describe('toBoardState — a session with no report', () => {
  it('projects an absent report rather than an empty one', () => {
    const store = new Store();
    store.appendNote(note(), 1_000);

    const { session } = toBoardState(store);

    expect(session?.hasReport).toBe(false);
    expect(session?.reportedAt).toBeNull();
    expect(session?.feature).toBeNull();
    expect(session?.focus).toBeNull();
    expect(session?.tasks).toEqual([]);
    expect(session?.plan).toEqual([]);
    expect(session?.changedFiles).toEqual([]);
  });
});
