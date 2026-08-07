import { PushRequest } from '@cocoapilot/contract';
import { beforeEach, describe, expect, it } from 'vitest';

import { Store } from '../../src/main/store.js';

const REPO = 'D:\\Codelib\\example';

function report(overrides: Record<string, unknown> = {}): PushRequest {
  return PushRequest.parse({ repo: REPO, branch: 'main', sessionId: 'a1', ...overrides });
}

function tasks(count: number): Array<Record<string, string>> {
  return Array.from({ length: count }, (_, index) => ({
    id: `T${String(index + 1).padStart(3, '0')}`,
    title: `Task ${index + 1}`,
    status: 'todo',
  }));
}

describe('Store — a newer report replaces the older one', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store();
  });

  it('holds exactly what the newer report listed', () => {
    store.putReport(report({ tasks: tasks(5) }), 1);
    store.putReport(report({ tasks: tasks(3) }), 2);

    expect(store.getSession(REPO, 'a1')?.report?.tasks).toHaveLength(3);
  });

  it('retains nothing at all from the report it replaced', () => {
    // The second report must be a strict *subset* of the first. A merge bug is
    // invisible when the newer report is a superset, so a superset proves
    // nothing -- this is the check that actually matters.
    const SENTINEL = 'only-in-the-first-report';

    store.putReport(
      report({
        feature: { id: SENTINEL, title: SENTINEL, specPath: SENTINEL },
        stories: [{ id: SENTINEL, title: SENTINEL, criteria: [SENTINEL], taskIds: [SENTINEL] }],
        tasks: [{ id: SENTINEL, title: SENTINEL, status: SENTINEL, detail: SENTINEL }],
        plan: [{ text: SENTINEL, status: SENTINEL }],
        focus: { task: SENTINEL, note: SENTINEL, chip: 'needs-you' },
        changedFiles: [{ path: SENTINEL, change: SENTINEL, note: SENTINEL }],
      }),
      1,
    );

    store.putReport(report({ tasks: [{ id: 'T001', title: 'Only this', status: 'todo' }] }), 2);

    const held = store.getSession(REPO, 'a1')?.report;
    expect(JSON.stringify(held)).not.toContain(SENTINEL);
    expect(held?.feature).toBeNull();
    expect(held?.focus).toBeNull();
    expect(held?.stories).toEqual([]);
    expect(held?.plan).toEqual([]);
    expect(held?.changedFiles).toEqual([]);
  });

  it('is idempotent — the same report twice leaves what one would have', () => {
    const once = new Store();
    once.putReport(report({ tasks: tasks(4) }), 7);

    store.putReport(report({ tasks: tasks(4) }), 7);
    store.putReport(report({ tasks: tasks(4) }), 7);

    expect(store.getSession(REPO, 'a1')).toEqual(once.getSession(REPO, 'a1'));
  });

  it('replaces per session, not across them', () => {
    store.putReport(report({ sessionId: 'a1', tasks: tasks(5) }), 1);
    store.putReport(report({ sessionId: 'b2', tasks: tasks(1) }), 2);

    expect(store.getSession(REPO, 'a1')?.report?.tasks).toHaveLength(5);
    expect(store.getSession(REPO, 'b2')?.report?.tasks).toHaveLength(1);
  });

  it('replaces per repository, not across them', () => {
    store.putReport(report({ repo: 'D:\\one', tasks: tasks(5) }), 1);
    store.putReport(report({ repo: 'D:\\two', tasks: tasks(1) }), 2);

    expect(store.getSession('D:\\one', 'a1')?.report?.tasks).toHaveLength(5);
    expect(store.getSession('D:\\two', 'a1')?.report?.tasks).toHaveLength(1);
  });

  it('keeps the branch current, because a report carries its own', () => {
    store.putReport(report({ branch: 'main' }), 1);
    store.putReport(report({ branch: 'feat/session-hook' }), 2);

    expect(store.getSession(REPO, 'a1')?.branch).toBe('feat/session-hook');
  });
});
