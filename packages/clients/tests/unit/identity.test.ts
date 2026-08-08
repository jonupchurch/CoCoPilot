import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findRepository, processSessionId } from '../../src/identity.js';

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'cocoapilot-identity-'));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function repo(name: string, head: string): string {
  const dir = join(root, name);
  mkdirSync(join(dir, '.git'), { recursive: true });
  writeFileSync(join(dir, '.git', 'HEAD'), head);
  return dir;
}

describe('finding the repository', () => {
  it('reads the branch from HEAD', () => {
    const dir = repo('plain', 'ref: refs/heads/main\n');

    const found = findRepository(dir);

    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value).toEqual({ repo: dir, branch: 'main' });
  });

  it('keeps slashes in a branch name', () => {
    const dir = repo('slashed', 'ref: refs/heads/feat/session-hook\n');

    const found = findRepository(dir);
    expect(found.ok && found.value.branch).toBe('feat/session-hook');
  });

  it('walks up from a nested directory to the repository root', () => {
    const dir = repo('nested', 'ref: refs/heads/main\n');
    const deep = join(dir, 'src', 'main', 'routes');
    mkdirSync(deep, { recursive: true });

    const found = findRepository(deep);

    expect(found.ok && found.value.repo).toBe(dir);
  });

  it('reports a detached HEAD as the abbreviated commit', () => {
    // `git rev-parse --abbrev-ref` would say the literal "HEAD", which in a
    // board's branch slot reads as a bug rather than as information.
    const dir = repo('detached', 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0\n');

    const found = findRepository(dir);
    expect(found.ok && found.value.branch).toBe('a1b2c3d');
  });

  it('follows the gitdir: pointer a worktree leaves behind', () => {
    const real = join(root, 'worktree-store');
    mkdirSync(real, { recursive: true });
    writeFileSync(join(real, 'HEAD'), 'ref: refs/heads/wt\n');

    const dir = join(root, 'worktree');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.git'), `gitdir: ${real}\n`);

    const found = findRepository(dir);

    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value).toEqual({ repo: dir, branch: 'wt' });
  });

  it('resolves a relative gitdir: pointer against the repository', () => {
    const dir = join(root, 'relative');
    mkdirSync(join(dir, 'elsewhere'), { recursive: true });
    writeFileSync(join(dir, 'elsewhere', 'HEAD'), 'ref: refs/heads/rel\n');
    writeFileSync(join(dir, '.git'), 'gitdir: elsewhere\n');

    const found = findRepository(dir);
    expect(found.ok && found.value.branch).toBe('rel');
  });

  it('returns a value rather than throwing when there is no repository', () => {
    const orphan = mkdtempSync(join(tmpdir(), 'cocoapilot-orphan-'));
    try {
      expect(findRepository(orphan)).toEqual({ ok: false, reason: 'not-a-repository' });
    } finally {
      rmSync(orphan, { recursive: true, force: true });
    }
  });

  it('does not fail on a .git it cannot make sense of', () => {
    const dir = join(root, 'unreadable');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.git'), 'this is not a gitdir pointer\n');

    // Not a repository we can read, so keep walking up rather than crashing.
    expect(findRepository(dir).ok).toBe(false);
  });

  it('says unknown rather than guessing when HEAD is missing', () => {
    const dir = join(root, 'headless');
    mkdirSync(join(dir, '.git'), { recursive: true });

    const found = findRepository(dir);
    expect(found.ok && found.value.branch).toBe('unknown');
  });
});

describe('the session id', () => {
  it('is stable for the life of the process', () => {
    // One client process is one agent session, so successive reports have to
    // update a single board session rather than creating one per call.
    expect(processSessionId()).toBe(processSessionId());
    expect(processSessionId()).not.toBe('');
  });
});
