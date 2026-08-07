import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TranscriptReader } from '../../../src/main/transcript/reader.js';

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cocopilot-reader-'));
  path = join(dir, 'session.jsonl');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Always LF: a transcript is LF-delimited JSONL, whatever the platform. */
const write = (text: string): void => {
  writeFileSync(path, text);
};
const append = (text: string): void => {
  appendFileSync(path, text);
};

function lines(result: ReturnType<TranscriptReader['read']>): string[] {
  expect(result.ok).toBe(true);
  return result.ok ? result.lines : [];
}

describe('reading what is there', () => {
  it('returns every whole line', () => {
    write('one\ntwo\nthree\n');
    expect(lines(new TranscriptReader(path).read())).toEqual(['one', 'two', 'three']);
  });

  it('returns nothing at all for an empty file', () => {
    write('');
    expect(lines(new TranscriptReader(path).read())).toEqual([]);
  });

  it('reads a file larger than one chunk without losing a line', () => {
    // The chunk is 256 KiB; this crosses it several times, so any line that
    // straddles a boundary would show up as two.
    const rows = Array.from({ length: 20_000 }, (_, i) => `{"n":${i}}`);
    write(`${rows.join('\n')}\n`);

    expect(lines(new TranscriptReader(path).read())).toEqual(rows);
  });

  it('does not corrupt a multi-byte character that straddles a chunk boundary', () => {
    // Decoding each chunk as UTF-8 independently would split one of these in
    // half and produce a replacement character.
    const padding = 'x'.repeat((1 << 18) - 3);
    write(`${padding}\n"— é 🙂 中"\n`);

    const read = lines(new TranscriptReader(path).read());
    expect(read[1]).toBe('"— é 🙂 中"');
    expect(read[1]).not.toContain('�');
  });
});

describe('reading a file that is still being written', () => {
  it('reads only what was appended since the last call', () => {
    write('one\n');
    const reader = new TranscriptReader(path);
    expect(lines(reader.read())).toEqual(['one']);

    append('two\n');
    expect(lines(reader.read())).toEqual(['two']);
  });

  it('costs nothing and returns nothing when the file has not grown', () => {
    write('one\n');
    const reader = new TranscriptReader(path);
    reader.read();

    expect(lines(reader.read())).toEqual([]);
    expect(lines(reader.read())).toEqual([]);
  });

  it('buffers a partial trailing line and completes it on the next read', () => {
    // The normal case, not the exceptional one: the file is appended to by
    // another process while we read it, so the last line is often half-written.
    write('one\n{"partial":');
    const reader = new TranscriptReader(path);
    expect(lines(reader.read())).toEqual(['one']);

    append('true}\n');
    expect(lines(reader.read())).toEqual(['{"partial":true}']);
  });

  it('recovers a line split across three separate reads', () => {
    write('{"a"');
    const reader = new TranscriptReader(path);
    expect(lines(reader.read())).toEqual([]);

    append(':1,"b"');
    expect(lines(reader.read())).toEqual([]);

    append(':2}\n');
    expect(lines(reader.read())).toEqual(['{"a":1,"b":2}']);
  });

  it('never emits a partial line as though it were complete', () => {
    write('{"half":');
    expect(lines(new TranscriptReader(path).read())).toEqual([]);
  });
});

describe('a file that stops being the file it was', () => {
  it('starts over when the transcript shrinks', () => {
    // Transcripts only grow, so a smaller size means rotated or replaced.
    // Continuing from the old offset would splice unrelated bytes together.
    write('one\ntwo\nthree\n');
    const reader = new TranscriptReader(path);
    reader.read();

    write('fresh\n');
    expect(lines(reader.read())).toEqual(['fresh']);
  });

  it('discards a buffered fragment when the file is replaced', () => {
    write('one\n{"partial":');
    const reader = new TranscriptReader(path);
    reader.read();

    write('{"whole":true}\n');
    expect(lines(reader.read())).toEqual(['{"whole":true}']);
  });

  it('abandons a line that never ends rather than buffering without limit', () => {
    // A file that stops being line-delimited must not grow the buffer until the
    // process dies.
    write('x'.repeat((4 << 20) + 1_000));
    const reader = new TranscriptReader(path);

    expect(lines(reader.read())).toEqual([]);
    append('\nafter\n');
    expect(lines(reader.read())).toEqual(['after']);
  });
});

