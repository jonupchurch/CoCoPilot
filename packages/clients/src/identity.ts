import { randomUUID } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/**
 * Which repository, which branch, which session — all derived, never asked for.
 *
 * Exposing `repo`, `branch` or `sessionId` as tool parameters would be three
 * more chances for a model to get identity wrong mid-task, for no benefit
 * (FR-002, FR-004).
 *
 * **This reads `.git` directly rather than running `git`.** The contract
 * document originally said to shell out to `git rev-parse --show-toplevel`, but
 * FR-011 forbids the clients from launching "any other process" and US3's third
 * acceptance scenario says "nothing is launched — no window opens and no process
 * starts". FR-018 permits *determining the path and current branch*; it does not
 * prescribe how. Reading the files costs no spawn on a path SC-003 bounds at two
 * seconds, and does not assume `git` is on `PATH` — which the MCP server,
 * launched by a host rather than by a shell, cannot.
 *
 * Nothing outside `.git` is ever read (FR-018).
 */

export interface RepoIdentity {
  repo: string;
  branch: string;
}

export type RepoResult = { ok: true; value: RepoIdentity } | { ok: false; reason: 'not-a-repository' };

/** The session id the service uses for pushes with no process behind them. */
export const UNATTRIBUTED = 'unattributed';

let processSession: string | undefined;

/**
 * Stable for the life of this process, which is exactly one agent session —
 * the host spawns one client per session (FR-003). Successive reports therefore
 * update one board session rather than creating one per call.
 */
export function processSessionId(): string {
  processSession ??= randomUUID();
  return processSession;
}

/** Walk up from `startDir` looking for `.git`. */
export function findRepository(startDir: string): RepoResult {
  let current = resolve(startDir);

  for (;;) {
    const dotGit = join(current, '.git');
    const gitDir = resolveGitDir(dotGit, current);
    if (gitDir !== null) {
      return { ok: true, value: { repo: current, branch: readBranch(gitDir) } };
    }

    const parent = dirname(current);
    if (parent === current) return { ok: false, reason: 'not-a-repository' };
    current = parent;
  }
}

/**
 * `.git` is usually a directory. In a worktree or a submodule it is a file
 * containing `gitdir: <path>`, and that path may be relative to the repository.
 */
function resolveGitDir(dotGit: string, repoRoot: string): string | null {
  let stats;
  try {
    stats = statSync(dotGit);
  } catch {
    return null;
  }

  if (stats.isDirectory()) return dotGit;
  if (!stats.isFile()) return null;

  try {
    const pointer = readFileSync(dotGit, 'utf8').trim();
    const match = /^gitdir:\s*(.+)$/.exec(pointer);
    if (match?.[1] === undefined) return null;
    const target = match[1].trim();
    return isAbsolute(target) ? target : resolve(repoRoot, target);
  } catch {
    return null;
  }
}

/**
 * `HEAD` is either `ref: refs/heads/<branch>` or a raw commit id.
 *
 * A detached HEAD reports the abbreviated commit rather than the literal string
 * `HEAD` that `git rev-parse --abbrev-ref` would give: on a board, `HEAD` in the
 * branch slot reads as a bug, while `a1b2c3d` reads as what it is.
 */
function readBranch(gitDir: string): string {
  let head: string;
  try {
    head = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim();
  } catch {
    return 'unknown';
  }

  const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
  if (ref?.[1] !== undefined) return ref[1].trim();

  if (/^[0-9a-f]{7,40}$/i.test(head)) return head.slice(0, 7);
  return 'unknown';
}
