/**
 * What the agent is holding, folded out of the record stream.
 *
 * `classify.ts` answers "what is this record"; this answers "what do all of them
 * add up to right now", which needs memory: a file is in context because it was
 * opened earlier and has not been discarded since, and a tool call is *running*
 * because its result has not arrived yet.
 *
 * Everything here was verified against a real 14 MB session before it was
 * written, and two of the load-bearing facts are not in `research.md`:
 *
 * - **`input_tokens` is not the context size.** With prompt caching it is
 *   routinely `2`, while `cache_read_input_tokens` carries the other 290,000.
 *   The figure the design's "12.4k" refers to is the sum of the three input
 *   fields, and reading the obvious one alone would have drawn a full window as
 *   empty.
 * - **`system` / `compact_boundary` really appears**, three times in that
 *   session. It is where the agent's context was thrown away, so files opened
 *   before it are gone — listing them would be the board asserting something
 *   about the agent's memory that stopped being true.
 *
 * Nothing here throws. A record it cannot make sense of leaves the state alone.
 */

export interface ContextFile {
  /** Exactly as the transcript spelled it. Absolute, usually. */
  path: string;
  /** What last touched it — the tool's own name, or the attachment's kind. */
  action: string;
  /** True while the call that touched it has not returned. */
  active: boolean;
  /** Epoch milliseconds, or null when the record carried no usable timestamp. */
  at: number | null;
}

export interface ContextView {
  /** Least recently touched first; the view reverses, as it does for prompts. */
  files: readonly ContextFile[];
  /**
   * Everything the agent was holding, in tokens, at the last measurement.
   *
   * Null when no `usage` has been seen — **never zero**. A transcript that
   * carries no accounting and one that reports an empty window are different
   * claims, and only one of them is something the board actually knows.
   */
  tokens: number | null;
}

interface Touch {
  action: string;
  at: number | null;
  /** The tool call that touched it, so "still running" stays answerable. */
  callId: string | null;
}

/**
 * The three `usage` fields that make up what the model was sent.
 *
 * `output_tokens` is deliberately absent: it is what came back, not what is
 * being held.
 */
const INPUT_FIELDS = [
  'input_tokens',
  'cache_read_input_tokens',
  'cache_creation_input_tokens',
] as const;

export class ContextTracker {
  /** Insertion-ordered, and re-touching a file moves it to the end. */
  readonly #files = new Map<string, Touch>();

  /** Tool calls that have not returned. Usually empty; usually one when not. */
  readonly #running = new Set<string>();

  #tokens: number | null = null;

  observe(record: unknown): void {
    if (!isObject(record)) return;

    const type = record['type'];

    if (type === 'system' && record['subtype'] === 'compact_boundary') {
      this.#forget();
      return;
    }
    if (type === 'assistant') {
      this.#assistant(record);
      return;
    }
    if (type === 'user') {
      this.#results(record);
      return;
    }
    if (type === 'attachment') {
      this.#attachment(record);
    }
  }

  /** Everything read so far, in one shape. */
  view(): ContextView {
    const files: ContextFile[] = [];
    for (const [path, touch] of this.#files) {
      files.push({
        path,
        action: touch.action,
        active: touch.callId !== null && this.#running.has(touch.callId),
        at: touch.at,
      });
    }
    return { files, tokens: this.#tokens };
  }

  /** Start over, as a reader does when the file it was following is replaced. */
  reset(): void {
    this.#forget();
    this.#tokens = null;
  }

  /**
   * The agent's turn: what it holds, and what it reached for.
   *
   * A tool counts as naming a file when its input has a string `file_path` —
   * not because it appears on a list of tools that do. The list would be
   * `Read`, `Edit`, `Write` and `NotebookEdit` today, and would silently stop
   * being complete the first time a new one shipped.
   */
  #assistant(record: Record<string, unknown>): void {
    const message = record['message'];
    if (!isObject(message)) return;

    const tokens = countTokens(message['usage']);
    if (tokens !== null) this.#tokens = tokens;

    const at = timestamp(record['timestamp']);
    const content = message['content'];
    if (!Array.isArray(content)) return;

    for (const block of content) {
      if (!isObject(block) || block['type'] !== 'tool_use') continue;

      const id = typeof block['id'] === 'string' ? block['id'] : null;
      if (id !== null) this.#running.add(id);

      const input = block['input'];
      if (!isObject(input)) continue;
      const path = input['file_path'];
      if (typeof path !== 'string' || path === '') continue;

      const action = typeof block['name'] === 'string' ? block['name'] : 'touched';
      this.#touch(path, { action, at, callId: id });
    }
  }

  /** The tool results coming back, which is the only thing that ends a call. */
  #results(record: Record<string, unknown>): void {
    const message = record['message'];
    if (!isObject(message)) return;

    const content = message['content'];
    if (!Array.isArray(content)) return;

    for (const block of content) {
      if (!isObject(block) || block['type'] !== 'tool_result') continue;
      const id = block['tool_use_id'];
      if (typeof id === 'string') this.#running.delete(id);
    }
  }

  /**
   * Files that reached the agent without a tool call — an `@`-mention, an
   * external edit it was shown, a reference carried across a compaction.
   *
   * Matched on the presence of `attachment.filename` rather than on the
   * attachment's kind, for the same reason as `file_path` above: of the eleven
   * kinds in the sample, three carry a filename, and a new one that carried it
   * too would otherwise be dropped.
   */
  #attachment(record: Record<string, unknown>): void {
    const attachment = record['attachment'];
    if (!isObject(attachment)) return;

    const path = attachment['filename'];
    if (typeof path !== 'string' || path === '') return;

    const action = typeof attachment['type'] === 'string' ? attachment['type'] : 'attached';
    this.#touch(path, { action, at: timestamp(record['timestamp']), callId: null });
  }

  /** Newest last. Deleting first is what moves a repeat touch to the end. */
  #touch(path: string, touch: Touch): void {
    this.#files.delete(path);
    this.#files.set(path, touch);
  }

  #forget(): void {
    this.#files.clear();
    this.#running.clear();
  }
}

/**
 * What the model was holding, or null if the record does not say.
 *
 * Every field is optional and each missing one contributes nothing; a `usage`
 * object with none of them at all is null rather than zero, because "the
 * transcript did not tell us" is not a measurement of an empty context.
 */
function countTokens(usage: unknown): number | null {
  if (!isObject(usage)) return null;

  let total = 0;
  let seen = false;
  for (const field of INPUT_FIELDS) {
    const value = usage[field];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      total += value;
      seen = true;
    }
  }
  return seen ? total : null;
}

/** ISO string to epoch milliseconds. Anything unusable is null, never zero. */
function timestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