describe('restarted tells the caller to discard what it accumulated', () => {
  it('is false for a first read and for an ordinary append', () => {
    write('one\n');
    const reader = new TranscriptReader(path);

    const first = reader.read();
    expect(first.ok && first.restarted).toBe(false);

    append('two\n');
    const second = reader.read();
    expect(second.ok && second.restarted).toBe(false);
  });

  it('is true when the file shrinks', () => {
    write('one\ntwo\nthree\n');
    const reader = new TranscriptReader(path);
    reader.read();

    write('fresh\n');
    const result = reader.read();
    // Without this the caller would append the whole file to a list it already
    // holds, and every prompt would appear twice.
    expect(result.ok && result.restarted).toBe(true);
  });

  it('is true when the file returns after disappearing', () => {
    write('one\n');
    const reader = new TranscriptReader(path);
    reader.read();

    rmSync(path);
    reader.read();

    write('again\n');
    const result = reader.read();
    expect(result.ok && result.restarted).toBe(true);
  });
});

describe('failure is a value, never an exception', () => {
  it('reports unreadable for a file that is not there', () => {
    expect(new TranscriptReader(join(dir, 'absent.jsonl')).read()).toEqual({
      ok: false,
      reason: 'unreadable',
    });
  });

  it('reports unreadable for a directory where a file was expected', () => {
    expect(new TranscriptReader(dir).read().ok).toBe(false);
  });

  it('reports unreadable rather than throwing when the file disappears mid-session', () => {
    write('one\n');
    const reader = new TranscriptReader(path);
    reader.read();

    rmSync(path);
    expect(reader.read()).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('recovers when the file comes back', () => {
    write('one\n');
    const reader = new TranscriptReader(path);
    reader.read();

    rmSync(path);
    expect(reader.read().ok).toBe(false);

    write('again\n');
    expect(lines(reader.read())).toEqual(['again']);
  });

  it('reads a transcript written with CRLF without carrying the carriage return', () => {
    write('one\r\ntwo\r\n');
    expect(lines(new TranscriptReader(path).read())).toEqual(['one', 'two']);
  });
});

describe('size', () => {
  it('stays responsive on a large transcript', () => {
    // SC-007 sets 100 MB as the bar. 20 MB here keeps the suite quick while
    // still crossing the chunk boundary eighty times; the point is that the
    // cost is linear and bounded, not that this exact size is the limit.
    const row = `${JSON.stringify({ type: 'user', text: 'x'.repeat(180) })}\n`;
    write(row.repeat(100_000));

    const started = Date.now();
    const result = new TranscriptReader(path).read();
    const elapsed = Date.now() - started;

    expect(lines(result)).toHaveLength(100_000);
    expect(elapsed).toBeLessThan(10_000);
  });

  it('does not re-read what it has already consumed', () => {
    const row = `${JSON.stringify({ type: 'user', text: 'x'.repeat(180) })}\n`;
    write(row.repeat(100_000));

    const reader = new TranscriptReader(path);
    reader.read();
    const consumed = reader.position;

    append(row);
    const started = Date.now();
    expect(lines(reader.read())).toHaveLength(1);
    const elapsed = Date.now() - started;

    // The whole design: appending one line costs one line's work, not the
    // file's. A full re-read here would be twenty megabytes.
    expect(reader.position).toBeGreaterThan(consumed);
    expect(elapsed).toBeLessThan(500);
  });
});
