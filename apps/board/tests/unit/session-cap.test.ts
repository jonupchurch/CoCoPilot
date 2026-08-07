import { MAX_NOTES_PER_SESSION, MAX_SESSIONS, NoteRequest, PushRequest } from '@cocopilot/contract';
import { describe, expect, it } from 'vitest';

import { Store } from '../../src/main/store.js';

const REPO = 'D:\\Codelib\\example';

function report(sessionId: string): PushRequest {
  return PushRequest.parse({ repo: REPO, branch: 'main', sessionId });
}

function note(sessionId: string, text = 'a note'): NoteRequest {
  return NoteRequest.parse({ repo: REPO, branch: 'main', sessionId, text });
}

function fill(store: Store, count: number): void {
  for (let index = 0; index < count; index += 1) {
    store.putReport(report(`session-${index}`), index);
  }
}

/**
 * At a cap the store refuses rather than evicting.
 *
 * Eviction would silently discard a session someone might be watching, and
 * would be the only place in the product where something disappears without
 * either a restart or a deliberate dismissal.
 */
describe('the session cap', () => {
  it(`accepts ${MAX_SESSIONS} sessions`, () => {
    const store = new Store();
    fill(store, MAX_SESSIONS);
    expect(store.size).toBe(MAX_SESSIONS);
  });

  it('refuses the one past the cap and says why', () => {
    const store = new Store();
    fill(store, MAX_SESSIONS);

    const result = store.putReport(report('one-too-many'), 1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.error).toBe('session_limit');
    expect(result.rejection.message).toContain(String(MAX_SESSIONS));
  });

  it('evicts nothing — every session already held survives the refusal', () => {
    const store = new Store();
    fill(store, MAX_SESSIONS);

    store.putReport(report('one-too-many'), 1);

    expect(store.size).toBe(MAX_SESSIONS);
    expect(store.getSession(REPO, 'session-0')).toBeDefined();
  });

  it('keeps accepting reports for sessions it already holds', () => {
    const store = new Store();
    fill(store, MAX_SESSIONS);

    const result = store.putReport(report('session-0'), 9_999);

    expect(result.ok).toBe(true);
    expect(store.getSession(REPO, 'session-0')?.lastHeardAt).toBe(9_999);
  });

  it('makes room again when a session is dismissed', () => {
    const store = new Store();
    fill(store, MAX_SESSIONS);
    store.dismiss(REPO, 'session-0');

    expect(store.putReport(report('one-more'), 1).ok).toBe(true);
  });

  it('applies to a note that would create a session too', () => {
    const store = new Store();
    fill(store, MAX_SESSIONS);

    const result = store.appendNote(note('one-too-many'), 1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.error).toBe('session_limit');
  });
});

describe('the note cap', () => {
  it(`accepts ${MAX_NOTES_PER_SESSION} notes and refuses the next`, () => {
    const store = new Store();
    for (let index = 0; index < MAX_NOTES_PER_SESSION; index += 1) {
      store.appendNote(note('a1', `note ${index}`), index);
    }

    expect(store.getSession(REPO, 'a1')?.notes).toHaveLength(MAX_NOTES_PER_SESSION);

    const result = store.appendNote(note('a1', 'one too many'), 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.rejection.error).toBe('note_limit');
    expect(result.rejection.field).toBe('text');
  });

  it('drops nothing when it refuses', () => {
    const store = new Store();
    for (let index = 0; index < MAX_NOTES_PER_SESSION; index += 1) {
      store.appendNote(note('a1', `note ${index}`), index);
    }
    store.appendNote(note('a1', 'one too many'), 1);

    const notes = store.getSession(REPO, 'a1')?.notes ?? [];
    expect(notes).toHaveLength(MAX_NOTES_PER_SESSION);
    expect(notes[0]?.text).toBe('note 0');
  });
});
