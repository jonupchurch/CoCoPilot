import { useMemo, useState } from 'react';

import type { Story, Task } from '@cocoapilot/contract';

/**
 * Which story and which task the developer is reading, across a report that may
 * have deleted either of them.
 *
 * **Reconciliation is derivation, not synchronisation.** What is held is the
 * *intent* — an id someone clicked — and the resolved selection is computed
 * from the current report on every render. There is no effect watching for
 * reports and no copy of the story to go stale, so FR-014 ("keep the selection
 * if it still exists") and FR-015 ("move somewhere valid if it does not") are
 * the same two lines of code rather than a lifecycle to get right.
 *
 * Reports replace wholesale (decision 26), so a story ceasing to exist between
 * one report and the next is ordinary rather than exceptional. A view that
 * rendered nothing in that case would read as a crash.
 */

/**
 * The scope that holds tasks belonging to no reported story.
 *
 * FR-018 requires every reported task to be reachable, and nothing validates
 * that an agent reports a consistent graph: `storyId` may be null, or may name
 * a story that was never sent. The design export has no such scope — it assumes
 * the graph resolves — so this is a deliberate addition rather than a
 * transcription, and it appears only when it actually holds something.
 *
 * The NUL is the same trick `store.ts` uses for session keys: it makes the
 * sentinel unable to collide with a reported `Label`, which is otherwise any
 * string at all.
 */
export const UNASSIGNED = '\0unassigned';

/**
 * A scope's name for a `data-testid` or a React key.
 *
 * `UNASSIGNED` carries a NUL so it cannot collide with a reported `Label`, and
 * a NUL in a DOM attribute is legal but not addressable from a test. This is the
 * one place that translation happens, so every view spells it the same way.
 */
export function scopeKey(scope: Scope): string {
  return scope.story === null ? 'unassigned' : scope.id;
}

export interface Scope {
  /** A story's id, or `UNASSIGNED`. Stable across reports, which is the point. */
  id: string;
  /** Null for the unassigned scope, which has no story behind it. */
  story: Story | null;
  /** In reported task order, never re-sorted. */
  tasks: Task[];
}

export interface Selection {
  /** Reported stories in reported order, plus the unassigned scope if it has any. */
  scopes: Scope[];
  /** The resolved scope, or null when nothing has been reported at all. */
  scope: Scope | null;
  /** The resolved story. Null for the unassigned scope and for an empty report. */
  story: Story | null;
  /** The resolved task within the scope, or null when the scope has none. */
  task: Task | null;
  selectScope: (id: string) => void;
  selectTask: (id: string) => void;
}

/**
 * A task belongs to a story if **either** of them says so.
 *
 * The contract carries the relationship twice — `task.storyId` pointing up and
 * `story.taskIds` pointing down — and nothing makes them agree. Reading only one
 * would show empty task lists to any agent that happened to fill the other, so
 * membership is the union, deduplicated, in reported task order.
 *
 * Two consequences, both accepted. A task can appear under two stories when the
 * two fields disagree; that is the agent's inconsistency and showing it in both
 * places is more honest than silently picking a winner. And a `taskIds` entry
 * naming a task that was never reported produces nothing — what was reported is
 * shown, and missing entries are not fabricated.
 */
export function buildScopes(stories: readonly Story[], tasks: readonly Task[]): Scope[] {
  const claimed = new Set<string>();

  const scopes: Scope[] = stories.map((story) => {
    const declared = new Set(story.taskIds);
    const mine = tasks.filter((task) => task.storyId === story.id || declared.has(task.id));
    for (const task of mine) claimed.add(task.id);
    return { id: story.id, story, tasks: mine };
  });

  const orphans = tasks.filter((task) => !claimed.has(task.id));
  if (orphans.length > 0) {
    scopes.push({ id: UNASSIGNED, story: null, tasks: orphans });
  }

  return scopes;
}

/**
 * The intent, resolved against what is actually there.
 *
 * **The fallback is the first item, not the nearest one.** Keeping the position
 * — showing whatever is now at the same index — looks smoother and is worse:
 * the developer carries on reading at the same spot without noticing the
 * content underneath them changed. Landing on the first item is obviously a
 * move, which is the point.
 */
export function resolve(
  scopes: readonly Scope[],
  wantedScope: string | null,
  wantedTask: string | null,
): { scope: Scope | null; task: Task | null } {
  const scope = scopes.find((candidate) => candidate.id === wantedScope) ?? scopes[0] ?? null;
  if (scope === undefined || scope === null) return { scope: null, task: null };

  const task = scope.tasks.find((candidate) => candidate.id === wantedTask) ?? scope.tasks[0] ?? null;
  return { scope, task };
}

export function useSelection(stories: readonly Story[], tasks: readonly Task[]): Selection {
  const [wantedScope, setWantedScope] = useState<string | null>(null);
  const [wantedTask, setWantedTask] = useState<string | null>(null);

  const scopes = useMemo(() => buildScopes(stories, tasks), [stories, tasks]);
  const { scope, task } = resolve(scopes, wantedScope, wantedTask);

  return {
    scopes,
    scope,
    story: scope?.story ?? null,
    task,
    selectScope: (id: string): void => {
      setWantedScope(id);
      // Choosing a story is choosing its first task, not keeping a task from
      // the story before it — which would resolve to that story's first task
      // anyway, one render later and less predictably.
      setWantedTask(null);
    },
    selectTask: setWantedTask,
  };
}
