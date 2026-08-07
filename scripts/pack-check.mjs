import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pack every publishable package, then install them somewhere clean.
 *
 * The only way to find out that a package does not install is to install it —
 * and the alternative to doing that here is doing it by publishing, which
 * cannot be undone. This is the rehearsal.
 *
 * It caught the real thing already: `@cocopilot/mcp` pins `@cocopilot/contract`
 * at an exact version, so installing the client alone fails with a 404 against
 * a registry that has never seen it. That is a publishing-order problem, and it
 * is invisible from inside the workspace, where npm resolves the dependency to
 * a sibling directory.
 *
 * Two installs, because they answer different questions:
 *   1. The runner — does the product install and are its binaries there?
 *   2. The client alone — is it still free of a browser runtime? (SC-003)
 */

const root = fileURLToPath(new URL('..', import.meta.url));

/** In dependency order, which is also the order a release must publish them. */
const PACKAGES = ['packages/contract', 'packages/clients', 'packages/runner'];

/**
 * npm, run through Node rather than as a command.
 *
 * `execFileSync('npm.cmd', ...)` fails with `EINVAL` on Windows: Node 20 and
 * newer refuse to spawn `.cmd` and `.bat` without a shell, and using a shell
 * would then need quoting rules that differ per platform for paths that
 * routinely contain spaces. `npm_execpath` is set by npm itself when this runs
 * as a script, and points at npm's own JavaScript entry point — so this spawns
 * Node, which is a plain executable everywhere.
 */
const npmCli = process.env['npm_execpath'];

function run(args, cwd) {
  if (npmCli === undefined) {
    throw new Error('pack-check must be run through npm, so that npm_execpath is set');
  }
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const scratch = join(tmpdir(), `cocopilot-pack-${process.pid}`);
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });

const failures = [];
const note = (message) => {
  process.stdout.write(`  ${message}\n`);
};

try {
  process.stdout.write('Packing:\n');
  const tarballs = PACKAGES.map((pkg) => {
    const out = run(['pack', '--pack-destination', scratch], join(root, pkg)).trim();
    const file = out.split('\n').at(-1) ?? '';
    note(`${pkg} -> ${file}`);
    return join(scratch, file);
  });

  /*
   * Every published package must ship build output and documentation only.
   * FR-005 and SC-005, asserted on what npm would actually put in the tarball
   * rather than on the `files` field that is supposed to control it.
   */
  process.stdout.write('\nChecking packed contents:\n');
  for (const [index, pkg] of PACKAGES.entries()) {
    const listing = JSON.parse(
      run(['pack', '--dry-run', '--json'], join(root, pkg)),
    );
    const files = (listing[0]?.files ?? []).map((entry) => entry.path.replaceAll('\\', '/'));

    const forbidden = files.filter(
      (path) =>
        /(^|\/)(src|tests?|specs?)\//u.test(path) ||
        /\.(test|spec)\.[cm]?[jt]sx?$/u.test(path) ||
        /(^|\/)tsconfig.*\.json$/u.test(path) ||
        /(^|\/)\.[^/]+rc(\.|$)/u.test(path),
    );

    if (forbidden.length > 0) {
      failures.push(`${pkg} ships files it should not: ${forbidden.join(', ')}`);
    } else {
      note(`${pkg}: ${files.length} files, no sources or tests`);
    }
    void tarballs[index];
  }

  /*
   * 1. The product, installed the way a user would get it.
   */
  process.stdout.write('\nInstalling the runner into a clean directory:\n');
  const runnerDir = join(scratch, 'install-runner');
  mkdirSync(runnerDir, { recursive: true });
  writeFileSync(join(runnerDir, 'package.json'), JSON.stringify({ name: 'x', private: true }));

  // Every tarball at once: a real registry would resolve these by name, and
  // installing them together is the closest local equivalent.
  run(['install', '--no-audit', '--no-fund', ...tarballs], runnerDir);

  const bin = join(runnerDir, 'node_modules', '.bin');
  const bins = existsSync(bin) ? readdirSync(bin) : [];
  for (const expected of ['cocopilot-board', 'cocopilot', 'cocopilot-mcp']) {
    if (bins.some((entry) => entry === expected || entry.startsWith(`${expected}.`))) {
      note(`${expected} is on the path`);
    } else {
      failures.push(`the runner install does not provide a \`${expected}\` binary`);
    }
  }

  const staged = join(runnerDir, 'node_modules', 'cocopilot-board', 'out', 'main', 'app.cjs');
  if (existsSync(staged)) note('the built application is inside the package');
  else failures.push('the runner package does not contain the built application');

  /*
   * ...and it actually starts.
   *
   * Everything above this point passed while the published command opened a
   * window onto a file-not-found: the entry was handed to Electron as a *file*
   * rather than as the package directory, so `app.getAppPath()` came back one
   * level too deep and the renderer was looked for inside `out/main/`. The
   * process stayed up, the files were all present, and only the window was
   * wrong.
   *
   * Which is the lesson: a package that installs is not a package that runs.
   */
  process.stdout.write('\nStarting the installed board:\n');
  const launcher = join(runnerDir, 'node_modules', 'cocopilot-board', 'bin', 'cocopilot-board.mjs');
  const board = spawn(process.execPath, [launcher], {
    cwd: runnerDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  });

  let said = '';
  board.stdout.on('data', (chunk) => (said += String(chunk)));
  board.stderr.on('data', (chunk) => (said += String(chunk)));

  const settled = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve('running'), 12_000);
    board.on('exit', (code) => {
      clearTimeout(timer);
      resolve(`exited ${code}`);
    });
    board.on('error', (error) => {
      clearTimeout(timer);
      resolve(`failed: ${error.message}`);
    });
  });
  board.kill();

  if (settled !== 'running') {
    failures.push(`the installed board did not stay running (${settled}): ${said.trim()}`);
  } else if (/ERR_FILE_NOT_FOUND|Failed to load URL|Cannot find module/iu.test(said)) {
    // Staying up is not enough: the window can be open and empty.
    failures.push(`the installed board started but could not load itself: ${said.trim()}`);
  } else {
    note('it starts, and loads its own window');
  }

  /*
   * 2. The client alone — the package an agent fetches. SC-003: no browser.
   */
  process.stdout.write('\nInstalling the client alone:\n');
  const clientDir = join(scratch, 'install-client');
  mkdirSync(clientDir, { recursive: true });
  writeFileSync(join(clientDir, 'package.json'), JSON.stringify({ name: 'y', private: true }));

  run(['install', '--no-audit', '--no-fund', tarballs[0], tarballs[1]], clientDir);

  const tree = readdirSync(join(clientDir, 'node_modules'));
  const heavy = tree.filter((entry) => /electron|chromium|playwright/iu.test(entry));
  if (heavy.length > 0) {
    failures.push(`the client dragged a runtime with it: ${heavy.join(', ')}`);
  } else {
    note(`no browser runtime in ${tree.length} installed packages`);
  }

  // And it still works with no board running: exit 0, said softly.
  const cli = join(clientDir, 'node_modules', '@cocopilot', 'mcp', 'dist', 'cli', 'index.js');
  try {
    const said = execFileSync(process.execPath, [cli, 'report', '--chip', 'idle'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    note(`the CLI runs with no board: ${said.trim().split('\n')[0] ?? '(silent)'}`);
  } catch (error) {
    failures.push(`the installed CLI failed with no board running: ${String(error)}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length > 0) {
  process.stderr.write(`\nFAILED:\n${failures.map((f) => `  - ${f}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('\nEvery package packs, installs and runs.\n');
