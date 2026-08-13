import type { Story, Task } from 'cocoapilot-contract';
import { describe, expect, it } from 'vitest';

import { place } from './usePlacement.js';
import { defaultOpen, isOpen, resolveSelection } from './useTreeState.js';
import { UNASSIGNED } from './useSelection.js';

/**
 * The two rules the tree holds: what a selection resolves to across a report
 * that may have deleted it, and which stories are open.
 *
 * The expansion tests are the ones worth reading. A design that held a set of
 * open ids passes the obvious cases and fails the last two, which is why the
 * deviation is what is stored.
 */

function story(id: string, taskIds: string[] = []): Story {
  return {
    id,
    title: `Story ${id}`,
    priority: null,
    status: null,
    asA: null,
    want: null,
    soThat: null,
    criteria: [],
    taskIds,
    files: [],
  };
}

function task(id: string, storyId: string | null = null): Task {
  return { id, storyId, title: `Task ${id}`, status: 'todo', detail: null, checks: [], files: [] };
}

const SCOPES = place(
  [story('A'), story('B')],
  [task('a1', 'A'), task('a2', 'A'), task('b1', 'B'), task('loose')],
).scopes;

describe('resolveSelection', () => {
  it('resolves nothing when nothing has been selected', () => {
    expect(resolveSelection(SCOPES, null)).toEqual({ scope: null, task: null, missing: false });
  });

  it('resolves a selected story', () => {
    const resolved = resolveSelection(SCOPES, { kind: 'story', id: 'B' });

    expect(resolved.scope?.story?.id).toBe('B');
    expect(resolved.task).toBeNull();
    expect(resolved.missing).toBe(false);
  });

  it('resolves a selected task, and the story above it', () => {
    const resolved = resolveSelection(SCOPES, { kind: 'task', id: 'a2' });

    expect(resolved.task?.id).toBe('a2');
    expect(resolved.scope?.story?.id).toBe('A');
  });

  it('resolves a task in the unassigned group, which has no story above it', () => {
    const resolved = resolveSelection(SCOPES, { kind: 'task', id: 'loose' });

    expect(resolved.task?.id).toBe('loose');
    expect(resolved.scope?.story ?? null).toBeNull();
    expect(resolved.missing).toBe(false);
  });

  it('keeps a selection the next report still contains', () => {
    const later = place([story('A'), story('B')], [task('a2', 'A'), task('b1', 'B')]).scopes;

    const resolved = resolveSelection(later, { kind: 'task', id: 'a2' });

    expect(resolved.task?.id).toBe('a2');
    expect(resolved.missing).toBe(false);
  });

  it('reports a dropped task as missing rather than selecting another', () => {
    // The divergence from `resolve` in useSelection.ts, which would land on the
    // scope's first task here. FR-034 wants the view to say so instead.
    const later = place([story('A')], [task('a1', 'A')]).scopes;

    const resolved = resolveSelection(later, { kind: 'task', id: 'a2' });

    expect(resolved.missing).toBe(true);
    expect(resolved.task).toBeNull();
    expect(resolved.scope?.story ?? null).toBeNull();
  });

  it('reports a dropped story as missing rather than selecting another', () => {
    const later = place([story('A')], [task('a1', 'A')]).scopes;

    const resolved = resolveSelection(later, { kind: 'story', id: 'B' });

    expect(resolved.missing).toBe(true);
    expect(resolved.scope?.story ?? null).toBeNull();
  });

  it('never reports missing for a selection that resolved', () => {
    for (const scope of SCOPES) {
      expect(resolveSelection(SCOPES, { kind: 'story', id: scope.id }).missing).toBe(false);
      for (const t of scope.tasks) {
        expect(resolveSelection(SCOPES, { kind: 'task', id: t.id }).missing).toBe(false);
      }
    }
  });
});

describe('defaultOpen', () => {
  it('opens the story holding the task the agent reports as current', () => {
    expect(defaultOpen(SCOPES[0]!, 'a1')).toBe(true);
    expect(defaultOpen(SCOPES[1]!, 'a1')).toBe(false);
  });

  it('opens nothing when no current task was reported', () => {
    for (const scope of SCOPES) expect(defaultOpen(scope, '')).toBe(false);
  });

  it('opens nothing when the current task names something not in the tree', () => {
    for (const scope of SCOPES) expect(defaultOpen(scope, 'nowhere')).toBe(false);
  });

  it('opens the unassigned group when the current task is in it', () => {
    const unassigned = SCOPES.find((scope) => scope.id === UNASSIGNED)!;

    expect(defaultOpen(unassigned, 'loose')).toBe(true);
  });
});

describe('isOpen — the deviation is what is stored', () => {
  const A = SCOPES[0]!;
  const B = SCOPES[1]!;

  it('follows the default when the developer has touched nothing', () => {
    expect(isOpen(A, 'a1', new Set())).toBe(true);
    expect(isOpen(B, 'a1', new Set())).toBe(false);
  });

  it('opens a story the developer opened against a closed default', () => {
    expect(isOpen(B, 'a1', new Set(['B']))).toBe(true);
  });

  it('closes the focus story when the developer closed it', () => {
    expect(isOpen(A, 'a1', new Set(['A']))).toBe(false);
  });

  it("survives a report: a developer's collapse of the focus story holds", () => {
    // The case a set-of-open-ids design gets wrong. The developer collapses the
    // focus story; the agent goes on reporting the same current task; the story
    // must stay closed rather than springing open on every report.
    const toggled = new Set(['A']);

    for (let report = 0; report < 10; report += 1) {
      expect(isOpen(A, 'a1', toggled)).toBe(false);
    }
  });

  it('lets the default move with the agent without undoing a deliberate collapse', () => {
    // The developer collapsed B. The agent moves from a task in A to one in B,
    // so B's default flips to open — and the collapse still wins, because what
    // is stored is "the developer disagrees with the default", not "closed".
    const toggled = new Set(['B']);

    expect(isOpen(B, 'a1', toggled)).toBe(true); // default closed, toggled → open
    expect(isOpen(B, 'b1', toggled)).toBe(false); // default open, toggled → closed
  });

  it('returns to the default when toggled twice', () => {
    const once = new Set(['B']);
    const twice = new Set<string>();

    expect(isOpen(B, 'a1', once)).toBe(true);
    expect(isOpen(B, 'a1', twice)).toBe(false);
  });
});
