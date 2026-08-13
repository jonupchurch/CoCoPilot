import { basename } from 'node:path';

import type {
  ChangedFile,
  Chip,
  Focus,
  PlanStep,
  ReportedFeature,
  Story,
  Task,
  Ticket,
} from 'cocoapilot-contract';

import { sessionKey, type Note, type Session, type Store } from './store.js';
import type { Availability } from './transcript/availability.js';
import type { Prompt } from './transcript/classify.js';
import type { ContextView } from './transcript/context.js';

/**
 * What crosses the bridge.
 *
 * A deliberate projection rather than the `Session` objects themselves: the
 * renderer gets a flat, serialisable, read-only shape, and adding a field to the
 * store does not silently widen what a window rendering agent-composed text can
 * see. It is also the one place that decides *which* session is shown — a
 * selection since feature 008, and a fallback when that selection is gone.
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
   * Whether this session has *ever* reported a story, which is not the same
   * question as `storyCount > 0`.
   *
   * `storyCount` describes the snapshot on screen; this describes the session.
   * Feature 011 offers its tree on the second, so that a report carrying no
   * stories cannot withdraw a destination from a developer reading it. Held in
   * the store because a replaced snapshot cannot answer it — see `putReport`.
   */
  everReportedStories: boolean;

  /**
   * When the last *report* arrived, or null until one has.
   *
   * Deliberately not `lastHeardAt`, which a note also moves: the Overview tab's
   * focus tag says how long ago the agent reported what it is working on, and a
   * note arriving must not reset that to zero.
   */
  reportedAt: number | null;

  /**
   * The tracker ticket, or null for a session that has no ticket *concept*.
   *
   * Null is what the ticket destination is absent on, so this field carries
   * FR-001 and FR-002 between them. There is deliberately **no `hasTicket`**:
   * the renderer asks `ticket !== null`, and a second field meaning the same
   * thing is a second thing to keep in step.
   */
  ticket: Ticket | null;
  /** Board-stamped, for FR-011's elapsed time. Null with no ticket. */
  ticketReportedAt: number | null;

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

/**
 * One held session, as much of it as a switcher pill draws — and no more.
 *
 * **Deliberately without the reported body.** The tempting shape is a list of
 * full `SessionView`s so the window can pick one itself, the way feature 006's
 * selection resolves locally. It does not survive the cap: `MAX_SESSIONS` is
 * 100 and each session may hold 200 stories, 500 tasks and 1,000 notes, so
 * serialising all of it on every change — to display one of them — is untenable
 * at the cap even though it would be comfortable at three. So the window is
 * given every session's *identity* and one session's *content*.
 */
export interface SessionSummary {
  /** Opaque to the renderer, and what `select` and `dismiss` name. */
  key: string;
  repo: string;
  repoName: string;
  branch: string;
  /** Reported, never derived — the same value the title bar shows. */
  chip: Chip;
  lastHeardAt: number;
  /** False for a push with no process behind it: a script, not an agent. */
  attributed: boolean;
}

export interface BoardState {
  /** Every held session, in declaration order. Never sorted by anything else. */
  sessions: SessionSummary[];
  /** The selected one in full, or null when nothing is held. */
  session: SessionView | null;
  /**
   * The key of the session actually being shown — the **resolved** selection,
   * not the requested one.
   *
   * They differ exactly when the requested session has gone, and sending the
   * resolved value is what stops the switcher marking a pill that is no longer
   * there. There is one answer to "which session is this", and it is this one.
   */
  selectedKey: string | null;
  sessionCount: number;
}

export const EMPTY_BOARD: BoardState = {
  sessions: [],
  session: null,
  selectedKey: null,
  sessionCount: 0,
};

/**
 * The projection, resolved against a selection.
 *
 * **FR-016 lives here rather than in a view.** A selected session can cease to
 * exist between one render and the next — it is dismissed, or the window is
 * reopened — and every view would otherwise need its own answer for that. The
 * fallback is the first in declaration order, which is a visible move rather
 * than a quiet substitution.
 *
 * `selected` is window state held by the main process: no more durable than the
 * window's size, and gone on restart (FR-020). It is not stored, and nothing
 * about it reaches disk.
 */
export function toBoardState(store: Store, selected?: string | null): BoardState {
  const sessions = store.listSessions();
  // Declaration order, never recency: a pill is glanced at rather than read, so
  // its position is something a developer learns. Sorting by recency would move
  // the pill they are reaching for, because the one that moved is the one they
  // want.
  const chosen = sessions.find((held) => sessionKey(held.repoPath, held.sessionId) === selected);
  const session = chosen ?? sessions[0];

  return {
    sessions: sessions.map(toSessionSummary),
    sessionCount: sessions.length,
    session: session === undefined ? null : toSessionView(session),
    selectedKey: session === undefined ? null : sessionKey(session.repoPath, session.sessionId),
  };
}

function toSessionSummary(session: Session): SessionSummary {
  return {
    key: sessionKey(session.repoPath, session.sessionId),
    repo: session.repoPath,
    repoName: basename(session.repoPath) || session.repoPath,
    branch: session.branch,
    chip: session.report?.focus?.chip ?? 'thinking',
    lastHeardAt: session.lastHeardAt,
    attributed: session.attributed,
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
    // Not from `report`, for the same reason `notes` below is not: it outlives
    // the snapshot that set it.
    everReportedStories: session.everReportedStories,

    reportedAt: report?.receivedAt ?? null,
    // Not from `report` either, and for the strongest version of that reason:
    // there is no path from a report to a ticket at all. See `Session.ticket`.
    ticket: session.ticket,
    ticketReportedAt: session.ticketReportedAt,
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
