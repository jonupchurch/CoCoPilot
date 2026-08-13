import { NoteRequest, PushRequest, TicketRequest } from 'cocoapilot-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sessionKey, Store, UNATTRIBUTED } from '../../src/main/store.js';

function report(overrides: Record<string, unknown> = {}): PushRequest {
  return PushRequest.parse({ repo: 'D:\\Codelib\\example', branch: 'main', ...overrides });
}

function note(overrides: Record<string, unknown> = {}): NoteRequest {
  return NoteRequest.parse({
    repo: 'D:\\Codelib\\example',
    branch: 'main',
    text: 'a note',
    ...overrides,
  });
}

/** A report carrying one story, for the Spec-Kit-shaped cases below. */
function withStory(overrides: Record<string, unknown> = {}): PushRequest {
  return report({ stories: [{ id: 'US1', title: 'Read the ticket' }], ...overrides });
}

function ticket(overrides: Record<string, unknown> = {}): TicketRequest {
  return TicketRequest.parse({
    repo: 'D:\\Codelib\\example',
    branch: 'main',
    ticket: { key: 'PROJ-1234', title: 'The login form loses focus', ...overrides },
  });
}

describe('Store — a report is held', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('creates the session on first contact', () => {
    const result = store.putReport(report({ sessionId: 'a1' }), 1_000);

    expect(result.ok).toBe(true);
    const session = store.getSession('D:\\Codelib\\example', 'a1');
    expect(session?.report?.receivedAt).toBe(1_000);
    expect(session?.branch).toBe('main');
  });

  it('holds the same session id in two repositories independently', () => {
    store.putReport(report({ repo: 'D:\\Codelib\\one', sessionId: 'shared' }), 1);
    store.putReport(report({ repo: 'D:\\Codelib\\two', sessionId: 'shared' }), 2);

    expect(store.size).toBe(2);
    expect(store.getSession('D:\\Codelib\\one', 'shared')?.report?.receivedAt).toBe(1);
    expect(store.getSession('D:\\Codelib\\two', 'shared')?.report?.receivedAt).toBe(2);
  });

  it('holds two sessions in one repository independently', () => {
    store.putReport(report({ sessionId: 'a1' }), 1);
    store.putReport(report({ sessionId: 'b2' }), 2);

    expect(store.size).toBe(2);
  });

  it('cannot have its key forged by a crafted session id', () => {
    // The key is repo + NUL + sessionId, and NUL occurs in neither.
    store.putReport(report({ repo: 'D:\\a', sessionId: 'x' }), 1);
    store.putReport(report({ repo: 'D:\\a\0x', sessionId: '' }), 2);

    expect(store.getSession('D:\\a', 'x')?.report?.receivedAt).toBe(1);
    expect(store.size).toBe(2);
  });

  it('sets declaredAt once and moves lastHeardAt on every contact', () => {
    store.putReport(report({ sessionId: 'a1' }), 1_000);
    store.putReport(report({ sessionId: 'a1' }), 5_000);

    const session = store.getSession('D:\\Codelib\\example', 'a1');
    expect(session?.declaredAt).toBe(1_000);
    expect(session?.lastHeardAt).toBe(5_000);
  });

  it('moves lastHeardAt for a note too — an agent adding notes is being heard from', () => {
    store.putReport(report({ sessionId: 'a1' }), 1_000);
    store.appendNote(note({ sessionId: 'a1' }), 9_000);

    const session = store.getSession('D:\\Codelib\\example', 'a1');
    expect(session?.declaredAt).toBe(1_000);
    expect(session?.lastHeardAt).toBe(9_000);
  });

  it('attributes a push with no session identity to the unattributed session', () => {
    store.putReport(report(), 1);

    const session = store.getSession('D:\\Codelib\\example', UNATTRIBUTED);
    expect(session?.sessionId).toBe(UNATTRIBUTED);
    expect(session?.attributed).toBe(false);
  });

  it('shares one unattributed session per repository', () => {
    // A hook firing per tool call must not fill the switcher with one-shot entries.
    store.putReport(report(), 1);
    store.putReport(report(), 2);
    store.putReport(report({ repo: 'D:\\Codelib\\other' }), 3);

    expect(store.size).toBe(2);
  });

  it('marks a push carrying a session identity as attributed', () => {
    store.putReport(report({ sessionId: 'a1' }), 1);
    expect(store.getSession('D:\\Codelib\\example', 'a1')?.attributed).toBe(true);
  });

  it('refuses to let a client claim the reserved id as an agent', () => {
    // Showing a hook as an agent narrating would misrepresent where the
    // information came from, whether the client omitted the id or spelled it out.
    store.putReport(report({ sessionId: UNATTRIBUTED }), 1);

    expect(store.getSession('D:\\Codelib\\example', UNATTRIBUTED)?.attributed).toBe(false);
  });

  it('records the arrival time it was given, never one from the payload', () => {
    // A client-supplied receivedAt was already stripped by the schema; the store
    // only ever sees the caller's clock.
    const parsed = report({ sessionId: 'a1', receivedAt: 999 });
    expect(parsed).not.toHaveProperty('receivedAt');

    store.putReport(parsed, 4_242);
    expect(store.getSession('D:\\Codelib\\example', 'a1')?.report?.receivedAt).toBe(4_242);
  });

  it('lists sessions in declaration order, not by recency', () => {
    store.putReport(report({ sessionId: 'first' }), 1);
    store.putReport(report({ sessionId: 'second' }), 2);
    store.putReport(report({ sessionId: 'first' }), 3);

    expect(store.listSessions().map((s) => s.sessionId)).toEqual(['first', 'second']);
  });

  it('notifies subscribers in-process when state changes', () => {
    const seen = vi.fn();
    const unsubscribe = store.subscribe(seen);

    store.putReport(report({ sessionId: 'a1' }), 1);
    store.appendNote(note({ sessionId: 'a1' }), 2);
    store.dismiss('D:\\Codelib\\example', 'a1');

    expect(seen.mock.calls.map(([change]) => (change as { type: string }).type)).toEqual([
      'report',
      'note',
      'dismiss',
    ]);

    unsubscribe();
    store.putReport(report({ sessionId: 'a1' }), 3);
    expect(seen).toHaveBeenCalledTimes(3);
  });

  it('starts holding nothing, which is what a restart leaves behind', () => {
    expect(new Store().listSessions()).toEqual([]);
  });

  it('recreates a dismissed session on the next push — dismiss is not muting', () => {
    store.putReport(report({ sessionId: 'a1' }), 1);
    expect(store.dismiss('D:\\Codelib\\example', 'a1')).toBe(true);
    expect(store.size).toBe(0);

    store.putReport(report({ sessionId: 'a1' }), 2);
    expect(store.getSession('D:\\Codelib\\example', 'a1')?.declaredAt).toBe(2);
  });

  it('dismisses by the key the window was given, without parsing it apart', () => {
    // The window holds keys rather than the repo/id pair, so this is the path a
    // dismiss control actually takes. The NUL join is a security property, and
    // keeping it unparsed outside this file is how it stays one.
    store.putReport(report({ sessionId: 'a1' }), 1);

    expect(store.dismissByKey(sessionKey('D:\\Codelib\\example', 'a1'))).toBe(true);
    expect(store.size).toBe(0);
  });

  it('treats an unknown key as a no-op rather than an error', () => {
    // Dismissing a session that a report already replaced, or that another
    // click already removed, must not throw at a window that cannot catch it.
    const seen = vi.fn();
    store.subscribe(seen);

    expect(store.dismissByKey('nothing like a key')).toBe(false);
    expect(store.dismissByKey(sessionKey('D:\\Codelib\\example', 'gone'))).toBe(false);
    expect(seen).not.toHaveBeenCalled();
  });
});

