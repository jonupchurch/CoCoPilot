import type { Story, Task } from 'cocoapilot-contract';
import { describe, expect, it } from 'vitest';

import { place } from './usePlacement.js';
import { UNASSIGNED } from './useSelection.js';

/**
 * The rule in `contracts/placement.md`, one test per row of its table.
 *
 * The first block is the one that matters most: every task is drawn exactly
 * once, so `drawn === reported` catches most of what placement can get wrong in
 * a single assertion. The cases after it say *where* each task went.
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

/** Where a task ended up, by scope id, for the placement assertions below. */
function scopeOf(
  result: ReturnType<typeof place>,
  taskId: string,
): string | undefined {
  return result.scopes.find((scope) => scope.tasks.some((t) => t.id === taskId))?.id;
}

describe('place — every task is drawn exactly once', () => {
  it('draws as many tasks as were reported, over a report hitting every branch', () => {
    // One of each case in the contract's table, in one report, so the count is
    // meaningful rather than a tautology over a single shape.
    const stories = [
      story('A', ['agreed', 'claimed-by-b', 'named-by-two', 'never-reported']),
      story('B', ['named-by-two']),
      story('C'),
    ];
    const tasks = [
      task('agreed', 'A'), // both directions agree
      task('claimed-by-b', 'B'), // disagreement: task says B, story A claims it
      task('named-by-two'), // no storyId; named by A and B
      task('by-name-only'), // no storyId; named by nobody
      task('ghost-story', 'Z'), // names a story that was never reported
      task('orphan'), // names nothing, named by nobody
    ];

    const result = place(stories, tasks);

    expect(result.drawn).toBe(tasks.length);
    // And no task is drawn twice, which `drawn` alone would not catch if a task
    // were also missing.
    const drawnIds = result.scopes.flatMap((scope) => scope.tasks.map((t) => t.id));
    expect(new Set(drawnIds).size).toBe(tasks.length);
  });

  it('draws nothing and offers no scopes when nothing was reported', () => {
    const result = place([], []);

    expect(result.scopes).toEqual([]);
    expect(result.drawn).toBe(0);
  });
});

describe('place — where each task goes', () => {
  it('places a task under the story both directions agree on', () => {
    const result = place([story('A', ['t1'])], [task('t1', 'A')]);

    expect(scopeOf(result, 't1')).toBe('A');
    expect(result.drawn).toBe(1);
  });

  it("prefers the task's own storyId over a story claiming it", () => {
    // The row a plausible implementation gets wrong, because `buildScopes`
    // deliberately draws this task under both A and B.
    const result = place([story('A', ['t1']), story('B')], [task('t1', 'B')]);

    expect(scopeOf(result, 't1')).toBe('B');
    expect(result.scopes.find((s) => s.id === 'A')?.tasks).toEqual([]);
    expect(result.drawn).toBe(1);
  });

  it("uses a story's taskIds when the task names no story", () => {
    const result = place([story('A', ['t1'])], [task('t1')]);

    expect(scopeOf(result, 't1')).toBe('A');
  });

  it('places a task named by two stories under the first in reported order', () => {
    const result = place([story('A', ['t1']), story('B', ['t1'])], [task('t1')]);

    expect(scopeOf(result, 't1')).toBe('A');
    expect(result.drawn).toBe(1);
  });

  it('treats a task naming an unreported story as naming none, inventing nothing', () => {
    const result = place([story('A')], [task('t1', 'Z')]);

    expect(result.scopes.map((s) => s.id)).toEqual(['A', UNASSIGNED]);
    expect(scopeOf(result, 't1')).toBe(UNASSIGNED);
  });

  it('gathers a task belonging to no story into the unassigned scope', () => {
    const result = place([story('A')], [task('t1')]);

    expect(scopeOf(result, 't1')).toBe(UNASSIGNED);
  });

  it('omits the unassigned scope entirely when every task is placed', () => {
    const result = place([story('A', ['t1'])], [task('t1')]);

    expect(result.scopes.map((s) => s.id)).toEqual(['A']);
  });

  it('draws nothing for a taskIds entry naming a task that was never reported', () => {
    const result = place([story('A', ['missing'])], []);

    expect(result.scopes).toEqual([{ id: 'A', story: expect.objectContaining({ id: 'A' }), tasks: [] }]);
    expect(result.drawn).toBe(0);
  });

  it('draws both tasks that share an identifier, where each claims to belong', () => {
    // The board does not merge them or pick one; both were reported.
    const result = place([story('A'), story('B')], [task('dup', 'A'), task('dup', 'B')]);

    expect(result.scopes.find((s) => s.id === 'A')?.tasks).toHaveLength(1);
    expect(result.scopes.find((s) => s.id === 'B')?.tasks).toHaveLength(1);
    expect(result.drawn).toBe(2);
  });
});

describe('place — order is never the board’s opinion', () => {
  it('keeps stories in reported order, with unassigned last', () => {
    const result = place([story('C'), story('A'), story('B')], [task('orphan')]);

    expect(result.scopes.map((s) => s.id)).toEqual(['C', 'A', 'B', UNASSIGNED]);
  });

  it('keeps tasks in reported order within a story, not sorted by status or id', () => {
    const tasks = [task('z', 'A'), task('a', 'A'), task('m', 'A')];

    const result = place([story('A')], tasks);

    expect(result.scopes[0]?.tasks.map((t) => t.id)).toEqual(['z', 'a', 'm']);
  });

  it('offers a story with no tasks as an empty scope rather than omitting it', () => {
    const result = place([story('A'), story('B', ['t1'])], [task('t1')]);

    expect(result.scopes.map((s) => s.id)).toEqual(['A', 'B']);
    expect(result.scopes[0]?.tasks).toEqual([]);
  });
});
