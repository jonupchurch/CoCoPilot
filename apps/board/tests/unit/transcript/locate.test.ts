import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { locate, projectDirectory, slug } from '../../../src/main/transcript/locate.js';

let home: string;

/** `~/.claude/projects/<slug>` for a repository, created and returned. */
function projectDir(repoPath: string): string {
  const dir = projectDirectory(repoPath, home);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function transcript(dir: string, name: string, at?: number): string {
  const path = join(dir, name);
  writeFileSync(path, '{"type":"user"}\n');
  if (at !== undefined) utimesSync(path, at / 1000, at / 1000);
  return path;
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'cocoapilot-home-'));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

/**
 * The slug cases come from real directories on a real machine, not from the
 * shape the rule ought to have. Three of them disprove the first pass's
 * "drive colon and separators" reading outright.
 */
describe('slug', () => {
  it('replaces every non-alphanumeric character with a hyphen', () => {
    expect(slug('d:\\Codelib\\CoCoPilot')).toBe('d--Codelib-CoCoPilot');
    expect(slug('d:\\Codelib\\skmc')).toBe('d--Codelib-skmc');
  });

  it('handles the characters that are not separators at all', () => {
    // Verified against ~/.claude/projects on the machine this was written on.
    expect(slug('d:\\Codelib\\D&D')).toBe('d--Codelib-D-D');
    expect(slug('d:\\Codelib\\fitt.d')).toBe('d--Codelib-fitt-d');
    expect(slug('d:\\Codelib\\t@nk.r')).toBe('d--Codelib-t-nk-r');
  });

  it('preserves case and digits', () => {
    expect(slug('d:\\Codelib\\playm8z')).toBe('d--Codelib-playm8z');
  });

  it('needs no platform-specific clause for a POSIX path', () => {
    // The corrected rule has nothing Windows-shaped left in it, which is most
    // of why the macOS/Linux risk shrank.
    expect(slug('/home/u/proj')).toBe('-home-u-proj');
    expect(slug('/Users/jo/my.app')).toBe('-Users-jo-my-app');
  });
});

describe('locate — an exact transcript id', () => {
  it('resolves the file named by the id', () => {
    const dir = projectDir('/repo');
    const path = transcript(dir, 'abc-123.jsonl');

    expect(locate('/repo', 'abc-123', home)).toEqual({ ok: true, path });
  });

  it('reports unavailability rather than falling back when that file is absent', () => {
    const dir = projectDir('/repo');
    transcript(dir, 'someone-elses-session.jsonl');

    // Falling back here would show this session another session's prompts,
    // plausibly and silently. The fallback is for clients that could not
    // identify themselves at all.
    expect(locate('/repo', 'abc-123', home)).toEqual({ ok: false, reason: 'no-transcript' });
  });

  it('refuses an id that is not a bare filename', () => {
    const dir = projectDir('/repo');
    transcript(dir, 'real.jsonl');

    // The id crosses the wire, where the contract checks only its length, so a
    // traversal is a legal `Label`. Joining it would walk out of the directory
    // and read a file FR-016 forbids touching.
    for (const hostile of [
      '../../../etc/passwd',
      '..\\..\\secrets',
      'a/b',
      'a\\b',
      '..',
      '.',
      '',
    ]) {
      // The *reason* matters, not merely that it failed: an id pointing at a
      // file that happens not to exist also fails, and asserting only `ok`
      // would pass with the guard deleted.
      expect(locate('/repo', hostile, home), hostile).toEqual({
        ok: false,
        reason: 'rejected-id',
      });
    }
  });

  it('refuses a traversal even when the target exists', () => {
    projectDir('/repo');
    const outside = join(home, '.claude', 'projects');
    writeFileSync(join(outside, 'elsewhere.jsonl'), '{}\n');

    expect(locate('/repo', '../elsewhere', home)).toEqual({ ok: false, reason: 'rejected-id' });
  });
});

describe('locate — the newest-file fallback', () => {
  it('picks the most recently modified transcript', () => {
    const dir = projectDir('/repo');
    transcript(dir, 'older.jsonl', 1_000_000);
    const newer = transcript(dir, 'newer.jsonl', 2_000_000);

    expect(locate('/repo', null, home)).toEqual({ ok: true, path: newer });
  });

  it('ignores directories, including the subagents directory beside the file', () => {
    const dir = projectDir('/repo');
    const path = transcript(dir, 'session.jsonl', 1_000_000);

    // Real layout: `<sessionId>/subagents/agent-*.jsonl` sits next to the
    // transcript. It is not this session's transcript and FR-016 forbids it.
    mkdirSync(join(dir, 'session', 'subagents'), { recursive: true });
    writeFileSync(join(dir, 'session', 'subagents', 'agent-a1.jsonl'), '{}\n');
    // A directory that would win on both extension and mtime if unfiltered.
    mkdirSync(join(dir, 'trap.jsonl'));
    mkdirSync(join(dir, 'memory'));

    expect(locate('/repo', null, home)).toEqual({ ok: true, path });
  });

  it('ignores files that are not transcripts', () => {
    const dir = projectDir('/repo');
    writeFileSync(join(dir, 'notes.txt'), 'x');
    writeFileSync(join(dir, 'agent-a1.meta.json'), '{}');
    const path = transcript(dir, 'session.jsonl');

    expect(locate('/repo', null, home)).toEqual({ ok: true, path });
  });
});

describe('locate — nothing to find', () => {
  it('reports a missing project directory without throwing', () => {
    expect(locate('/never-seen', null, home)).toEqual({ ok: false, reason: 'no-directory' });
  });

  it('reports an empty project directory as having no transcript', () => {
    projectDir('/repo');
    expect(locate('/repo', null, home)).toEqual({ ok: false, reason: 'no-transcript' });
  });

  it('distinguishes a missing directory from a directory with nothing in it', () => {
    // Both are unavailable to the caller, but they are not the same fact and
    // collapsing them here would make the reason useless for diagnosis.
    projectDir('/exists');

    expect(locate('/exists', null, home).ok).toBe(false);
    expect(locate('/absent', null, home)).toEqual({ ok: false, reason: 'no-directory' });
  });
});
