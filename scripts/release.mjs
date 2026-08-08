import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Prepare a release, and refuse to prepare a bad one.
 *
 * **The refusals are the feature.** A published version cannot be replaced and
 * unpublishing is time-limited, so there is no recovering from a bad release —
 * only a new one, with the bad one still sitting there. That inverts the usual
 * design: this script is not trying to be convenient, it is trying to make the
 * wrong thing hard.
 *
 * It does not publish. It prints the commands, in the only order that works.
 * The publish is a human's to run, with an account this repository does not
 * have and cannot check.
 *
 *   node scripts/release.mjs           # check everything, print the plan
 *   node scripts/release.mjs --publish # print the plan with nothing withheld
 *
 * Even `--publish` only prints: it is a flag about how loudly to say "you are
 * about to do something permanent", not a flag that does it.
 */

const root = fileURLToPath(new URL('..', import.meta.url));

/** Dependency order. Publishing out of it leaves a package pointing at nothing. */
const PACKAGES = ['packages/contract', 'packages/clients', 'packages/runner'];

const npmCli = process.env['npm_execpath'];

function manifest(pkg) {
  return JSON.parse(readFileSync(join(root, pkg, 'package.json'), 'utf8'));
}

/**
 * Every reason not to release, as a pure function of what is on disk.
 *
 * Separated from the script so the refusals can be tested against manifests
 * that do not exist — which is the only way to test them, since the real ones
 * are (and must stay) correct. The refusals *are* the feature here: a published
 * version cannot be replaced, so being unable to publish the wrong thing is
 * worth more than being able to publish conveniently.
 *
 * @param {{ dirty: string, manifests: {pkg: string, manifest: any}[] }} state
 * @returns {string[]} human-readable reasons, empty when a release may proceed
 */
export function refusalsFor({ dirty, manifests }) {
  const refusals = [];

  // A dirty tree means the artefact corresponds to no commit, so nobody can
  // ever answer "what is in 0.2.0" by looking at the repository.
  if (dirty !== '') refusals.push(`the working tree has uncommitted changes:\n${dirty}`);

  // Versions must agree across everything published together (FR-013): the
  // client pins the contract exactly, so a drift is a 404 rather than a warning.
  const versions = new Map(manifests.map(({ pkg, manifest: m }) => [pkg, m.version]));
  if (new Set(versions.values()).size !== 1) {
    refusals.push(
      `the packages disagree about the version:\n${[...versions]
        .map(([pkg, version]) => `    ${pkg}: ${version}`)
        .join('\n')}`,
    );
  }

  // ...and the pins between them must name the version actually being
  // released, rather than one that happens to still resolve to a sibling
  // directory inside the workspace.
  const version = manifests[0]?.manifest.version;
  for (const { pkg, manifest: m } of manifests) {
    for (const [dep, range] of Object.entries(m.dependencies ?? {})) {
      if (!dep.startsWith('@cocoapilot/') && !dep.startsWith('cocoapilot-')) continue;
      if (range !== version) {
        refusals.push(`${pkg} pins ${dep} at ${range}, but the release is ${version}`);
      }
    }
  }

  for (const { pkg, manifest: m } of manifests) {
    if (m.publishConfig?.access !== 'public') {
      refusals.push(`${pkg} does not declare publishConfig.access = "public"`);
    }
    if (typeof m.scripts?.prepublishOnly !== 'string') {
      refusals.push(`${pkg} has no prepublishOnly build, so it could ship a stale dist`);
    }
    if (!Array.isArray(m.files) || m.files.length === 0) {
      refusals.push(`${pkg} does not restrict what it ships with a "files" list`);
    }
  }

  return refusals;
}

/** Run only when invoked directly, so the checks above can be imported. */
if (process.argv[1] !== fileURLToPath(import.meta.url)) {
  // Imported for testing; do nothing.
} else {
  main();
}

function main() {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

  // -------------------------------------------------------------- the checks

  const manifests = PACKAGES.map((pkg) => ({ pkg, manifest: manifest(pkg) }));
  const version = manifests[0].manifest.version;
  const refusals = refusalsFor({ dirty: git('status', '--porcelain'), manifests });

  if (refusals.length > 0) {
    process.stderr.write(
      `Refusing to release.\n\n${refusals.map((r) => `  - ${r}`).join('\n\n')}\n\n` +
        'Nothing was built and nothing was published.\n',
    );
    process.exit(1);
  }

  // -------------------------------------------------------- build and rehearse

  process.stdout.write(`Releasing ${version}\n\nBuilding from scratch:\n`);

  /*
   * Built here rather than trusted: `prepublishOnly` protects the real publish,
   * but the pack-check below is only meaningful against output that matches the
   * commit this script just verified is clean.
   */
  execFileSync(process.execPath, [String(npmCli), 'run', 'build'], { cwd: root, stdio: 'inherit' });
  execFileSync(process.execPath, [String(npmCli), 'run', 'build', '--workspace', 'cocoapilot'], {
    cwd: root,
    stdio: 'inherit',
  });

  process.stdout.write('\nRehearsing the install:\n');
  execFileSync(process.execPath, [String(npmCli), 'run', 'pack:check'], {
    cwd: root,
    stdio: 'inherit',
  });

  // ------------------------------------------------------------------ the plan

  const publishing = process.argv.includes('--publish');

  process.stdout.write(
    `\n${'='.repeat(70)}\n` +
      `Ready to publish ${version}. Run these in this order — each depends on the\n` +
      `one before it being on the registry:\n\n` +
      PACKAGES.map((pkg) => `    npm publish -w ${pkg}`).join('\n') +
      `\n\n${
        publishing
          ? 'This script does not publish, even with --publish. A published version\n' +
            'cannot be replaced, and unpublishing is limited to 72 hours — so the\n' +
            'irreversible step stays a human one, run deliberately.\n'
          : 'Run with --publish for the same plan and a note about what it costs.\n'
      }` +
      `${'='.repeat(70)}\n`,
  );
}
