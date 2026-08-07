import { describe, expect, it } from 'vitest';

import { ContextTracker, type ContextFile } from '../../../src/main/transcript/context.js';

/**
 * What the agent is holding, folded out of a record stream.
 *
 * Every fixture below is the shape a real 14 MB session actually had — the
 * inputs, the `usage` object with its caching fields, the compact boundary, the
 * attachment kinds. Two of the facts asserted here contradict what a reasonable
 * reading of the format would suggest, and both are load-bearing.
 */

const assistant = (
  content: unknown[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  type: 'assistant',
  uuid: 'a1',
  timestamp: '2026-08-07T10:00:00.000Z',
  message: { role: 'assistant', content, ...extra },
});

const toolUse = (id: string, name: string, input: unknown): Record<string, unknown> => ({
  type: 'tool_use',
  id,
  name,
  input,
});

const toolResult = (...ids: string[]): Record<string, unknown> => ({
  type: 'user',
  uuid: `r${ids.join('')}`,
  message: {
    role: 'user',
    content: ids.map((id) => ({ type: 'tool_result', tool_use_id: id, content: 'ok' })),
  },
});

function read(...records: unknown[]): ContextTracker {
  const tracker = new ContextTracker();
  for (const record of records) tracker.observe(record);
  return tracker;
}

const paths = (files: readonly ContextFile[]): string[] => files.map((f) => f.path);

