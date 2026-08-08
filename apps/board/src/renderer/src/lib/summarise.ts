import type { ChangedFile, Focus, PlanStep, ReportedFeature, Task } from 'cocoapilot-contract';

import { focusAge } from './elapsed.js';
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
  return `${focus.task} · ${focusAge(reportedAt, now)}`;
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

/**
 * `2/4`, the export's per-story summary, in three places now — the story list,
 * the scope picker and the picker's options.
 *
 * Here rather than beside any one of them for the reason every other summary is
 * here: it counts what was reported, and three components counting it three
 * times is three chances to count it differently.
 */
export function taskSummary(tasks: readonly Task[]): string {
  if (tasks.length === 0) return 'no tasks';

  return `${tasks.filter((task) => isDone(task.status)).length}/${tasks.length}`;
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

/**
 * A token count, the way the export writes it: `12.4k`, `297k`, `840`.
 *
 * One decimal below a hundred thousand and none above. The boundary is the
 * export's rather than a guess — it writes `12.4k`, which settles that five
 * figures still carry the decimal; my first attempt dropped it at ten thousand
 * and the test caught the disagreement. Past six figures the digit stops
 * earning its place in a narrow header: nobody reads the difference between
 * 296.8k and 297k, and the point of the figure is the order of magnitude.
 *
 * A count is never rounded up to a value it has not reached: `999` stays `999`
 * rather than becoming `1.0k`, so a figure below a round number always reads as
 * below it.
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1_000) return String(Math.floor(tokens));

  const thousands = tokens / 1_000;
  if (thousands < 100) return `${(Math.floor(tokens / 100) / 10).toFixed(1)}k`;
  return `${Math.floor(thousands)}k`;
}
