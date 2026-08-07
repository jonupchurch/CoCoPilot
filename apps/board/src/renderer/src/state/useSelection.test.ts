import type { Story, Task } from '@cocoapilot/contract';
import { describe, expect, it } from 'vitest';

import { buildScopes, resolve, UNASSIGNED } from './useSelection.js';

/**
 * The one piece of branching in feature 006, and the one quickstart.md names as
 * most likely to break first.
 *
 * Tested as pure functions rather than through the hook: `buildScopes` and
 * `resolve` are the whole of the logic, and `useSelection` is two `useState`
 * calls around them. Rendering a hook to assert this would test React.
 */

const story = (id: string, overrides: Partial<Story> = {}): Story => ({
  id,
  title: `Story ${id}`,
  priority: null,
  status: null,
  asA: null,
  want: null,
  soThat: null,
  criteria: [],
  taskIds: [],
  files: [],
  ...overrides,
});

const task = (id: string, storyId: string | null = null): Task => ({
  id,
  storyId,
  title: `Task ${id}`,
  status: 'todo',
  detail: null,
  checks: [],
  files: [],
});

const ids = (scopes: readonly { id: string }[]): string[] => scopes.map((s) => s.id);
const taskIds = (scope: { tasks: readonly Task[] } | null): string[] =>
  scope === null ? [] : scope.tasks.map((t) => t.id);

describe('which tasks belong to which story', () => {
  it('takes the relationship from the task, pointing up', () => {
    const scopes = buildScopes([story('US-1'), story('US-2')], [task('T-1', 'US-1'), task('T-2', 'US-2')]);

    expect(ids(scopes)).toEqual(['US-1', 'US-2']);
    expect(taskIds(scopes[0] ?? null)).toEqual(['T-1']);
    expect(taskIds(scopes[1] ?? null)).toEqual(['T-2']);
  });

  it('takes it from the story, pointing down', () => {
    // An agent that fills `taskIds` and leaves `storyId` null would otherwise
    // see every task list empty.
    const scopes = buildScopes([story('US-1', { taskIds: ['T-1', 'T-2'] })], [task('T-1'), task('T-2')]);

    expect(taskIds(scopes[0] ?? null)).toEqual(['T-1', 'T-2']);
  });

  it('takes the union when the two disagree, without duplicating a task', () => {
    const scopes = buildScopes(
      [story('US-1', { taskIds: ['T-2'] })],
      [task('T-1', 'US-1'), task('T-2', 'US-1')],
    );

    expect(taskIds(scopes[0] ?? null)).toEqual(['T-1', 'T-2']);
  });

  it('shows a task under both stories when the two fields disagree about it', () => {
    // The agent's inconsistency, shown rather than resolved: picking a winner
    // would hide the task from wherever the developer went looking for it.
    const scopes = buildScopes(
      [story('US-1', { taskIds: ['T-1'] }), story('US-2')],
      [task('T-1', 'US-2')],
    );

    expect(taskIds(scopes[0] ?? null)).toEqual(['T-1']);
    expect(taskIds(scopes[1] ?? null)).toEqual(['T-1']);
    expect(ids(scopes)).toEqual(['US-1', 'US-2']);
  });

  it('keeps reported task order inside a scope', () => {
    const scopes = buildScopes(
      [story('US-1')],
      [task('T-9', 'US-1'), task('T-1', 'US-1'), task('T-5', 'US-1')],
    );

    // Not sorted, not renumbered. The agent's order is the order.
    expect(taskIds(scopes[0] ?? null)).toEqual(['T-9', 'T-1', 'T-5']);
  });

  it('keeps reported story order', () => {
    expect(ids(buildScopes([story('US-9'), story('US-1')], []))).toEqual(['US-9', 'US-1']);
  });

  it('never fabricates a task a story claims but nobody reported', () => {
    const scopes = buildScopes([story('US-1', { taskIds: ['T-1', 'T-ghost'] })], [task('T-1')]);

    expect(taskIds(scopes[0] ?? null)).toEqual(['T-1']);
  });
});

