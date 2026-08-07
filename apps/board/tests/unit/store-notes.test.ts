import { NoteRequest, PushRequest } from '@cocoapilot/contract';
import { beforeEach, describe, expect, it } from 'vitest';

import { Store } from '../../src/main/store.js';

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

describe('Store — notes accumulate', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('keeps notes in the order they arrived', () => {
    store.appendNote(note({ text: 'first' }), 1);
    store.appendNote(note({ text: 'second' }), 2);
    store.appendNote(note({ text: 'third' }), 3);

    expect(store.getSession(REPO, 'a1')?.notes.map((n) => n.text)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('creates the session when a note is the first thing to arrive', () => {
    store.appendNote(note(), 1);

    const session = store.getSession(REPO, 'a1');
    expect(session?.report).toBeNull();
    expect(session?.notes).toHaveLength(1);
    expect(session?.declaredAt).toBe(1);
  });

  it('leaves the notes alone when a report replaces the reported state', () => {
    // Notes are the one accumulating structure in the system, and the sole
    // exception to snapshot-replace. Folding them into the snapshot would force
    // an agent to resend every note it had ever written in order to add one.
    store.appendNote(note({ text: 'keep me' }), 1);
    store.putReport(report({ tasks: [{ id: 'T001', title: 'x', status: 'todo' }] }), 2);
    store.putReport(report(), 3);

    const session = store.getSession(REPO, 'a1');
    expect(session?.notes.map((n) => n.text)).toEqual(['keep me']);
    expect(session?.report?.tasks).toEqual([]);
  });

  it('leaves the reported state alone when a note arrives', () => {
    store.putReport(report({ feature: { id: '001', title: 'Push contract' } }), 1);
    const before = structuredClone(store.getSession(REPO, 'a1')?.report);

    store.appendNote(note(), 2);

    expect(store.getSession(REPO, 'a1')?.report).toEqual(before);
  });

  it('keeps the reason a note exists alongside its text', () => {
    store.appendNote(note({ text: 'the harness never sets the cookie', source: 'you asked' }), 1);

    expect(store.getSession(REPO, 'a1')?.notes[0]).toEqual({
      text: 'the harness never sets the cookie',
      source: 'you asked',
      receivedAt: 1,
    });
  });

  it('defaults the reason to nothing rather than inventing one', () => {
    store.appendNote(note(), 1);
    expect(store.getSession(REPO, 'a1')?.notes[0]?.source).toBeNull();
  });

  it('stamps each note with the arrival time it was given', () => {
    store.appendNote(note({ text: 'first' }), 100);
    store.appendNote(note({ text: 'second' }), 200);

    expect(store.getSession(REPO, 'a1')?.notes.map((n) => n.receivedAt)).toEqual([100, 200]);
  });

  it('moves lastHeardAt but never declaredAt', () => {
    store.appendNote(note(), 1_000);
    store.appendNote(note(), 8_000);

    const session = store.getSession(REPO, 'a1');
    expect(session?.declaredAt).toBe(1_000);
    expect(session?.lastHeardAt).toBe(8_000);
  });

  it('loses every note when the store goes away', () => {
    store.appendNote(note(), 1);
    expect(new Store().getSession(REPO, 'a1')).toBeUndefined();
  });
});
