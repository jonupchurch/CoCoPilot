import { useCallback, useState } from 'react';

import type { Story, Task } from 'cocoapilot-contract';

import type { Scope } from './useSelection.js';

/**
 * What the developer has selected in the Spec-Kit tree, and which stories are
 * open — across a report that may have deleted any of it.
 *
 * **Intent is held; the resolution is derived on every render.** What is stored
 * is what someone clicked, never a copy of the thing they clicked, so there is
 * no effect watching for reports and nothing to go stale. That is the pattern
 * `useSelection` established and `useUnread` follows, and it is what makes
 * "keep the developer's place across a report" (FR-030 to FR-033) a consequence
 * of the shape rather than a lifecycle to get right.
 */

export interface TreeSelection {
  kind: 'story' | 'task';
  id: string;
}

export interface ResolvedSelection {
  /**
   * The scope selected, or the one holding the selected task.
   *
   * The whole scope rather than just its story, because the detail components
   * take a `Scope` — resolving it here saves the pane searching the tree a
   * second time for something this function already found. `scope.story` is null
   * for the unassigned group, where a selected task legitimately has no story.
   */
  scope: Scope | null;
  /** The selected task. Null whenever a story is what is selected. */
  task: Task | null;
  /**
   * True when something was selected and the current report no longer contains
   * it. The view says so rather than showing an empty pane (FR-034).
   */
  missing: boolean;
}

const NOTHING: ResolvedSelection = { scope: null, task: null, missing: false };

/**
 * **There is deliberately no fallback to the first item**, which is the one
 * place this diverges from `resolve` in `useSelection.ts`.
 *
 * That function falls back and argues for it: "Landing on the first item is
 * obviously a move, which is the point." True for a two-pane list, where
 * something must be shown. Not true here, for two reasons. FR-034 requires the
 * view to say the selection is gone rather than substitute another, and a tree
 * has a third option a list does not — nothing selected is perfectly legible
 * when the whole tree is still on screen to choose from. Falling back would also
 * expand whichever story now holds the first task, moving a reader who did not
 * ask to be moved (FR-033).
 */
export function resolveSelection(
  scopes: readonly Scope[],
  selection: TreeSelection | null,
): ResolvedSelection {
  if (selection === null) return NOTHING;

  if (selection.kind === 'story') {
    const scope = scopes.find((candidate) => candidate.id === selection.id);
    if (scope === undefined) return { ...NOTHING, missing: true };
    return { scope, task: null, missing: false };
  }

  for (const scope of scopes) {
    const task = scope.tasks.find((candidate) => candidate.id === selection.id);
    if (task !== undefined) return { scope, task, missing: false };
  }

  return { ...NOTHING, missing: true };
}

/** Open by default when the agent's current task is inside it, and only then. */
export function defaultOpen(scope: Scope, focusTask: string): boolean {
  if (focusTask === '') return false;
  return scope.tasks.some((task) => task.id === focusTask);
}

/**
 * **What is held is the deviation from the default, not the state itself**, and
 * the difference is load-bearing.
 *
 * The default depends on the report — which story holds the current task — so it
 * moves as the agent works. Holding a set of *open* ids cannot tell "the
 * developer closed this" from "this was never opened", so either the default
 * stops working after the first report or a developer's collapse is undone by
 * the next one. Both are FR-033 violations.
 *
 * Holding the deviation makes the default and the preservation one expression,
 * with no effect and nothing initialised from a report.
 */
export function isOpen(scope: Scope, focusTask: string, toggled: ReadonlySet<string>): boolean {
  return defaultOpen(scope, focusTask) !== toggled.has(scope.id);
}

export interface TreeState {
  selection: ResolvedSelection;
  isOpen: (scope: Scope) => boolean;
  selectStory: (id: string) => void;
  selectTask: (id: string) => void;
  toggle: (id: string) => void;
}

export function useTreeState(scopes: readonly Scope[], focusTask: string): TreeState {
  const [selection, setSelection] = useState<TreeSelection | null>(null);
  const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = useCallback((id: string): void => {
    setToggled((current) => {
      const next = new Set(current);
      // Symmetric: toggling twice returns to the default, whatever the default
      // has become in the meantime.
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  return {
    selection: resolveSelection(scopes, selection),
    isOpen: (scope: Scope): boolean => isOpen(scope, focusTask, toggled),
    selectStory: (id: string): void => {
      setSelection({ kind: 'story', id });
    },
    selectTask: (id: string): void => {
      setSelection({ kind: 'task', id });
    },
    toggle,
  };
}
