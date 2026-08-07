import { NoteRequest, PushRequest } from '@cocopilot/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Store, UNATTRIBUTED } from '../../src/main/store.js';

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
});
