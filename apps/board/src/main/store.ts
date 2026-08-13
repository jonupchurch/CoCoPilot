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
  type Ticket,
  type TicketRequest,
} from 'cocoapilot-contract';

import type { Availability } from './transcript/availability.js';
import type { Prompt } from './transcript/classify.js';
import type { ContextView } from './transcript/context.js';

/**
 * Everything CoCoapilot holds.
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
  /**
   * Whether any report for this session has ever carried a story.
   *
   * Held rather than derived because reports replace wholesale: `report.stories`
   * being empty says only that the *current* snapshot has none, and a session
   * that reported stories once is a Spec-Kit session for the rest of its life
   * (feature 011, FR-003). A view cannot answer this from the report in front of
   * it, so the store answers it instead.
   *
   * One-way. Nothing sets this back to false; see `putReport` for why that is
   * load-bearing rather than incidental.
   */
  everReportedStories: boolean;
  notes: Note[];
  /**
   * The tracker ticket this work came from, in its own branch of the session.
   *
   * **Not on `Report`, and that is the whole of FR-003.** A report is a snapshot
   * that replaces wholesale, so a ticket carried on one would have to survive
   * the replace — a merge inside `putReport`, which that method's own comment
   * forbids. Here, a report carrying no ticket cannot withdraw the ticket
   * because nothing in the report path can reach this field. The requirement is
   * a property of the wiring rather than a rule anyone has to remember.
   *
   * Null means this session has no ticket *concept* — a Spec-Kit session, or one
   * whose agent has never been told to report one. That is what the ticket
   * destination is offered on, and it is distinct from a ticket with empty
   * fields, which is decision 33's empty-versus-unavailable distinction.
   */
  ticket: Ticket | null;
  /**
   * When the ticket was reported, board-stamped, for FR-011's elapsed time.
   *
   * Separate from `lastHeardAt` for the reason `Report.receivedAt` is: the
   * developer is asking how long ago the *ticket* was fetched from the tracker,
   * and an ordinary report arriving must not reset that to zero. A ticket is the
   * one thing on this board copied from a system the board cannot see, so how
   * stale it is, is the question worth answering — and the board answers only
   * that, never whether it is still current.
   */
  ticketReportedAt: number | null;
  /**
   * Read from disk, never reported. Null until the reader has looked at all,
   * which is distinct from having looked and found nothing.
   */
  transcript: TranscriptState | null;
}

/**
 * What the transcript reader contributes, held in its own branch of the session.
 *
 * Deliberately not folded into `Report`, and there is no code path anywhere that
 * merges the two (FR-015). A task's status, a chip, a count — none of them may
 * ever be influenced by a transcript, however tempting the extra signal. The
 * whole justification for depending on an undocumented, externally-owned format
 * is that when it changes, three display sections degrade and nothing else in
 * the product notices; a merge would spend that guarantee immediately.
 */
export interface TranscriptState {
  prompts: Availability<readonly Prompt[]>;
  /** Files the agent is holding, and how much of its window they take. */
  context: Availability<ContextView>;
  /** When the reader last managed to look. Null before the first attempt. */
  readAt: number | null;
}

export type StoreChange =
  | { type: 'report'; key: string }
  | { type: 'note'; key: string }
  | { type: 'ticket'; key: string }
  | { type: 'transcript'; key: string }
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
   *
   * **`everReportedStories` is the one exception, and it is an exception.** If
   * you are here to add a second, this paragraph is the argument you have to
   * beat.
   *
   * What it costs, stated plainly: if the only push that ever carried stories is
   * dropped, the flag stays false and nothing later corrects it, because later
   * pushes carry no stories either. That is precisely the drift the paragraph
   * above forbids, and it is real.
   *
   * Accepted on three grounds. **It is not reported content.** Decision 26
   * protects what the board tells the developer about the work; this is one
   * derived boolean about whether a field was ever non-empty, and the views it
   * gates still draw only what the current report says. **It is monotonic**, so
   * there is exactly one wrong state rather than progressive drift, and any
   * later push carrying stories heals it — which for a Spec-Kit agent is every
   * push, since every push is a full snapshot. **And the failure is benign**:
   * the developer keeps the story and task views they already had, nothing on
   * screen is wrong, and a destination is merely not offered.
   *
   * A second accumulation would have none of those properties by default. Say
   * why yours does before adding it.
   */
  putReport(request: PushRequest, receivedAt: number): StoreResult<Session> {
    const opened = this.#openSession(request, receivedAt);
    if (!opened.ok) return opened;

    const session = opened.value;
    session.branch = request.branch;
    session.transcriptId = request.transcriptId;
    session.lastHeardAt = receivedAt;

    // Never `=`, and never an else branch. See the note above.
    session.everReportedStories ||= request.stories.length > 0;

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

  /**
   * Accept a ticket, replacing whatever this session held.
   *
   * The third verb, and each of the three has different semantics on purpose: a
   * report **replaces** the snapshot, a note **appends**, and a ticket
   * **replaces the ticket and only the ticket**. A reader should be able to say
   * why each is different, and the difference is what each one costs to resend.
   *
   * Modelled on `putTranscript` — one method, one branch of `Session`, no merge
   * — with the one difference that this *does* move `lastHeardAt`. Reporting a
   * ticket is the agent saying something, whereas the transcript reader is
   * another program touching a file it owns.
   *
   * **`putReport` is not touched by this feature.** If a future change finds
   * itself adding a retain-across-replace guard there, the separate endpoint has
   * been abandoned and the design needs revisiting rather than patching.
   */
  putTicket(request: TicketRequest, receivedAt: number): StoreResult<Session> {
    const opened = this.#openSession(request, receivedAt);
    if (!opened.ok) return opened;

    const session = opened.value;
    session.branch = request.branch;
    session.transcriptId = request.transcriptId;
    session.lastHeardAt = receivedAt;

    // Assigned whole, like a report. A field-level update would let two partial
    // reports compose into a ticket that never existed in the tracker.
    session.ticket = request.ticket;
    session.ticketReportedAt = receivedAt;

    this.#announce({ type: 'ticket', key: sessionKey(session.repoPath, session.sessionId) });
    return { ok: true, value: session };
  }

  /**
   * Record what the transcript reader found for one session.
   *
   * Assigned to its own field and nothing else. This method exists rather than
   * letting the reader touch `Session` directly so that the one place
   * transcript data enters held state is a single, greppable line.
   */
  putTranscript(key: string, state: TranscriptState): boolean {
    const session = this.#sessions.get(key);
    if (session === undefined) return false;

    session.transcript = state;
    // Deliberately does *not* move `lastHeardAt`. That is how long since the
    // agent said something; another program writing to a file it owns is not
    // the agent saying anything.
    this.#announce({ type: 'transcript', key });
    return true;
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
    return this.dismissByKey(sessionKey(repoPath, sessionId));
  }

  /**
   * The same thing, named by the key the window was given.
   *
   * The window holds session keys rather than the pair, so this exists to keep
   * the key's format — a NUL join, which is a security property (see
   * `sessionKey`) — from being parsed apart anywhere outside this file. An
   * unknown key removes nothing and announces nothing, which is what makes
   * dismissing an already-dismissed session a no-op rather than an error.
   */
  dismissByKey(key: string): boolean {
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
      everReportedStories: false,
      notes: [],
      ticket: null,
      ticketReportedAt: null,
      transcript: null,
    };
    this.#sessions.set(key, created);
    return { ok: true, value: created };
  }

  #announce(change: StoreChange): void {
    this.changes.emit('change', change);
  }
}
