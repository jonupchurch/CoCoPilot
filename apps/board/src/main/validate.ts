import { statSync } from 'node:fs';

import { rejection, type Rejection } from '@cocopilot/contract';

/**
 * Confirm the reported repository path exists — and stop there.
 *
 * This is the *only* filesystem call the service makes, and it touches the path
 * itself and nothing beneath it: no `readdir`, no open, no traversal, no git.
 * CoCoPilot never reads the user's repository (decision 24), which is why there
 * is no `tasks.md` parser, no `specs/` walk and no file watcher anywhere in this
 * codebase — the agent pushes all of it.
 *
 * Deliberately lives here rather than in `packages/contract`, so the published
 * client package never imports `node:fs` and the absence tests covering SC-004
 * and SC-005 have exactly one call site to account for.
 */
export function validateRepoPath(repo: string): Rejection | null {
  try {
    statSync(repo);
    return null;
  } catch {
    // Existence only. The service forms no opinion about the contents, because
    // it never looks at them — a path that exists but is not a working tree is
    // perfectly acceptable.
    return rejection('invalid_field', 'repo', 'path does not exist');
  }
}