/**
 * Feature 011's one exception to snapshot-replace.
 *
 * `putReport` argues for it at length; these are the properties that argument
 * rests on, so if any of them fails the argument fails with it.
 */
describe('Store — a session that has reported stories stays one', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  function flag(sessionId: string): boolean | undefined {
    return store.getSession('D:\\Codelib\\example', sessionId)?.everReportedStories;
  }

  it('is false for a session whose reports have never carried a story', () => {
    store.putReport(report({ sessionId: 'plain' }), 1);

    // The precondition, asserted rather than assumed: this session really did
    // report, and really did report no stories.
    expect(store.getSession('D:\\Codelib\\example', 'plain')?.report?.stories).toEqual([]);
    expect(flag('plain')).toBe(false);
  });

  it('is false for a session that has only ever sent notes', () => {
    store.appendNote(note({ sessionId: 'noisy' }), 1);

    expect(flag('noisy')).toBe(false);
  });

  it('is set by a report carrying a story', () => {
    store.putReport(withStory({ sessionId: 'spec' }), 1);

    expect(flag('spec')).toBe(true);
  });

  it('survives ten later reports carrying none — FR-003 as a unit fact', () => {
    store.putReport(withStory({ sessionId: 'spec' }), 1);

    for (let i = 0; i < 10; i += 1) store.putReport(report({ sessionId: 'spec' }), 2 + i);

    // The snapshot really has been replaced by one with no stories...
    expect(store.getSession('D:\\Codelib\\example', 'spec')?.report?.stories).toEqual([]);
    // ...and the session is still Spec-Kit shaped, which is the whole point.
    expect(flag('spec')).toBe(true);
  });

  it('is monotonic: no sequence of reports or notes returns it to false', () => {
    // The property the decision 26 argument rests on. There is exactly one wrong
    // state — never set — rather than a value that can drift back and forth.
    store.putReport(withStory({ sessionId: 'spec' }), 1);

    const sequence: Array<() => void> = [
      () => store.putReport(report({ sessionId: 'spec' }), 2),
      () => store.appendNote(note({ sessionId: 'spec' }), 3),
      () => store.putReport(report({ sessionId: 'spec', tasks: [] }), 4),
      () => store.putReport(withStory({ sessionId: 'spec' }), 5),
      () => store.putReport(report({ sessionId: 'spec' }), 6),
    ];

    for (const step of sequence) {
      step();
      expect(flag('spec')).toBe(true);
    }
  });

  it('is held per session, not per repository', () => {
    store.putReport(withStory({ sessionId: 'spec' }), 1);
    store.putReport(report({ sessionId: 'plain' }), 2);

    expect(flag('spec')).toBe(true);
    expect(flag('plain')).toBe(false);
  });

  it('goes with the session on dismissal, and a recreated session starts over', () => {
    store.putReport(withStory({ sessionId: 'spec' }), 1);
    expect(store.dismiss('D:\\Codelib\\example', 'spec')).toBe(true);

    store.putReport(report({ sessionId: 'spec' }), 2);
    expect(flag('spec')).toBe(false);
  });
});

