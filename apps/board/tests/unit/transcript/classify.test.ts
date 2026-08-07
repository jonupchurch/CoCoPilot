import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { classify, WRAPPERS, type Prompt } from '../../../src/main/transcript/classify.js';

const FIXTURES = fileURLToPath(new URL('../../fixtures/transcripts/', import.meta.url));

/** Parse a fixture the way the reader will: line by line, skipping failures. */
function prompts(fixture: string): Prompt[] {
  const found: Prompt[] = [];
  for (const line of readFileSync(`${FIXTURES}${fixture}`, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const verdict = classify(record);
    if (verdict.kind === 'prompt') found.push(verdict.prompt);
  }
  return found;
}

const user = (text: unknown, extra: Record<string, unknown> = {}): unknown => ({
  type: 'user',
  uuid: 'u1',
  isSidechain: false,
  timestamp: '2026-08-07T10:00:00.000Z',
  message: { role: 'user', content: text },
  ...extra,
});

const textBlocks = (...parts: string[]): unknown =>
  parts.map((text) => ({ type: 'text', text }));

/**
 * The counting trap, stated as numbers rather than as a warning.
 *
 * If a change here makes these counts go up, the board has started presenting
 * tool output and machinery as things the developer typed.
 */
describe('a prompt is not a user record', () => {
  it('finds 3 prompts among 10 user records that are mostly tool results', () => {
    const found = prompts('tool-results.jsonl');

    expect(found).toHaveLength(3);
    expect(found.map((p) => p.text)).toEqual([
      'Rename fetchUser to loadUser everywhere',
      'Now run the session tests',
      'Good. Commit that.',
    ]);
  });

  it('rejects a tool result even though its record type is user', () => {
    const record = user([{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }]);
    expect(classify(record).kind).toBe('ignore');
  });

  it('rejects a message mixing text with anything else', () => {
    // Not something a developer typed either, and admitting it would put tool
    // output on screen attached to a real prompt.
    const record = user([
      { type: 'text', text: 'do the thing' },
      { type: 'tool_result', tool_use_id: 't1', content: 'ok' },
    ]);
    expect(classify(record).kind).toBe('ignore');
  });

  it('ignores every record type that is not user', () => {
    for (const type of ['assistant', 'ai-title', 'last-prompt', 'attachment', 'system']) {
      expect(classify({ type, message: { content: textBlocks('x') } }).kind, type).toBe('ignore');
    }
  });
});

/**
 * The second reading, and the one the first pass missed: content being text is
 * necessary and not sufficient. Each of these was found in real data.
 */
describe('a prompt is not merely text-shaped', () => {
  it('finds 1 prompt among 10 text-only records', () => {
    const found = prompts('wrappers.jsonl');

    expect(found).toHaveLength(1);
    expect(found[0]?.text).toContain('Explain what <command-name> does');
  });

  it('rejects each wrapper shape by name', () => {
    const cases: Array<[string, string]> = [
      ['a skill instruction payload', 'Base directory for this skill: d:\\x\\y'],
      ['a skill re-invocation', '(Re-invocation of /speckit-tasks — arguments below are new.)'],
      ['a local command caveat', '<local-command-caveat>Caveat: …</local-command-caveat>'],
      ['a local command echo', '<local-command-stdout>Compacted </local-command-stdout>'],
      ['a command name', '<command-name>/compact</command-name>'],
      ['a command message', '<command-message>compact</command-message>'],
      ['an injected reminder', '<system-reminder>context follows</system-reminder>'],
      ['a task notification', '<task-notification>agent finished</task-notification>'],
      ['an interrupt marker', '[Request interrupted by user for tool use]'],
    ];

    for (const [label, text] of cases) {
      expect(classify(user(textBlocks(text))).kind, label).toBe('ignore');
    }
  });

  it('matches a wrapper only at the start, so a prompt discussing one survives', () => {
    // Treating a mention as a marker would silently drop a real question.
    const record = user(textBlocks('Why does <system-reminder> appear in my transcript?'));
    expect(classify(record).kind).toBe('prompt');
  });

  it('covers every documented wrapper with a case', () => {
    // The table above is the contract; this keeps it from drifting behind the
    // list the code actually uses.
    expect(WRAPPERS).toHaveLength(11);
    for (const marker of WRAPPERS) {
      expect(classify(user(textBlocks(`${marker} …`))).kind, marker).toBe('ignore');
    }
  });

  it('rejects blank text without calling it a prompt', () => {
    expect(classify(user(textBlocks('   '))).kind).toBe('ignore');
    expect(classify(user(textBlocks(''))).kind).toBe('ignore');
  });
});

describe('content is a string as often as it needs to be', () => {
  it('accepts a plain string, which the first pass said never happens', () => {
    // 10 of 1,129 in the real sample. A reader built on "always an array" drops
    // these without a trace.
    const found = prompts('string-content.jsonl');

    expect(found.map((p) => p.text)).toEqual(["ok, we're back with the new folder name", 'yes']);
  });

  it('applies the wrapper rules to string content too', () => {
    expect(classify(user('<local-command-stdout>Compacted </local-command-stdout>')).kind).toBe(
      'ignore',
    );
  });
});

describe('unfamiliar and malformed records', () => {
  it('skips types it has never seen and keeps the prompts around them', () => {
    // A ninth type appeared between two samples taken a day apart, so this is
    // an observed failure mode rather than a hypothetical one.
    expect(prompts('unknown-types.jsonl').map((p) => p.text)).toEqual([
      'A prompt that must survive the types around it',
      'And a second one after them',
    ]);
  });

  it('ignores anything that is not a record-shaped object', () => {
    for (const value of [null, undefined, 42, 'a string', [], [{ type: 'user' }], true]) {
      expect(classify(value).kind).toBe('ignore');
    }
  });

  it('ignores a user record whose message is missing or malformed', () => {
    expect(classify({ type: 'user' }).kind).toBe('ignore');
    expect(classify({ type: 'user', message: null }).kind).toBe('ignore');
    expect(classify({ type: 'user', message: { content: null } }).kind).toBe('ignore');
    expect(classify({ type: 'user', message: { content: [] } }).kind).toBe('ignore');
    expect(classify(user([{ type: 'text' }])).kind).toBe('ignore');
  });

  it('filters a sidechain record, a guard that is currently inert', () => {
    // `isSidechain` is false on every record that carries it, even in sessions
    // that ran subagents -- those transcripts live in `<sessionId>/subagents/`.
    // This asserts the line behaves, not that the field ever arrives true.
    expect(classify(user(textBlocks('from a subagent'), { isSidechain: true })).kind).toBe(
      'ignore',
    );
  });
});

describe('what a prompt carries', () => {
  it('preserves the text exactly, including whitespace SC-002 must copy', () => {
    const text = '  line one\n\n  line two  ';
    const verdict = classify(user(textBlocks(text)));

    expect(verdict.kind).toBe('prompt');
    // Trimmed only for matching; what is stored is what was typed.
    if (verdict.kind === 'prompt') expect(verdict.prompt.text).toBe(text);
  });

  it('joins multiple text blocks in order', () => {
    const verdict = classify(user(textBlocks('first ', 'second')));
    if (verdict.kind === 'prompt') expect(verdict.prompt.text).toBe('first second');
  });

  it('reads the timestamp, and reports null rather than zero when it cannot', () => {
    const good = classify(user(textBlocks('x')));
    if (good.kind === 'prompt') {
      expect(good.prompt.at).toBe(Date.parse('2026-08-07T10:00:00.000Z'));
    }

    for (const bad of [undefined, 'not a date', 12345, null]) {
      const verdict = classify(user(textBlocks('x'), { timestamp: bad }));
      // Zero would render as 1970 and look like a real, very old prompt.
      if (verdict.kind === 'prompt') expect(verdict.prompt.at, String(bad)).toBeNull();
    }
  });

  it('carries the record id when there is one, for a stable list key', () => {
    const verdict = classify(user(textBlocks('x'), { uuid: 'abc' }));
    if (verdict.kind === 'prompt') expect(verdict.prompt.id).toBe('abc');

    const anonymous = classify(user(textBlocks('x'), { uuid: 42 }));
    if (anonymous.kind === 'prompt') expect(anonymous.prompt.id).toBeNull();
  });

  it('reads the typical fixture as two prompts', () => {
    expect(prompts('typical.jsonl')).toHaveLength(2);
  });
});