describe('tasks belonging to no reported story', () => {
  it('gathers a null storyId into the unassigned scope', () => {
    const scopes = buildScopes([story('US-1')], [task('T-1', 'US-1'), task('T-2')]);

    expect(ids(scopes)).toEqual(['US-1', UNASSIGNED]);
    expect(taskIds(scopes[1] ?? null)).toEqual(['T-2']);
    expect(scopes[1]?.story).toBeNull();
  });

  it('gathers a storyId naming a story that was never reported', () => {
    // FR-018. Nothing validates that an agent reports a consistent graph.
    const scopes = buildScopes([story('US-1')], [task('T-1', 'US-404')]);

    expect(ids(scopes)).toEqual(['US-1', UNASSIGNED]);
    expect(taskIds(scopes[1] ?? null)).toEqual(['T-1']);
  });

  it('is absent entirely when every task has a home', () => {
    expect(ids(buildScopes([story('US-1')], [task('T-1', 'US-1')]))).toEqual(['US-1']);
  });

  it('is the only scope when no stories were reported at all', () => {
    const scopes = buildScopes([], [task('T-1'), task('T-2')]);

    expect(ids(scopes)).toEqual([UNASSIGNED]);
    expect(taskIds(scopes[0] ?? null)).toEqual(['T-1', 'T-2']);
  });

  it('comes last, after every reported story', () => {
    const scopes = buildScopes([story('US-1'), story('US-2')], [task('T-1')]);

    expect(ids(scopes).at(-1)).toBe(UNASSIGNED);
  });

  it('cannot be collided with by a story that names itself the sentinel', () => {
    // `Label` is any string, so a story really could be called this.
    const scopes = buildScopes([story(UNASSIGNED)], [task('T-1')]);

    // Two scopes, not one: the reported story and the real unassigned bucket.
    expect(scopes).toHaveLength(2);
    expect(scopes[0]?.story).not.toBeNull();
    expect(scopes[1]?.story).toBeNull();
  });
});

describe('a selection that survives a report', () => {
  const scopes = buildScopes(
    [story('US-1'), story('US-2')],
    [task('T-1', 'US-1'), task('T-2', 'US-2'), task('T-3', 'US-2')],
  );

  it('keeps the story and task the developer chose', () => {
    const { scope, task: chosen } = resolve(scopes, 'US-2', 'T-3');

    expect(scope?.id).toBe('US-2');
    expect(chosen?.id).toBe('T-3');
  });

  it('falls back to the first story when the chosen one is gone', () => {
    // FR-015. Reports replace wholesale, so this is ordinary.
    const { scope } = resolve(scopes, 'US-404', null);

    expect(scope?.id).toBe('US-1');
  });

  it('falls back to the first item rather than the nearest by position', () => {
    // Keeping the position looks smoother and is worse: the developer reads on
    // at the same spot without noticing the content underneath them changed.
    const three = buildScopes([story('A'), story('B'), story('C')], []);

    expect(resolve(three, 'B-gone', null).scope?.id).toBe('A');
  });

  it('falls back to the first task when the chosen one is gone but the story is not', () => {
    const { scope, task: chosen } = resolve(scopes, 'US-2', 'T-404');

    expect(scope?.id).toBe('US-2');
    expect(chosen?.id).toBe('T-2');
  });

  it('carries the task down with the story when both disappear', () => {
    const { scope, task: chosen } = resolve(scopes, 'US-404', 'T-3');

    expect(scope?.id).toBe('US-1');
    // Not `T-3`, which belongs to a scope nobody is looking at any more.
    expect(chosen?.id).toBe('T-1');
  });

  it('resolves to nothing, without throwing, for an empty report', () => {
    expect(resolve([], 'US-1', 'T-1')).toEqual({ scope: null, task: null });
  });

  it('resolves a scope with no tasks to a null task rather than throwing', () => {
    const empty = buildScopes([story('US-1')], []);

    expect(resolve(empty, 'US-1', 'T-1')).toEqual({ scope: empty[0], task: null });
  });

  it('picks the first of everything when nothing has been chosen yet', () => {
    const { scope, task: chosen } = resolve(scopes, null, null);

    expect(scope?.id).toBe('US-1');
    expect(chosen?.id).toBe('T-1');
  });
});