describe('files the agent has opened', () => {
  it('lists one per tool call that named a file', () => {
    const tracker = read(
      assistant([toolUse('t1', 'Read', { file_path: 'src/a.ts' })]),
      assistant([toolUse('t2', 'Edit', { file_path: 'src/b.ts' })]),
    );

    expect(paths(tracker.view().files)).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('takes any tool that names a file, not a list of tools that do', () => {
    // The list would be Read, Edit, Write and NotebookEdit today, and would stop
    // being complete the first time a new one shipped.
    const tracker = read(
      assistant([toolUse('t1', 'SomeToolNobodyHasWrittenYet', { file_path: 'src/new.ts' })]),
    );

    expect(paths(tracker.view().files)).toEqual(['src/new.ts']);
    expect(tracker.view().files[0]?.action).toBe('SomeToolNobodyHasWrittenYet');
  });

  it('ignores a tool call that names no file', () => {
    const tracker = read(
      assistant([toolUse('t1', 'Bash', { command: 'npm test' })]),
      assistant([toolUse('t2', 'Grep', { pattern: 'useSession', path: 'src' })]),
    );

    expect(tracker.view().files).toEqual([]);
  });

  it('lists a file once, at its most recent touch', () => {
    const tracker = read(
      assistant([toolUse('t1', 'Read', { file_path: 'src/a.ts' })]),
      assistant([toolUse('t2', 'Read', { file_path: 'src/b.ts' })]),
      assistant([toolUse('t3', 'Edit', { file_path: 'src/a.ts' })]),
    );

    // Moved to the end, not duplicated and not left where it was: the question
    // this section answers is what the agent is working with *now*.
    expect(paths(tracker.view().files)).toEqual(['src/b.ts', 'src/a.ts']);
    expect(tracker.view().files[1]?.action).toBe('Edit');
  });

  it('takes files that arrived without a tool call', () => {
    // An @-mention, an external edit the agent was shown, a reference carried
    // across a compaction. Three of the eleven attachment kinds in the sample
    // carry a filename.
    const tracker = read(
      { type: 'attachment', attachment: { type: 'file', filename: 'CLAUDE.md' } },
      {
        type: 'attachment',
        attachment: { type: 'edited_text_file', filename: 'src/c.ts', snippet: '...' },
      },
      { type: 'attachment', attachment: { type: 'todo_reminder', content: [] } },
    );

    expect(paths(tracker.view().files)).toEqual(['CLAUDE.md', 'src/c.ts']);
    expect(tracker.view().files[0]?.action).toBe('file');
  });
});

describe('the one being worked on right now', () => {
  it('is the call whose result has not come back', () => {
    const tracker = read(
      assistant([toolUse('t1', 'Read', { file_path: 'src/a.ts' })]),
      toolResult('t1'),
      assistant([toolUse('t2', 'Read', { file_path: 'src/b.ts' })]),
    );

    expect(tracker.view().files.map((f) => [f.path, f.active])).toEqual([
      ['src/a.ts', false],
      ['src/b.ts', true],
    ]);
  });

  it('stops being active the moment its result lands', () => {
    const tracker = read(assistant([toolUse('t1', 'Read', { file_path: 'src/a.ts' })]));
    expect(tracker.view().files[0]?.active).toBe(true);

    tracker.observe(toolResult('t1'));
    expect(tracker.view().files[0]?.active).toBe(false);
  });

  it('handles several results arriving in one record', () => {
    const tracker = read(
      assistant([
        toolUse('t1', 'Read', { file_path: 'src/a.ts' }),
        toolUse('t2', 'Read', { file_path: 'src/b.ts' }),
      ]),
      toolResult('t1', 't2'),
    );

    expect(tracker.view().files.every((f) => !f.active)).toBe(true);
  });

  it('never marks a file that arrived by attachment as active', () => {
    // There is no call to still be running.
    const tracker = read({
      type: 'attachment',
      attachment: { type: 'file', filename: 'CLAUDE.md' },
    });

    expect(tracker.view().files[0]?.active).toBe(false);
  });
});

describe('how much of the window is in use', () => {
  it('sums the three input fields, not input_tokens alone', () => {
    // The finding that matters most here. With prompt caching `input_tokens` is
    // routinely 2 while the cache fields carry the other 290,000 — reading the
    // obvious field would draw a nearly-full window as empty.
    const tracker = read(
      assistant([], {
        usage: {
          input_tokens: 2,
          cache_read_input_tokens: 290_443,
          cache_creation_input_tokens: 2_390,
          output_tokens: 1_100,
        },
      }),
    );

    expect(tracker.view().tokens).toBe(292_835);
  });

  it('leaves out output_tokens, which is what came back rather than what is held', () => {
    const tracker = read(assistant([], { usage: { input_tokens: 100, output_tokens: 900 } }));

    expect(tracker.view().tokens).toBe(100);
  });

  it('takes the most recent measurement', () => {
    const tracker = read(
      assistant([], { usage: { input_tokens: 100 } }),
      assistant([], { usage: { input_tokens: 250 } }),
    );

    expect(tracker.view().tokens).toBe(250);
  });

  it('is null rather than zero when nothing has said', () => {
    // The distinction the whole availability type exists for: "the transcript
    // did not tell us" is not a measurement of an empty context.
    expect(read(assistant([])).view().tokens).toBeNull();
    expect(read(assistant([], { usage: {} })).view().tokens).toBeNull();
    expect(read(assistant([], { usage: 'nonsense' })).view().tokens).toBeNull();
    expect(read(assistant([], { usage: { input_tokens: 'lots' } })).view().tokens).toBeNull();
  });

  it('keeps the last good measurement when a later record carries none', () => {
    const tracker = read(
      assistant([], { usage: { input_tokens: 100 } }),
      assistant([toolUse('t1', 'Read', { file_path: 'src/a.ts' })]),
    );

    expect(tracker.view().tokens).toBe(100);
  });

  it('ignores a negative or non-finite count', () => {
    const tracker = read(
      assistant([], { usage: { input_tokens: -5, cache_read_input_tokens: Number.NaN } }),
    );

    expect(tracker.view().tokens).toBeNull();
  });
});

describe('a compact boundary throws the context away', () => {
  it('forgets every file opened before it', () => {
    // `system` / `compact_boundary` is where the agent's context was actually
    // discarded. Listing what came before would be the board asserting
    // something about the agent's memory that has stopped being true.
    const tracker = read(
      assistant([toolUse('t1', 'Read', { file_path: 'src/old.ts' })]),
      toolResult('t1'),
      { type: 'system', subtype: 'compact_boundary', content: 'Conversation compacted' },
      assistant([toolUse('t2', 'Read', { file_path: 'src/new.ts' })]),
    );

    expect(paths(tracker.view().files)).toEqual(['src/new.ts']);
  });

  it('does not forget on a system record that is not a boundary', () => {
    const tracker = read(
      assistant([toolUse('t1', 'Read', { file_path: 'src/a.ts' })]),
      { type: 'system', subtype: 'something_else', content: 'hello' },
    );

    expect(paths(tracker.view().files)).toEqual(['src/a.ts']);
  });

  it('clears a call that was running when the boundary landed', () => {
    const tracker = read(
      assistant([toolUse('t1', 'Read', { file_path: 'src/a.ts' })]),
      { type: 'system', subtype: 'compact_boundary' },
      assistant([toolUse('t2', 'Read', { file_path: 'src/a.ts' })]),
      toolResult('t2'),
    );

    expect(tracker.view().files[0]?.active).toBe(false);
  });
});

describe('nothing it does not understand costs it anything', () => {
  it('leaves the state alone for every malformed shape', () => {
    const tracker = read(
      assistant([toolUse('t1', 'Read', { file_path: 'src/a.ts' })]),
      null,
      undefined,
      42,
      'a string',
      [],
      { type: 'assistant' },
      { type: 'assistant', message: 'not an object' },
      { type: 'assistant', message: { content: 'not an array' } },
      { type: 'assistant', message: { content: [null, 7, { type: 'text', text: 'hi' }] } },
      { type: 'user', message: { content: [{ type: 'tool_result' }] } },
      { type: 'attachment' },
      { type: 'attachment', attachment: { filename: 42 } },
      { type: 'attachment', attachment: { filename: '' } },
      { type: 'a-kind-nobody-has-shipped-yet', payload: { file_path: 'src/never.ts' } },
    );

    expect(paths(tracker.view().files)).toEqual(['src/a.ts']);
    expect(tracker.view().tokens).toBeNull();
  });

  it('never treats an empty file path as a file', () => {
    const tracker = read(assistant([toolUse('t1', 'Read', { file_path: '' })]));

    expect(tracker.view().files).toEqual([]);
  });
});

describe('reset', () => {
  it('drops the files and the count, for a transcript that was replaced', () => {
    const tracker = read(
      assistant([toolUse('t1', 'Read', { file_path: 'src/a.ts' })], {
        usage: { input_tokens: 100 },
      }),
    );

    tracker.reset();

    expect(tracker.view()).toEqual({ files: [], tokens: null });
  });
});
