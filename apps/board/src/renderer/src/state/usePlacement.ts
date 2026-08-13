import { useMemo } from 'react';

import type { Story, Task } from 'cocoapilot-contract';

import { type Scope, UNASSIGNED } from './useSelection.js';

/**
 * Where a reported task is drawn in the Spec-Kit tree.
 *
 * **There is a second placement rule in this codebase, and it is not a bug.**
 * `buildScopes` in `useSelection.ts` serves the Stories and Tasks views, which
 * go on running for every session that is not Spec-Kit shaped and every session
 * whose developer opened one of them. The two agree about almost everything —
 * both gather tasks belonging to no story rather than dropping them, for the
 * same reason — and differ on exactly one question.
 *
 * When a task names story A while story B's `taskIds` names that task,
 * `buildScopes` draws it under **both**, and argues for it: "showing it in both
 * places is more honest than silently picking a winner". That is right for two
 * scoped lists, where a task appearing in two scopes is visibly the same task
 * seen twice. It is wrong for a tree, where one task under two parents reads as
 * two tasks and makes the tree uncountable.
 *
 * So this rule picks a winner: the task's own `storyId`, because a task is the
 * closer authority on which story it serves. That is what buys the property the
 * tree needs — **every task is drawn exactly once** — which in turn makes
 * `tasks drawn === tasks reported` a single assertion covering most of what
 * placement can get wrong.
 *
 * `buildScopes` is superseded here, not corrected. Do not edit it to match this;
 * two views want different answers and both are entitled to theirs.
 */

/** What placement returns, alongside the scopes themselves. */
export interface Placement {
  /** Reported stories in reported order, plus the unassigned scope if it has any. */
  scopes: Scope[];
  /**
   * Every task drawn, across every scope. Equal to the number reported, always —
   * that is the invariant, and it is asserted rather than assumed.
   */
  drawn: number;
}

/**
 * The rule, in three steps, applied to each task in reported order.
 *
 *   1. The task's own `storyId`, when it names a story that was actually
 *      reported. Authoritative; nothing overrides it.
 *   2. Otherwise the first reported story whose `taskIds` names the task.
 *   3. Otherwise the unassigned scope, appended last and absent when empty.
 *
 * A task naming a story that was never reported falls through step 1 as though
 * it named nothing: the board does not invent a story to hold it. A `taskIds`
 * entry naming a task that was never reported produces nothing at all — what was
 * reported is drawn, and absences are not fabricated.
 *
 * Order is never touched. Stories keep reported order, tasks keep reported task
 * order within a story, and nothing is sorted by status, identifier or anything
 * else — reported order is a fact and any other order is the board's opinion.
 */
export function place(stories: readonly Story[], tasks: readonly Task[]): Placement {
  const byId = new Map(stories.map((story) => [story.id, story] as const));

  // Which story claims each task by name, resolved once so that step 2 is a
  // lookup rather than a scan per task. First claimant in reported story order
  // wins, so a task named by two stories lands in the earlier one.
  const claimedByName = new Map<string, string>();
  for (const story of stories) {
    for (const taskId of story.taskIds) {
      if (!claimedByName.has(taskId)) claimedByName.set(taskId, story.id);
    }
  }

  const home = new Map<string, Task[]>(stories.map((story) => [story.id, []] as const));
  const unassigned: Task[] = [];

  for (const task of tasks) {
    // Step 1. `byId.has` is what makes an unreported story fall through rather
    // than conjure a scope.
    const own = task.storyId !== null && byId.has(task.storyId) ? task.storyId : null;
    // Step 2. Only consulted when the task itself said nothing usable.
    const named = own ?? claimedByName.get(task.id) ?? null;

    if (named === null) {
      unassigned.push(task);
      continue;
    }
    // Present by construction: `named` came from `byId` or from a story's own id.
    home.get(named)?.push(task);
  }

  const scopes: Scope[] = stories.map((story) => ({
    id: story.id,
    story,
    tasks: home.get(story.id) ?? [],
  }));

  // Absent when empty (FR-013): a heading with nothing under it is not the same
  // as no heading, and the spec asks for no heading.
  if (unassigned.length > 0) {
    scopes.push({ id: UNASSIGNED, story: null, tasks: unassigned });
  }

  return { scopes, drawn: scopes.reduce((total, scope) => total + scope.tasks.length, 0) };
}

export function usePlacement(stories: readonly Story[], tasks: readonly Task[]): Placement {
  return useMemo(() => place(stories, tasks), [stories, tasks]);
}
