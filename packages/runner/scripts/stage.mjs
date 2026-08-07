import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Copy the board's build into this package, rather than building it again.
 *
 * FR-025: both distribution routes are packaged over **one** application build.
 * A second build path here would be a second thing that can differ from what
 * the installers ship, and the difference would only ever show up in whichever
 * route is tested less.
 *
 * Refuses rather than producing an empty package: `files: ["bin", "out"]` will
 * happily publish a tarball with no application in it, and that failure is
 * invisible until someone runs the published command.
 */

const board = fileURLToPath(new URL('../../../apps/board/out', import.meta.url));
const here = fileURLToPath(new URL('../out', import.meta.url));

if (!existsSync(board)) {
  process.stderr.write(
    'cocopilot-board: apps/board has not been built.\n' +
      'Run `npm run build --workspace @cocopilot/board` first — refusing to stage nothing.\n',
  );
  process.exit(1);
}

rmSync(here, { recursive: true, force: true });
cpSync(board, here, { recursive: true });

process.stdout.write(`cocopilot-board: staged ${board}\n`);
