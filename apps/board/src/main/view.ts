import { basename } from 'node:path';

import type {
  ChangedFile,
  Chip,
  Focus,
  PlanStep,
  ReportedFeature,
  Story,
  Task,
} from '@cocopilot/contract';

import type { Note, Session, Store } from './store.js';
import type { Availability } from './transcript/availability.js';
import type { Prompt } from './transcript/classify.js';
import type { ContextView } from './transcript/context.js';

/**
 * What crosses the bridge.
 *
 * A deliberate projection rather than the `Session` objects themselves: the
 * renderer gets a flat, serialisable, read-only shape, and adding a field to the
 * store does not silently widen what a window rendering agent-composed text can
 * see. It is also the one place that decides *which* session is shown, which
 * feature 008 will replace with a selection rather than a default.
 */

export interface SessionView {
  /** The full path, for a tooltip. Long, and the title bar slot is narrow. */
  repo: string;
  /** What actually goes in the title bar. */
  repoName: string;
  branch: string;
  /** A timestamp. "40s ago" is a formatting of it, computed at render. */
  lastHeardAt: number;
  /** Exactly what the agent reported. Never derived, never changed by us. */
  chip: Chip;
  attributed: boolean;
  hasReport: boolean;
  storyCount: number;
  taskCount: number;
  noteCount: number;

  /**
   * When the last *report* arrived, or null until one has.
   *
   * Deliberately not `lastHeardAt`, which a note also moves: the Overview tab's
   * focus tag says how long ago the agent reported what it is working on, and a
   * note arriving must not reset that to zero.
   */
  reportedAt: number | null;

  /**
   * The reported body, listed field by field rather than carried as a whole.
   *
   * Naming each one is the point: a field added to the store does not reach a
   * window rendering agent-composed text until someone writes it down here.
   * `stories` was absent for exactly that reason until feature 006 built the
   * tab that reads them; it is listed now, and listed rather than spread, so
   * the next field still has to be argued for.
   */
  feature: ReportedFeature | null;
  stories: Story[];
  tasks: Task[];
  plan: PlanStep[];
  focus: Focus | null;
  changedFiles: ChangedFile[];

  /**
   * The one field here whose contents **accumulate**.
   *
   * Everything above it is replaced wholesale by the next report (decision 26),
   * so a value's identity across two pushes means nothing and no view may rely
   * on it. Notes append, and only append — which makes this the only place on
   * the board where arrival order is a durable fact rather than an artefact of
   * whichever snapshot happened to be current.
   *
   * Projected in arrival order, exactly as held. The notes view reverses it to
   * draw newest first; that is a display decision and it is made in the view.
   */
  notes: Note[];

  /**
   * Read from the AI tool's transcript, and kept in its own branch here for the
   * same reason it has its own branch in the store: FR-015 forbids it from
   * altering, correcting or contradicting anything an agent reported. A
   * renderer that had to unpick which of two sources a value came from would be
   * one refactor away from letting a transcript move a task's status.
   */
  transcript: TranscriptView;
}

export interface TranscriptView {
  /**
   * Oldest first, as the file has them. The view reverses for display; the
   * projection does not re-order what it read.
   */
  prompts: Availability<readonly Prompt[]>;
  /** Least recently touched first, on the same principle. */
  context: Availability<ContextView>;
}

/** Nothing has been read yet, which is not the same as having read nothing. */
const NOT_YET_READ: TranscriptView = {
  prompts: { state: 'unreadable', reason: 'not-read' },
  context: { state: 'unreadable', reason: 'not-read' },
};

export interface BoardState {
  session: SessionView | null;
  sessionCount: number;
}

export const EMPTY_BOARD: BoardState = { session: null, sessionCount: 0 };

export function toBoardState(store: Store): BoardState {
  const sessions = store.listSessions();
  // First declared wins until feature 008 adds a selection. Declaration order,
  // not recency, so the shown session does not change under the reader.
  const session = sessions[0];

  return {
    sessionCount: sessions.length,
    session: session === undefined ? null : toSessionView(session),
  };
}

function toSessionView(session: Session): SessionView {
  const report = session.report;

  return {
    repo: session.repoPath,
    repoName: basename(session.repoPath) || session.repoPath,
    branch: session.branch,
    lastHeardAt: session.lastHeardAt,
    // Defaults to `thinking` only because a session created by a note alone has
    // no report to have carried one. Still reported, never inferred.
    chip: report?.focus?.chip ?? 'thinking',
    attributed: session.attributed,
    hasReport: report !== null,
    storyCount: report?.stories.length ?? 0,
    taskCount: report?.tasks.length ?? 0,
    noteCount: session.notes.length,

    reportedAt: report?.receivedAt ?? null,
    feature: report?.feature ?? null,
    // Empty rather than null where the payload's own default is empty, so the
    // renderer has one absence to handle per field instead of two.
    stories: report?.stories ?? [],
    tasks: report?.tasks ?? [],
    plan: report?.plan ?? [],
    focus: report?.focus ?? null,
    changedFiles: report?.changedFiles ?? [],

    // Not from `report`: notes arrive on their own endpoint and survive a
    // report replacing everything above them, which is the whole of decision 20.
    notes: session.notes,

    transcript:
      session.transcript === null
        ? NOT_YET_READ
        : { prompts: session.transcript.prompts, context: session.transcript.context },
  };
}
