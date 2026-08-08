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
 * Refuses rather than producing an empty package: `files` will happily publish
 * a tarball with no application in it, and that failure is invisible until
 * someone runs the published command.
 *
 * **Two directories, not one.** `resources/` is not decoration: electron-vite
 * compiles an `?asset` import to `path.join(__dirname, '../../resources/...')`
 * — it rewrites the path but never copies the file, trusting `resources/` to
 * sit beside `out/` at the application root. Staging `out/` alone therefore
 * produces a package that runs perfectly and shows Electron's own logo in the
 * taskbar, because a missing icon path is something Electron ignores in
 * silence. Same lesson as the renderer path before it: the failure is in what
 * you see, not in whether it starts.
 */

const sources = [
  { name: 'out', from: '../../../apps/board/out', to: '../out' },
  { name: 'resources', from: '../../../apps/board/resources', to: '../resources' },
];

for (const { name, from, to } of sources) {
  const source = fileURLToPath(new URL(from, import.meta.url));
  const destination = fileURLToPath(new URL(to, import.meta.url));

  if (!existsSync(source)) {
    process.stderr.write(
      `cocoapilot: apps/board has no ${name}/.\n` +
        (name === 'out'
          ? 'Run `npm run build --workspace @cocoapilot/board` first — refusing to stage nothing.\n'
          : 'Run `node scripts/build-icons.mjs` first — refusing to stage an iconless package.\n'),
    );
    process.exit(1);
  }

  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });

  process.stdout.write(`cocoapilot: staged ${source}\n`);
}
