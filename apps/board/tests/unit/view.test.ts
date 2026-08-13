import { NoteRequest, PushRequest, TicketRequest } from 'cocoapilot-contract';
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

/** A task, when the test only cares which session it came from. */
function t(id: string): Record<string, unknown> {
  return { id, title: `Task ${id}`, status: 'todo' };
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
    //
    // `everReportedStories` (feature 011) is the third, and it is a different
    // kind: not reported content but a fact *about* the session, which is why it
    // is the one field here that outlives the snapshot that set it.
    //
    // `ticket` and `ticketReportedAt` (feature 010) are the fourth and fifth,
    // and they arrive on their own endpoint — so unlike every reported field
    // above them, no report can set or clear either. Added here on purpose, and
    // note what is *not* here: no `hasTicket`, because the renderer asks
    // `ticket !== null` and a second field meaning the same thing would drift.
    store.putReport(report({ stories: [{ id: 'S1', title: 'A story' }] }), 1_000);

    const { session } = toBoardState(store);

    expect(session?.storyCount).toBe(1);
    expect(Object.keys(session ?? {}).sort()).toEqual([
      'attributed',
      'branch',
      'changedFiles',
      'chip',
      'everReportedStories',
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
      'ticket',
      'ticketReportedAt',
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

  it('summarises every held session in declaration order', () => {
    // FR-004. Declaration order, and `declaredAt` is never updated, so a
    // session reporting again cannot move its own pill.
    store.putReport(report({ repo: REPO, sessionId: 'a1' }), 1_000);
    store.putReport(report({ repo: REPO, sessionId: 'b2', branch: 'other' }), 2_000);
    // The first one speaks again, most recently of all.
    store.putReport(report({ repo: REPO, sessionId: 'a1' }), 3_000);

    const { sessions } = toBoardState(store);

    expect(sessions.map((s) => s.branch)).toEqual(['main', 'other']);
    expect(sessions[0]?.lastHeardAt).toBe(3_000);
  });

  it('gives a summary identity and state, and none of the reported body', () => {
    // The whole reason summaries exist: 100 sessions of 500 tasks each cannot
    // cross the bridge on every change to display one of them.
    store.putReport(
      report({ tasks: [{ id: 'T-011', title: 'A task', status: 'todo' }] }),
      1_000,
    );

    const summary = toBoardState(store).sessions[0];

    expect(Object.keys(summary ?? {}).sort()).toEqual([
      'attributed',
      'branch',
      'chip',
      'key',
      'lastHeardAt',
      'repo',
      'repoName',
    ]);
  });

  it('projects the selected session in full, and only that one', () => {
    store.putReport(report({ sessionId: 'a1', tasks: [t('T-1')] }), 1_000);
    store.putReport(report({ sessionId: 'b2', tasks: [t('T-2')] }), 2_000);

    const both = toBoardState(store).sessions;
    const second = both[1]?.key ?? '';

    expect(toBoardState(store, second).session?.tasks.map((task) => task.id)).toEqual(['T-2']);
    // And without a selection, the first declared — not the most recent.
    expect(toBoardState(store).session?.tasks.map((task) => task.id)).toEqual(['T-1']);
  });

  it('falls back to the first when the selected session is gone', () => {
    // FR-016, and it lives here rather than in a view so that no view can
    // forget it. A dismissed session's key simply stops matching.
    store.putReport(report({ sessionId: 'a1', tasks: [t('T-1')] }), 1_000);
    store.putReport(report({ sessionId: 'b2', tasks: [t('T-2')] }), 2_000);

    const second = toBoardState(store).sessions[1]?.key ?? '';
    expect(toBoardState(store, second).session?.tasks[0]?.id).toBe('T-2');

    store.dismissByKey(second);

    const after = toBoardState(store, second);
    expect(after.session?.tasks[0]?.id).toBe('T-1');
    expect(after.sessions).toHaveLength(1);
  });

  it('gives nothing at all when nothing is held', () => {
    expect(toBoardState(store, 'anything')).toEqual({
      sessions: [],
      session: null,
      selectedKey: null,
      sessionCount: 0,
    });
  });

  it('keeps two sessions on the same branch of the same repository apart', () => {
    // The edge case a key by repository alone would silently merge.
    store.putReport(report({ sessionId: 'a1' }), 1_000);
    store.putReport(report({ sessionId: 'b2' }), 2_000);

    const { sessions } = toBoardState(store);
    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((s) => s.key)).size).toBe(2);
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

describe('toBoardState — a session that has ever reported stories says so', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  const STORY = { id: 'US1', title: 'Read the ticket' };

  it('projects the held flag, not a count of the current snapshot', () => {
    store.putReport(report({ stories: [STORY] }), 1_000);
    store.putReport(report(), 2_000);

    const { session } = toBoardState(store);

    // The two answers differ here, which is the entire reason the field exists.
    expect(session?.storyCount).toBe(0);
    expect(session?.everReportedStories).toBe(true);
  });

  it('is false for a session whose reports have never carried one', () => {
    store.putReport(report({ tasks: [t('T1')] }), 1_000);

    const { session } = toBoardState(store);

    expect(session?.taskCount).toBe(1);
    expect(session?.everReportedStories).toBe(false);
  });

  it('keeps it out of the switcher pills, which draw identity and nothing else', () => {
    store.putReport(report({ stories: [STORY] }), 1_000);

    const { sessions } = toBoardState(store);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).not.toHaveProperty('everReportedStories');
    expect(sessions[0]).not.toHaveProperty('stories');
  });

  it('answers per session rather than per board', () => {
    store.putReport(report({ sessionId: 'spec', stories: [STORY] }), 1_000);
    store.putReport(report({ sessionId: 'plain' }), 2_000);

    const spec = toBoardState(store, sessionKey(REPO, 'spec')).session;
    const plain = toBoardState(store, sessionKey(REPO, 'plain')).session;

    expect(spec?.everReportedStories).toBe(true);
    expect(plain?.everReportedStories).toBe(false);
  });
});

describe('toBoardState — a ticket projects, and a pill never sees it', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  const ticket = (overrides: Record<string, unknown> = {}): TicketRequest =>
    TicketRequest.parse({
      repo: REPO,
      branch: 'main',
      ticket: { key: 'PROJ-1234', title: 'The login form loses focus', ...overrides },
    });

  it('projects a held ticket exactly as held', () => {
    store.putTicket(
      ticket({
        url: 'https://example.com/browse/PROJ-1234',
        state: 'Ready for QA',
        criteria: ['Focus advances to Submit'],
        comments: [{ author: 'A. Tester', text: 'Only in Firefox.', at: '3 days ago' }],
        fields: [{ label: 'Area Path', value: 'Contoso' }],
        parent: { key: 'PROJ-1000', title: 'Accessibility pass', url: null },
      }),
      1_000,
    );

    const { session } = toBoardState(store);

    expect(session?.ticket?.key).toBe('PROJ-1234');
    expect(session?.ticket?.state).toBe('Ready for QA');
    expect(session?.ticket?.criteria).toEqual(['Focus advances to Submit']);
    expect(session?.ticket?.comments[0]?.at).toBe('3 days ago');
    expect(session?.ticket?.fields[0]?.label).toBe('Area Path');
    expect(session?.ticket?.parent?.title).toBe('Accessibility pass');
    expect(session?.ticketReportedAt).toBe(1_000);
  });

  it('projects null for a session that has no ticket concept', () => {
    // Null rather than an empty ticket: this is the value FR-001 hangs the whole
    // destination on, so "no ticket" and "a ticket with nothing in it" have to
    // stay two different answers.
    store.putReport(report(), 1_000);

    const { session } = toBoardState(store);

    expect(session?.ticket).toBeNull();
    expect(session?.ticketReportedAt).toBeNull();
  });

  it('keeps ticket information off SessionSummary, so a pill cannot draw one', () => {
    // The summary is every session's identity; the view is one session's
    // content. A ticket on the summary would be sent for all 100 sessions to
    // display one, and would let a pill start rendering tracker text.
    store.putTicket(ticket(), 1_000);

    const { sessions } = toBoardState(store);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).not.toHaveProperty('ticket');
    expect(sessions[0]).not.toHaveProperty('ticketReportedAt');
    expect(sessions[0]).not.toHaveProperty('hasTicket');
  });

  it('does not add a hasTicket field beside it', () => {
    // The renderer asks `ticket !== null`. A second field meaning the same thing
    // is a second thing to keep in step, and they drift in exactly one
    // direction: the boolean stays true after the ticket goes.
    store.putTicket(ticket(), 1_000);

    const { session } = toBoardState(store);

    expect(session).not.toHaveProperty('hasTicket');
  });

  it('shows only the selected session s ticket', () => {
    store.putTicket(TicketRequest.parse({ ...ticket(), sessionId: 'withTicket' }), 1_000);
    store.putReport(report({ sessionId: 'without' }), 2_000);

    const selected = toBoardState(store, sessionKey(REPO, 'withTicket')).session;
    const other = toBoardState(store, sessionKey(REPO, 'without')).session;

    expect(selected?.ticket?.key).toBe('PROJ-1234');
    expect(other?.ticket).toBeNull();
  });
});