describe('Store — a ticket is held in its own branch', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  const held = (sessionId = UNATTRIBUTED) =>
    store.getSession('D:\\Codelib\\example', sessionId);

  it('holds a reported ticket and stamps when it arrived', () => {
    const result = store.putTicket(ticket(), 1_000);

    expect(result.ok).toBe(true);
    expect(held()?.ticket?.key).toBe('PROJ-1234');
    expect(held()?.ticketReportedAt).toBe(1_000);
  });

  it('opens a session for a ticket, as a report or a note would', () => {
    // FR-006: first contact may be any of the three. A ticket arriving first
    // must not be dropped for want of a session to attach it to.
    expect(store.size).toBe(0);
    store.putTicket(ticket(), 1);

    expect(store.size).toBe(1);
    expect(held()?.report).toBeNull();
  });

  it('replaces the ticket wholesale rather than merging fields', () => {
    /*
     * A field-level update would let two partial reports compose into a ticket
     * that never existed in the tracker — this one's title beside that one's
     * criteria, shown to a developer as a single record. The second report is
     * authoritative in full, exactly as a push is.
     */
    store.putTicket(ticket({ state: 'In Progress', labels: ['regression'], assignee: 'A. Dev' }), 1);
    store.putTicket(ticket({ key: 'PROJ-9999', title: 'Something else' }), 2);

    const after = held()?.ticket;
    expect(after?.key).toBe('PROJ-9999');
    expect(after?.state).toBeNull();
    expect(after?.labels).toEqual([]);
    expect(after?.assignee).toBeNull();
  });

  it('leaves the ticket untouched through ten reports that say nothing about it', () => {
    /*
     * **FR-003 as a unit fact, and the assertion is about reach rather than
     * memory.** The ticket survives not because `putReport` preserves it but
     * because `putReport` cannot address it: there is no path from the report
     * schema to this field. Ten iterations rather than one because a guard that
     * worked once and decayed — a stale copy, a reset on some later branch —
     * would pass a single-call version of this test.
     */
    store.putTicket(ticket({ description: 'Tabbing past the password field.' }), 1);

    for (let i = 0; i < 10; i += 1) {
      store.putReport(report({ tasks: [{ id: `T${i}`, title: 'work', status: 'active' }] }), 2 + i);
      expect(held()?.ticket?.key, `after report ${i}`).toBe('PROJ-1234');
      expect(held()?.ticketReportedAt, `after report ${i}`).toBe(1);
    }

    expect(held()?.ticket?.description).toBe('Tabbing past the password field.');
    // And the reports really were landing, so the loop above is not vacuous.
    expect(held()?.report?.tasks).toHaveLength(1);
    expect(held()?.report?.tasks[0]?.id).toBe('T9');
  });

  it('leaves the ticket untouched through notes and story reports too', () => {
    store.putTicket(ticket(), 1);
    store.appendNote(note(), 2);
    store.putReport(withStory(), 3);

    expect(held()?.ticket?.key).toBe('PROJ-1234');
    expect(held()?.notes).toHaveLength(1);
  });

  it('does not move ticketReportedAt when an ordinary report arrives', () => {
    // FR-011 asks how long ago the *ticket* was fetched from the tracker. An
    // agent reporting its own work is not news about the tracker, so a report
    // resetting this to zero would answer a question nobody asked.
    store.putTicket(ticket(), 1_000);
    store.putReport(report(), 5_000);

    expect(held()?.ticketReportedAt).toBe(1_000);
    expect(held()?.lastHeardAt).toBe(5_000);
  });

  it('moves lastHeardAt, because reporting a ticket is the agent speaking', () => {
    // The one way this differs from `putTranscript`, which deliberately does not
    // move it: another program touching a file it owns is not the agent talking.
    store.putReport(report(), 1_000);
    store.putTicket(ticket(), 4_000);

    expect(held()?.lastHeardAt).toBe(4_000);
  });

  it('holds a ticket per session, not per repository', () => {
    store.putTicket(TicketRequest.parse({ ...ticket(), sessionId: 'a' }), 1);
    store.putReport(report({ sessionId: 'b' }), 2);

    expect(held('a')?.ticket?.key).toBe('PROJ-1234');
    expect(held('b')?.ticket).toBeNull();
  });

  it('takes the ticket with the session on dismissal, and brings it back on report', () => {
    store.putTicket(ticket(), 1);
    expect(store.dismiss('D:\\Codelib\\example', UNATTRIBUTED)).toBe(true);

    store.putReport(report(), 2);
    expect(held()?.ticket).toBeNull();
    expect(held()?.ticketReportedAt).toBeNull();

    store.putTicket(ticket(), 3);
    expect(held()?.ticket?.key).toBe('PROJ-1234');
  });

  it('announces a ticket change, distinctly from a report', () => {
    const seen: string[] = [];
    store.subscribe((change) => seen.push(change.type));

    store.putTicket(ticket(), 1);
    store.putReport(report(), 2);

    expect(seen).toEqual(['ticket', 'report']);
  });
});
