/**
 * One transcript record in, one verdict out.
 *
 * This module holds the finding most likely to be got wrong, which is why it is
 * its own file with its own tests: **`type: "user"` is not "a prompt"**, and
 * neither is "a `user` record whose content is text".
 *
 * Measured on a real 3,757-record transcript:
 *
 * | | |
 * |---|---|
 * | `user` records | 1,134 |
 * | …with text-only content | 74 |
 * | …that are actually prompts | **57** |
 *
 * Counting record types would show a developer 1,134 entries, almost all of it
 * tool output, presented as things they typed. Stopping at "content is text"
 * still leaves 17 wrappers in the list. Both readings are wrong, and both are
 * wrong quietly.
 *
 * Nothing here throws. A record it cannot make sense of is `ignore`, because a
 * reader that rejects the unfamiliar breaks whenever someone else ships a
 * release — and one already did: a ninth record type appeared between two
 * samples taken a day apart.
 */

export interface Prompt {
  text: string;
  /** Epoch milliseconds, or null when the record carried no usable timestamp. */
  at: number | null;
  /** The record's own id, which makes a stable list key. */
  id: string | null;
}

export type Classified = { kind: 'prompt'; prompt: Prompt } | { kind: 'ignore' };

/**
 * Text that is carried by a `user` record but was never typed by the developer.
 *
 * Every one of these was found in real transcript data, not imagined. They are
 * matched at the **start** of the trimmed text: a prompt that happens to discuss
 * `<command-name>` somewhere in its body is still a prompt, and treating a
 * mention as a marker would silently drop it.
 */
export const WRAPPERS: readonly string[] = [
  // A skill's instructions, replayed into the conversation.
  'Base directory for this skill:',
  '(Re-invocation of',
  // The shell echo around a local slash command.
  '<local-command-caveat>',
  '<local-command-stdout>',
  '<command-name>',
  '<command-message>',
  '<command-args>',
  // Injected context and machinery, none of it the developer's words.
  '<system-reminder>',
  '<user-prompt-submit-hook>',
  '<task-notification>',
  // The marker left when a tool call is cut short.
  '[Request interrupted',
];

export function classify(record: unknown): Classified {
  if (!isObject(record)) return { kind: 'ignore' };
  if (record['type'] !== 'user') return { kind: 'ignore' };

  /*
   * Subagent turns, filtered — and **currently inert**. The field is `false` on
   * every record that carries it, including in a session that ran several
   * subagents, because those transcripts are written to
   * `<sessionId>/subagents/agent-*.jsonl` instead. It costs one comparison, it
   * is correct if the behaviour ever returns, and unfiltered it would present an
   * agent's internal delegation as the developer's own instructions.
   *
   * Recorded as inert rather than left looking like a working guard: a test that
   * faked a sidechain record to prove this line works would be testing the
   * fixture, not the tool.
   */
  if (record['isSidechain'] === true) return { kind: 'ignore' };

  const text = plainText(record['message']);
  if (text === null) return { kind: 'ignore' };

  const trimmed = text.trim();
  if (trimmed === '') return { kind: 'ignore' };
  if (WRAPPERS.some((marker) => trimmed.startsWith(marker))) return { kind: 'ignore' };

  return {
    kind: 'prompt',
    prompt: {
      // The text as stored, not the trimmed copy used for matching: SC-002
      // wants a copy that matches character for character.
      text,
      at: timestamp(record['timestamp']),
      id: typeof record['uuid'] === 'string' ? record['uuid'] : null,
    },
  };
}

/**
 * The message's text, or null when it carries anything else.
 *
 * `content` is **usually** an array of blocks and **sometimes** a plain string —
 * 10 of 1,129 in the sample. The first pass recorded "always an array, never a
 * string" and built the discriminator on it; a reader that believed that would
 * have dropped those prompts without a trace.
 *
 * A single non-text block disqualifies the record. A tool result is the common
 * case, and a mixed message is not something a developer typed either.
 */
function plainText(message: unknown): string | null {
  if (!isObject(message)) return null;

  const content = message['content'];
  if (typeof content === 'string') return content;
  if (!Array.isArray(content) || content.length === 0) return null;

  const parts: string[] = [];
  for (const block of content) {
    if (!isObject(block) || block['type'] !== 'text' || typeof block['text'] !== 'string') {
      return null;
    }
    parts.push(block['text']);
  }
  return parts.join('');
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
