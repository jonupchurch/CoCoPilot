import { watch, type FSWatcher } from 'node:fs';
import { homedir } from 'node:os';

import { sessionKey, type Session, type Store } from '../store.js';
import { fromList, unreadable, type Availability } from './availability.js';
import { classify, type Prompt } from './classify.js';
import { locate } from './locate.js';
import { TranscriptReader } from './reader.js';

/**
 * The one thing the board reads from disk, wired to the one thing it holds.
 *
 * Everything here is contained. A transcript that cannot be found, opened,
 * parsed or understood produces `unreadable` for one session's transcript
 * branch, and nothing else in the product is affected — that containment is the
 * entire justification for depending on a format nobody documents.
 *
 * It watches rather than polls. The file belongs to another process, so there
 * is no in-process notification to subscribe to the way there is for reports;
 * `fs.watch` is the event-driven alternative, and a watcher that cannot be
 * established degrades to reading on store activity rather than to an error.
 */

export interface TranscriptSourceOptions {
  /**
   * Where `.claude/projects` lives. `COCOPILOT_HOME` overrides it, which is how
   * the end-to-end suite points the reader at fixtures instead of at the
   * developer's own sessions.
   */
  home?: string | undefined;
  /** Coalescing window for a file that is being appended to rapidly. */
  debounceMs?: number | undefined;
  now?: (() => number) | undefined;
}

const DEBOUNCE_MS = 120;

/** One session's reader, its watcher, and the prompts read so far. */
interface Tracked {
  path: string;
  reader: TranscriptReader;
  watcher: FSWatcher | null;
  timer: NodeJS.Timeout | null;
  prompts: Prompt[];
}

export class TranscriptSource {
  readonly #store: Store;
  readonly #home: string;
  readonly #debounceMs: number;
  readonly #now: () => number;
  readonly #tracked = new Map<string, Tracked>();

  #unsubscribe: (() => void) | null = null;

  constructor(store: Store, options: TranscriptSourceOptions = {}) {
    this.#store = store;
    this.#home = options.home ?? process.env['COCOPILOT_HOME'] ?? homedir();
    this.#debounceMs = options.debounceMs ?? DEBOUNCE_MS;
    this.#now = options.now ?? ((): number => Date.now());
  }

  /**
   * Begin following every session the board knows about, and every session it
   * learns about afterwards.
   *
   * A session's transcript is looked for when the session is first seen. Sessions
   * only appear because an agent reported, so there is no scanning of the
   * projects directory and no session is followed that the board is not already
   * holding (FR-016).
   */
  start(): void {
    if (this.#unsubscribe !== null) return;

    this.#unsubscribe = this.#store.subscribe((change) => {
      // A transcript announcement is our own; following it would loop.
      if (change.type === 'transcript') return;
      if (change.type === 'dismiss') {
        this.#drop(change.key);
        return;
      }
      this.#follow(change.key);
    });

    for (const session of this.#store.listSessions()) {
      this.#follow(sessionKey(session.repoPath, session.sessionId));
    }
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    for (const key of [...this.#tracked.keys()]) this.#drop(key);
  }

  /** Read now, rather than waiting for the watcher. Used by tests and on start. */
  refresh(key: string): void {
    const tracked = this.#tracked.get(key);
    if (tracked !== undefined) this.#pump(key, tracked);
  }

  #follow(key: string): void {
    if (this.#tracked.has(key)) return;

    const session = this.#find(key);
    if (session === undefined) return;

    const found = locate(session.repoPath, session.transcriptId, this.#home);
    if (!found.ok) {
      this.#publish(key, unreadable(found.reason));
      return;
    }

    const tracked: Tracked = {
      path: found.path,
      reader: new TranscriptReader(found.path),
      watcher: null,
      timer: null,
      prompts: [],
    };
    this.#tracked.set(key, tracked);

    try {
      // Watching the file rather than the directory: we are entitled to look at
      // exactly one file, and a directory watcher would see every other
      // session's activity too.
      tracked.watcher = watch(found.path, { persistent: false }, () => {
        this.#schedule(key, tracked);
      });
      tracked.watcher.on('error', () => {
        // A watcher that dies is not a failure of the read. Later store
        // activity still pumps it; only liveness is lost.
        tracked.watcher = null;
      });
    } catch {
      tracked.watcher = null;
    }

    this.#pump(key, tracked);
  }

  /** Coalesce a burst of writes into one read. */
  #schedule(key: string, tracked: Tracked): void {
    if (tracked.timer !== null) return;
    tracked.timer = setTimeout(() => {
      tracked.timer = null;
      this.#pump(key, tracked);
    }, this.#debounceMs);
    // The board must be able to quit with a read pending.
    tracked.timer.unref?.();
  }

  #pump(key: string, tracked: Tracked): void {
    const result = tracked.reader.read();

    if (!result.ok) {
      this.#publish(key, unreadable(result.reason));
      return;
    }

    // The file was replaced or truncated, so what came back is the whole file
    // again rather than an addition. Keeping the old list would double every
    // prompt in it.
    if (result.restarted) tracked.prompts = [];

    for (const line of result.lines) {
      let record: unknown;
      try {
        record = JSON.parse(line);
      } catch {
        // A line that will not parse is skipped and reading continues
        // (FR-012). Truncated tails and unfamiliar shapes are expected.
        continue;
      }
      const verdict = classify(record);
      if (verdict.kind === 'prompt') tracked.prompts.push(verdict.prompt);
    }

    this.#publish(key, fromList(tracked.prompts.slice()));
  }

  #publish(key: string, prompts: Availability<readonly Prompt[]>): void {
    this.#store.putTranscript(key, { prompts, readAt: this.#now() });
  }

  #drop(key: string): void {
    const tracked = this.#tracked.get(key);
    if (tracked === undefined) return;

    if (tracked.timer !== null) clearTimeout(tracked.timer);
    tracked.watcher?.close();
    this.#tracked.delete(key);
  }

  #find(key: string): Session | undefined {
    return this.#store
      .listSessions()
      .find((session) => sessionKey(session.repoPath, session.sessionId) === key);
  }
}

export { classify } from './classify.js';
export { locate, projectDirectory, slug } from './locate.js';
export { TranscriptReader } from './reader.js';
export { available, empty, fromList, unreadable } from './availability.js';
export type { Availability } from './availability.js';
export type { Prompt } from './classify.js';
