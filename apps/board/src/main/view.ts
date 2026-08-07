import { basename } from 'node:path';

import type { Chip } from '@cocopilot/contract';

import type { Session, Store } from './store.js';

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
}

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
  return {
    repo: session.repoPath,
    repoName: basename(session.repoPath) || session.repoPath,
    branch: session.branch,
    lastHeardAt: session.lastHeardAt,
    // Defaults to `thinking` only because a session created by a note alone has
    // no report to have carried one. Still reported, never inferred.
    chip: session.report?.focus?.chip ?? 'thinking',
    attributed: session.attributed,
    hasReport: session.report !== null,
    storyCount: session.report?.stories.length ?? 0,
    taskCount: session.report?.tasks.length ?? 0,
    noteCount: session.notes.length,
  };
}
