import { closeSync, openSync, readSync, statSync } from 'node:fs';

/**
 * Read a transcript, then read only what has been appended since.
 *
 * Re-reading from the start on every change would be quadratic over a session,
 * and SC-007 sets the bar at 100 MB — so the reader keeps a position and a
 * buffer, and a `read()` that finds nothing new costs one `stat`.
 *
 * **A partial trailing line is expected, not corruption.** The file is being
 * appended to by another process while we read it, so the last line is very
 * often half-written. It is buffered and completed on a later read (US4
 * scenario 4). Reporting it as damage would make normal operation look like
 * failure.
 *
 * Nothing here throws. Every failure is a value, because unavailability is the
 * designed outcome for all of them and an exception escaping this module is
 * exactly what FR-011 forbids.
 */

/**
 * One read's worth of appended data, already split into whole lines.
 *
 * `restarted` says the reader went back to the beginning — the file was
 * replaced, truncated, or disappeared and came back. The caller must discard
 * what it accumulated, because `lines` is then the whole file again rather than
 * an addition to it.
 */
export type ReadResult =
  | { ok: true; lines: string[]; restarted: boolean }
  | { ok: false; reason: 'unreadable' };

/**
 * Bytes pulled from disk in one `read()` call. Not a limit on file size — the
 * reader loops — just the working buffer.
 */
const CHUNK = 1 << 18;

/**
 * A line longer than this is abandoned rather than buffered indefinitely.
 *
 * Without a ceiling, a file that never emits a newline — a binary blob rotated
 * into place, a format that stops being line-delimited — would grow the buffer
 * until the process died. Well above the 19,903-character longest prompt in the
 * real sample, and far below anything that threatens the window.
 */
const MAX_LINE = 4 << 20;

export class TranscriptReader {
  readonly #path: string;

  /** How far into the file we have consumed. Never rewinds except on a reset. */
  #position = 0;

  /** The trailing fragment with no newline yet. */
  #partial = '';

  /** Set after abandoning an over-long line: drop bytes until the next newline. */
  #skipping = false;

  /**
   * A reset has happened and has not been reported yet.
   *
   * It outlives the read that caused it, because the read that *caused* it is
   * often the failing one — a file that disappears resets here and comes back
   * two reads later. Reporting `restarted` only on the read that reset would
   * tell the caller nothing on the read where it actually matters.
   */
  #restartPending = false;

  /** Last observed modification time, which is how an in-place rewrite is seen. */
  #mtime = -1;

  constructor(path: string) {
    this.#path = path;
  }

  get position(): number {
    return this.#position;
  }

  /**
   * Everything appended since the last call, as whole lines.
   *
   * Three ways a file stops being the file it was, all of which restart it:
   *
   * - It **shrank**. Transcripts only grow, so a smaller size means rotated,
   *   replaced or truncated, and continuing from the old offset would splice
   *   unrelated bytes together.
   * - It is the **same size but was written again**. An in-place rewrite is
   *   invisible to a size check — the mtime is the only thing that moved.
   * - It **went away**. The position is dropped on failure, so a file that
   *   returns is read whole rather than from an offset into content that no
   *   longer exists there.
   */
  read(): ReadResult {
    let size: number;
    let mtime: number;
    try {
      const stats = statSync(this.#path);
      // A directory has a size and can even be opened on some platforms. It is
      // not a transcript, and reading one is not a thing to attempt.
      if (!stats.isFile()) {
        this.#reset();
        return { ok: false, reason: 'unreadable' };
      }
      size = stats.size;
      mtime = stats.mtimeMs;
    } catch {
      this.#reset();
      return { ok: false, reason: 'unreadable' };
    }

    const rewritten = size === this.#position && this.#position > 0 && mtime !== this.#mtime;
    if (size < this.#position || rewritten) this.#reset();

    this.#mtime = mtime;
    if (size === this.#position) return { ok: true, lines: [], restarted: this.#takeRestart() };

    let handle: number;
    try {
      handle = openSync(this.#path, 'r');
    } catch {
      return { ok: false, reason: 'unreadable' };
    }

    const lines: string[] = [];
    const buffer = Buffer.allocUnsafe(CHUNK);

    try {
      for (;;) {
        const read = readSync(handle, buffer, 0, CHUNK, this.#position);
        if (read === 0) break;
        this.#position += read;

        // `latin1`, not `utf8`: a chunk boundary can fall inside a multi-byte
        // character, and decoding per chunk would corrupt it. Re-decoded whole
        // once each line is complete.
        this.#partial += buffer.toString('latin1', 0, read);
        this.#drain(lines);
      }
    } catch {
      return { ok: false, reason: 'unreadable' };
    } finally {
      try {
        closeSync(handle);
      } catch {
        // A handle we cannot close is not a reason to lose the lines we read.
      }
    }

    return { ok: true, lines, restarted: this.#takeRestart() };
  }

  /** Report a pending restart once, on the first read that succeeds after it. */
  #takeRestart(): boolean {
    const pending = this.#restartPending;
    this.#restartPending = false;
    return pending;
  }

  /** Pull whole lines out of the buffer, honouring the abandon-and-skip state. */
  #drain(lines: string[]): void {
    for (;;) {
      const newline = this.#partial.indexOf('\n');

      if (newline === -1) {
        // Nothing complete. Abandon the fragment if it has grown past reason,
        // and skip the rest of that line when it finally ends -- otherwise the
        // remainder would surface as a truncated line, or as a spurious empty
        // one the moment the newline arrived.
        if (this.#partial.length > MAX_LINE) {
          this.#partial = '';
          this.#skipping = true;
        }
        return;
      }

      const line = this.#partial.slice(0, newline);
      this.#partial = this.#partial.slice(newline + 1);

      if (this.#skipping) this.#skipping = false;
      else lines.push(decode(line));
    }
  }

  #reset(): void {
    // Nothing to discard on a reader that has not read anything yet, and
    // announcing a restart before the first read would be noise.
    if (this.#position > 0 || this.#partial !== '') this.#restartPending = true;
    this.#position = 0;
    this.#partial = '';
    this.#skipping = false;
  }
}

/**
 * Back to text, tolerating a trailing `\r` from a transcript written on a
 * platform that uses CRLF. Stripped here rather than in the classifier, so
 * every consumer sees the same line.
 */
function decode(line: string): string {
  const text = Buffer.from(line, 'latin1').toString('utf8');
  return text.endsWith('\r') ? text.slice(0, -1) : text;
}
