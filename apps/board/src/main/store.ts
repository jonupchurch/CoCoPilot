import { EventEmitter } from 'node:events';

import {
  MAX_NOTES_PER_SESSION,
  MAX_SESSIONS,
  rejection,
  type ChangedFile,
  type Envelope,
  type Focus,
  type NoteRequest,
  type PlanStep,
  type PushRequest,
  type Rejection,
  type ReportedFeature,
  type Story,
  type Task,
} from '@cocopilot/contract';

/**
 * Everything CoCoPilot holds.
 *
 * All of it lives here, in memory, and dies with the process (decision 21).
 * There is no database, no migration, no storage format to version and no
 * corrupt-state recovery path, because there is nothing on disk to corrupt.
 */

/** The session identity given to pushes that have no process behind them. */
export const UNATTRIBUTED = 'unattributed';

export interface Note {
  text: string;
  source: string | null;
  receivedAt: number;
}

/** A complete snapshot of a session at a moment. Replaces its predecessor. */
export interface Report {
  feature: ReportedFeature | null;
  stories: Story[];
  tasks: Task[];
  plan: PlanStep[];
  focus: Focus | null;
  changedFiles: ChangedFile[];
  receivedAt: number;
}

export interface Session {
  repoPath: string;
  sessionId: string;
  /** False for a script or hook, so the UI can label it honestly (decision 23). */
  attributed: boolean;
  branch: string;
  /**
   * The AI tool's own session id, naming its transcript file. Null when the
   * client could not determine one, which feature 005 treats as a supported
   * case rather than an error.
   */
  transcriptId: string | null;
  /** First contact. Set once — the switcher must not reorder as reports arrive. */
  declaredAt: number;
  /** Most recent contact of any kind. Reports *and* notes move it. */
  lastHeardAt: number;
  /** Null when only notes have arrived. Distinct from an empty report. */
  report: Report | null;
  notes: Note[];
}

export type StoreChange =
  | { type: 'report'; key: string }
  | { type: 'note'; key: string }
  | { type: 'dismiss'; key: string };

export type StoreResult<T> = { ok: true; value: T } | { ok: false; rejection: Rejection };

/**
 * `repoPath` and `sessionId` joined by NUL, which cannot occur in either, so a
 * crafted `sessionId` cannot forge a key belonging to another repository.
 */
export function sessionKey(repoPath: string, sessionId: string): string {
  return `${repoPath}\0${sessionId}`;
}

export class Store {
  /** Decision 28: the window is notified in-process. No polling, no timer. */
  readonly changes = new EventEmitter();

  readonly #sessions = new Map<string, Session>();

  get size(): number {
    return this.#sessions.size;
  }

  /**
   * Accept a full snapshot, replacing whatever this session held.
   *
   * There is no merge path in this method, and deliberately none anywhere else
   * in this file (decision 26). A dropped, duplicated or out-of-order push costs
   * nothing when the next one is authoritative; the moment held state becomes an
   * accumulation, correctness depends on every message arriving exactly once and
   * nothing in the system can correct a board that has drifted.
   */
  putReport(request: PushRequest, receivedAt: number): StoreResult<Session> {
    const opened = this.#openSession(request, receivedAt);
    if (!opened.ok) return opened;

    const session = opened.value;
    session.branch = request.branch;
    session.transcriptId = request.transcriptId;
    session.lastHeardAt = receivedAt;

    // Assigned whole. Never spread over `session.report`.
    session.report = {
      feature: request.feature,
      stories: request.stories,
      tasks: request.tasks,
      plan: request.plan,
      focus: request.focus,
      changedFiles: request.changedFiles,
      receivedAt,
    };

    this.#announce({ type: 'report', key: sessionKey(session.repoPath, session.sessionId) });
    return { ok: true, value: session };
  }

  /**
   * Append a note. The one accumulating structure in the system (decision 20),
   * and the sole exception to snapshot-replace — folding notes into the snapshot
   * would force an agent to resend every note it had ever written to add one.
   */
  appendNote(request: NoteRequest, receivedAt: number): StoreResult<Session> {
    const opened = this.#openSession(request, receivedAt);
    if (!opened.ok) return opened;

    const session = opened.value;
    if (session.notes.length >= MAX_NOTES_PER_SESSION) {
      return {
        ok: false,
        rejection: rejection(
          'note_limit',
          'text',
          `${MAX_NOTES_PER_SESSION} notes held for this session`,
        ),
      };
    }

    session.branch = request.branch;
    session.transcriptId = request.transcriptId;
    session.lastHeardAt = receivedAt;

    // Text is stored exactly as it arrived. Escaping belongs at the point of
    // display, not here (FR-014): storing escaped text would corrupt the
    // copy-a-prompt-to-the-clipboard fidelity feature 005 needs.
    session.notes.push({ text: request.text, source: request.source, receivedAt });

    this.#announce({ type: 'note', key: sessionKey(session.repoPath, session.sessionId) });
    return { ok: true, value: session };
  }

  getSession(repoPath: string, sessionId: string): Session | undefined {
    return this.#sessions.get(sessionKey(repoPath, sessionId));
  }

  /** In declaration order, which is the order the switcher renders (decision 14). */
  listSessions(): Session[] {
    return [...this.#sessions.values()];
  }

  /**
   * Clear the board's copy of one session.
   *
   * Not muting: a dismissed session reappears the moment it pushes again, since
   * the agent decides what is on the board and a dismiss that suppressed future
   * pushes would take that back (decision 17).
   */
  dismiss(repoPath: string, sessionId: string): boolean {
    const key = sessionKey(repoPath, sessionId);
    const removed = this.#sessions.delete(key);
    if (removed) this.#announce({ type: 'dismiss', key });
    return removed;
  }

  subscribe(listener: (change: StoreChange) => void): () => void {
    this.changes.on('change', listener);
    return () => {
      this.changes.off('change', listener);
    };
  }

  /**
   * Find the session, or create it — first contact may be a report or a note
   * (FR-006).
   *
   * At the cap a *new* session is refused rather than an old one evicted.
   * Eviction would silently discard a session someone might be watching, and
   * would be the only place in the product where something disappears without
   * either a restart or a deliberate dismissal.
   */
  #openSession(envelope: Envelope, receivedAt: number): StoreResult<Session> {
    const repoPath = envelope.repo;
    const suppliedSessionId = envelope.sessionId;
    const sessionId = suppliedSessionId ?? UNATTRIBUTED;
    const key = sessionKey(repoPath, sessionId);

    const existing = this.#sessions.get(key);
    if (existing !== undefined) return { ok: true, value: existing };

    if (this.#sessions.size >= MAX_SESSIONS) {
      return {
        ok: false,
        rejection: rejection(
          'session_limit',
          'repo',
          `${MAX_SESSIONS} sessions held; dismiss one to make room`,
        ),
      };
    }

    const created: Session = {
      repoPath,
      sessionId,
      // The reserved id cannot be claimed as an agent's, however it arrived. A
      // client that spells it out is a hook, and showing a hook as an agent
      // narrating would misrepresent where the information came from.
      attributed: suppliedSessionId !== null && suppliedSessionId !== UNATTRIBUTED,
      branch: envelope.branch,
      transcriptId: envelope.transcriptId,
      declaredAt: receivedAt,
      lastHeardAt: receivedAt,
      report: null,
      notes: [],
    };
    this.#sessions.set(key, created);
    return { ok: true, value: created };
  }

  #announce(change: StoreChange): void {
    this.changes.emit('change', change);
  }
}
