#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/**
 * Find Electron, hand it the bundled application, get out of the way.
 *
 * **There is deliberately no logic here beyond that.** Everything this wrapper
 * could usefully do — read a port, decide a window size, check for another
 * board — the application already does, and doing it twice would be two answers
 * to the same question. What is left is a version check, because the
 * alternative is a syntax error from inside a dependency, which is the worst
 * kind of version error there is.
 */

const REQUIRED_MAJOR = 22;

const major = Number(process.versions.node.split('.')[0]);
if (!Number.isInteger(major) || major < REQUIRED_MAJOR) {
  process.stderr.write(
    `cocopilot-board needs Node ${REQUIRED_MAJOR} or newer; this is Node ${process.versions.node}.\n` +
      `Upgrade Node and run it again — nothing was started.\n`,
  );
  process.exit(1);
}

const require = createRequire(import.meta.url);

/**
 * The Electron package exports the path to its own binary.
 *
 * Resolved rather than assumed, because where it lands differs by platform, by
 * npm version and by whether this is a hoisted install or an `npx` cache.
 */
let electron;
try {
  electron = require('electron');
} catch {
  process.stderr.write(
    'cocopilot-board could not find its Electron runtime.\n' +
      'This usually means the install did not finish — try installing again.\n',
  );
  process.exit(1);
}

if (typeof electron !== 'string') {
  process.stderr.write(
    'cocopilot-board found an Electron package that did not report a binary path.\n',
  );
  process.exit(1);
}

/**
 * The package directory, **not** the entry file.
 *
 * Electron resolves `app.getAppPath()` from what it is handed, and the
 * application builds every other path from that — the preload script and the
 * renderer's `index.html` both live at `<appPath>/out/...`. Hand it
 * `out/main/app.cjs` and `getAppPath()` becomes `out/main`, so the renderer is
 * looked for at `out/main/out/renderer/index.html` and the window opens onto a
 * file-not-found. The board still runs, which is what makes this worth a
 * comment: it fails in the renderer rather than at launch.
 *
 * So: the directory, whose `package.json` `main` points at the entry — exactly
 * how the application is launched everywhere else, including its own test
 * harness.
 */
const app = fileURLToPath(new URL('..', import.meta.url));

/*
 * `ELECTRON_RUN_AS_NODE` makes the Electron binary behave as plain Node, so the
 * built-in `electron` module is never registered and the application cannot
 * start. Some environments set it globally — inheriting it here would fail
 * every launch for a reason that has nothing to do with this product.
 */
const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;

const child = spawn(electron, [app, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  // Not `shell: true`: the resolved path can contain spaces, and a shell would
  // then need quoting rules that differ per platform.
  windowsHide: false,
});

child.on('error', (error) => {
  process.stderr.write(`cocopilot-board could not start Electron: ${error.message}\n`);
  process.exit(1);
});

// The board's exit is this command's exit, including a signal becoming a
// conventional 128+n so a shell sees what actually happened.
child.on('exit', (code, signal) => {
  if (signal !== null) process.exit(128 + (typeof signal === 'number' ? signal : 1));
  process.exit(code ?? 0);
});
