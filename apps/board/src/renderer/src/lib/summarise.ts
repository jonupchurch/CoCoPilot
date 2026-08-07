import type { ChangedFile, Focus, PlanStep, ReportedFeature, Task } from '@cocopilot/contract';

import { elapsed } from './elapsed.js';
import { isActive, isDone } from './vocabulary.js';

/**
 * The header summaries. Every one of them derived, at render, from held state.
 *
 * Never stored and never sent: an agent-supplied "3 of 9 done" could disagree
 * with the task list printed directly beneath it, and the board would be
 * repeating a number it had the means to check. Deriving a summary *of what was
 * sent* is not the same as inventing content — FR-013 requires the first and
 * FR-016 forbids the second.
 *
 * Pure, so `now` arrives as an argument rather than being read here.
 */

/** U+2212, not a hyphen. It sits with `+` at the same optical weight. */
export const MINUS = '−';

export function focusSummary(focus: Focus | null, reportedAt: number | null, now: number): string {
  if (focus === null || focus.task === null || focus.task.trim() === '') return 'none reported';
  if (reportedAt === null) return focus.task;
  return `${focus.task} · ${elapsed(reportedAt, now)}`;
}

/**
 * `US-002 · 2 of 4 done`, and the parts that are missing simply do not appear.
 * The count is of statuses the board recognises as done, never of anything else.
 */
export function specSummary(feature: ReportedFeature | null, tasks: readonly Task[]): string {
  const parts: string[] = [];
  if (feature !== null && feature.id.trim() !== '') parts.push(feature.id);
  if (tasks.length > 0) {
    parts.push(`${tasks.filter((task) => isDone(task.status)).length} of ${tasks.length} done`);
  }
  return parts.join(' · ');
}

export interface PlanSummary {
  text: string;
  /** True when a step is active, which is what earns the blue pill treatment. */
  active: boolean;
}

/**
 * `Step 2 of 4` while something is in progress, `1 of 4 done` when nothing is.
 *
 * Two forms rather than one because "Step 2 of 4" with no active step would be
 * a claim about where the agent is that no reported step supports.
 */
export function planSummary(plan: readonly PlanStep[]): PlanSummary {
  const at = plan.findIndex((step) => isActive(step.status));
  if (at !== -1) return { text: `Step ${at + 1} of ${plan.length}`, active: true };

  const done = plan.filter((step) => isDone(step.status)).length;
  return { text: `${done} of ${plan.length} done`, active: false };
}

export interface ChangedFilesSummary {
  files: number;
  /** Null when no file reported a count — distinct from every file reporting 0. */
  added: number | null;
  removed: number | null;
}

export function changedFilesSummary(files: readonly ChangedFile[]): ChangedFilesSummary {
  return {
    files: files.length,
    added: total(files, 'added'),
    removed: total(files, 'removed'),
  };
}

/** `+86 −31`, or the file count when the agent sent no line counts at all. */
export function formatChangedFiles(summary: ChangedFilesSummary): string {
  const parts: string[] = [];
  if (summary.added !== null) parts.push(`+${summary.added}`);
  if (summary.removed !== null) parts.push(`${MINUS}${summary.removed}`);
  if (parts.length > 0) return parts.join(' ');

  return `${summary.files} ${summary.files === 1 ? 'file' : 'files'}`;
}

function total(files: readonly ChangedFile[], field: 'added' | 'removed'): number | null {
  let sum: number | null = null;
  for (const file of files) {
    const value = file[field];
    if (value !== null) sum = (sum ?? 0) + value;
  }
  return sum;
}
