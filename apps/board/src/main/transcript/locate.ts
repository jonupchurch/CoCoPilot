import { readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';

/**
 * Which file on disk holds the transcript for the session being shown.
 *
 * The whole rule is derived from the reported repository path and needs no
 * configuration (FR-001). Everything here is empirical and re-verified — see
 * [research.md](../../../../../specs/005-transcript-reader/research.md), which
 * records four claims that turned out to be wrong.
 *
 * Nothing in this module throws. A path that does not resolve is a *reason*,
 * because unavailability is the designed failure for every one of these cases.
 */

const EXTENSION = '.jsonl';

export type Located =
  | { ok: true; path: string }
  | { ok: false; reason: 'no-directory' | 'no-transcript' | 'rejected-id' | 'unreadable' };

/**
 * The project slug: **every character that is not `[A-Za-z0-9]` becomes a
 * hyphen**, and case is preserved.
 *
 * Not a drive-letter-and-separator rule, which is what the first pass recorded
 * and what three real directories on this machine disprove: `D&D` → `D-D`,
 * `fitt.d` → `fitt-d`, `t@nk.r` → `t-nk-r`. None of `&`, `.` or `@` is a
 * separator. The doubled hyphen in `d--Codelib-…` is just `:` and `\` each
 * mapping to one.
 *
 * That also means there is no Windows-specific clause left to get wrong on
 * macOS or Linux, where `/home/u/proj` → `-home-u-proj` falls out of the same
 * substitution.
 */
export function slug(repoPath: string): string {
  return repoPath.replace(/[^A-Za-z0-9]/g, '-');
}

export function projectDirectory(repoPath: string, home: string = homedir()): string {
  return join(home, '.claude', 'projects', slug(repoPath));
}

/**
 * A transcript id must be a bare filename component.
 *
 * It arrives over the wire, where the contract checks only its length, so
 * `../../../etc/passwd` is a legal `Label`. Joining that to the project
 * directory would walk straight out of it and read a file FR-016 forbids us
 * from touching. Claude Code's ids are UUIDs; anything that is not plainly
 * filename-shaped is refused rather than sanitised, because a repaired path is a
 * guess about what the caller meant.
 */
function acceptableId(id: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(id) && id !== '.' && id !== '..';
}

/**
 * Resolve the transcript, preferring the exact file the client named.
 *
 * **A supplied id is exact or nothing.** If it names a file that is not there,
 * this reports unavailability rather than falling back to the newest — the
 * fallback exists for clients that could not identify themselves at all, and
 * using it here would quietly show one session another session's prompts.
 */
export function locate(
  repoPath: string,
  transcriptId: string | null,
  home: string = homedir(),
): Located {
  const directory = projectDirectory(repoPath, home);

  if (transcriptId !== null) {
    if (!acceptableId(transcriptId)) return { ok: false, reason: 'rejected-id' };

    const candidate = join(directory, `${transcriptId}${EXTENSION}`);
    // Belt and braces: `acceptableId` already excludes separators, and this
    // catches anything a future platform quirk lets through.
    if (!isInside(candidate, directory)) return { ok: false, reason: 'rejected-id' };

    return isFile(candidate) ? { ok: true, path: candidate } : { ok: false, reason: 'no-transcript' };
  }

  return newest(directory);
}

/**
 * The fallback: the most recently modified transcript in the directory.
 *
 * Right whenever one session is running in a repository, and capable of picking
 * a sibling session's file when two are. A heuristic, stated as one.
 */
function newest(directory: string): Located {
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return { ok: false, reason: 'no-directory' };
  }

  let best: { path: string; at: number } | null = null;

  for (const entry of entries) {
    if (!entry.endsWith(EXTENSION)) continue;

    const path = join(directory, entry);
    // Regular files only. A directory beside the transcripts holds *subagent*
    // transcripts — `<sessionId>/subagents/agent-*.jsonl` — and FR-016 forbids
    // reading them. A directory named `x.jsonl` would otherwise be a candidate.
    let at: number;
    try {
      const stats = statSync(path);
      if (!stats.isFile()) continue;
      at = stats.mtimeMs;
    } catch {
      continue;
    }

    if (best === null || at > best.at) best = { path, at };
  }

  return best === null ? { ok: false, reason: 'no-transcript' } : { ok: true, path: best.path };
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isInside(path: string, directory: string): boolean {
  const parent = resolve(directory);
  return resolve(path).startsWith(parent.endsWith(sep) ? parent : parent + sep);
}
