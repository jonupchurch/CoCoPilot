/**
 * The shared vocabulary of the two absence tests.
 *
 * `no-filesystem.test.ts` proves the *service* touches the filesystem once;
 * `transcript-containment.test.ts` proves the *reader* touches exactly one file.
 * Both work by wrapping `node:fs`, and both need the same answer to "is this
 * call a write?" and "which of these arguments is a path?".
 *
 * Kept in one place because the list below is an allowlist in the security
 * sense: two copies of it, one updated and one not, is precisely the way a guard
 * stops guarding without anyone noticing. The recorder itself stays in each test
 * file, because `vi.mock` is per-file and its factory has to be hoisted there.
 */

export interface FsCall {
  module: string;
  fn: string;
  args: unknown[];
}

/**
 * Anything that changes the filesystem. Listed by name rather than by pattern so
 * that adding a call the list does not know about fails loudly.
 */
export const WRITE_APIS: ReadonlySet<string> = new Set([
  'appendFile',
  'appendFileSync',
  'chmod',
  'chmodSync',
  'chown',
  'chownSync',
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
  'createWriteStream',
  'link',
  'linkSync',
  'mkdir',
  'mkdirSync',
  'mkdtemp',
  'mkdtempSync',
  'rename',
  'renameSync',
  'rm',
  'rmSync',
  'rmdir',
  'rmdirSync',
  'symlink',
  'symlinkSync',
  'truncate',
  'truncateSync',
  'unlink',
  'unlinkSync',
  'utimes',
  'utimesSync',
  'write',
  'writeFile',
  'writeFileSync',
  'writeSync',
  'writev',
  'writevSync',
]);

/**
 * Both separators are valid on Windows, and case is not significant there
 * either. Comparing raw strings would let a read of the very same file slip past
 * for writing `repo + '/tasks.md'` instead of `join(repo, 'tasks.md')`.
 */
export function normalise(value: string): string {
  return value.replaceAll('\\', '/').toLowerCase();
}

/** The `fs` calls whose *second* argument is also a path rather than data. */
const TWO_PATH_APIS: ReadonlySet<string> = new Set([
  'copyFile',
  'copyFileSync',
  'cp',
  'cpSync',
  'link',
  'linkSync',
  'rename',
  'renameSync',
  'symlink',
  'symlinkSync',
]);

/**
 * Every argument that names a path, pulled out of a recorded call.
 *
 * Positional rather than a walk over all arguments, and that is a correction:
 * walking everything worked while nothing in the product opened a file, then
 * started reporting `'r'` (an open flag) and whole file contents (a `readSync`
 * buffer) as paths the moment the transcript reader arrived.
 *
 * The rule is small and exact. A call whose first argument is a number is
 * descriptor-based — `readSync`, `closeSync` — and names nothing. Otherwise the
 * path is the first argument, plus the second for the handful of APIs that take
 * two. Everything after that is data, flags or options.
 */
export function pathish(call: FsCall): string[] {
  if (typeof call.args[0] === 'number') return [];

  const limit = TWO_PATH_APIS.has(call.fn) ? 2 : 1;
  const found: string[] = [];
  for (const value of call.args.slice(0, limit)) {
    if (typeof value === 'string') found.push(value);
    else if (value instanceof URL) found.push(value.pathname);
    else if (Buffer.isBuffer(value)) found.push(value.toString('utf8'));
  }
  return found;
}

/**
 * Wrap a module's function exports so every call is recorded and then passed
 * straight through. Nothing is stubbed: these tests assert what the real code
 * really did, so the real filesystem has to be underneath.
 */
export function recordInto(
  calls: FsCall[],
  moduleName: string,
  actual: Record<string, unknown>,
): Record<string, unknown> {
  const wrapped: Record<string, unknown> = {};
  for (const key of Object.keys(actual)) {
    const value = actual[key];
    wrapped[key] =
      typeof value === 'function'
        ? (...args: unknown[]): unknown => {
            calls.push({ module: moduleName, fn: key, args });
            return (value as (...a: unknown[]) => unknown)(...args);
          }
        : value;
  }
  wrapped['default'] = wrapped;
  return wrapped;
}
