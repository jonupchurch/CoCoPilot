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
const refusals = [];

function manifest(pkg) {
  return JSON.parse(readFileSync(join(root, pkg, 'package.json'), 'utf8'));
}

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

// ---------------------------------------------------------------- the checks

/*
 * A dirty tree means the artefact does not correspond to any commit, so nobody
 * can ever answer "what is in 0.2.0" by looking at the repository.
 */
const dirty = git('status', '--porcelain');
if (dirty !== '') {
  refusals.push(`the working tree has uncommitted changes:\n${dirty}`);
}

/*
 * Versions must agree across everything published together (FR-013), because
 * the client pins the contract *exactly*: a drift is not a warning at install
 * time, it is a 404.
 */
const versions = new Map(PACKAGES.map((pkg) => [pkg, manifest(pkg).version]));
const distinct = new Set(versions.values());
if (distinct.size !== 1) {
  refusals.push(
    `the packages disagree about the version:\n${[...versions]
      .map(([pkg, version]) => `    ${pkg}: ${version}`)
      .join('\n')}`,
  );
}

/*
 * And the pins between them must name the version actually being released,
 * rather than one that happens to still resolve inside the workspace.
 */
const version = versions.get('packages/contract');
const clientPin = manifest('packages/clients').dependencies?.['@cocopilot/contract'];
const runnerPin = manifest('packages/runner').dependencies?.['@cocopilot/mcp'];

if (clientPin !== version) {
  refusals.push(`the client pins contract ${String(clientPin)}, but the release is ${version}`);
}
if (runnerPin !== version) {
  refusals.push(`the runner pins the client ${String(runnerPin)}, but the release is ${version}`);
}

/*
 * Every published manifest must be publishable at all. `access: public` is the
 * one that bites: a scoped package defaults to restricted, and the failure
 * arrives as a billing error rather than a configuration one.
 */
for (const pkg of PACKAGES) {
  const m = manifest(pkg);
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
execFileSync(process.execPath, [String(npmCli), 'run', 'build', '--workspace', 'cocopilot-board'], {
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
