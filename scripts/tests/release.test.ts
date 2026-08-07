import { describe, expect, it } from 'vitest';

// @ts-expect-error — a plain .mjs script with no declarations, imported for its
// checks. Typing it would mean a build step for a file that exists to be run.
import { refusalsFor } from '../release.mjs';

/**
 * The refusals are the feature.
 *
 * A published version cannot be replaced and unpublishing is limited to 72
 * hours, so there is no recovering from a bad release — only a new one, with
 * the bad one still sitting there. That makes "cannot publish the wrong thing"
 * worth more than "can publish conveniently", and it is why these are tested
 * against manifests that do not exist: the real ones are correct, and a test
 * that only ever sees correct input proves nothing about refusing.
 */

/**
 * Every field optional, because the point of each test is to remove one.
 *
 * A shape that required them would be describing a correct manifest, and a
 * correct manifest is the one case these tests do not need help with.
 */
interface Manifest {
  version?: string;
  files?: string[];
  publishConfig?: { access?: string };
  scripts?: { prepublishOnly?: string };
  dependencies?: Record<string, string>;
}

const good = (): { pkg: string; manifest: Manifest }[] => [
  {
    pkg: 'packages/contract',
    manifest: {
      version: '1.0.0',
      files: ['dist'],
      publishConfig: { access: 'public' },
      scripts: { prepublishOnly: 'npm run build' },
    },
  },
  {
    pkg: 'packages/clients',
    manifest: {
      version: '1.0.0',
      files: ['dist'],
      publishConfig: { access: 'public' },
      scripts: { prepublishOnly: 'npm run build' },
      dependencies: { '@cocopilot/contract': '1.0.0', zod: '^3.0.0' },
    },
  },
];

const why = (refusals: string[]): string => refusals.join(' | ');

describe('refusalsFor', () => {
  it('allows a clean, agreeing, publishable set', () => {
    expect(refusalsFor({ dirty: '', manifests: good() })).toEqual([]);
  });

  it('refuses a dirty working tree', () => {
    // Otherwise the artefact corresponds to no commit, and nobody can ever
    // answer "what is in 1.0.0" by looking at the repository.
    const refusals = refusalsFor({ dirty: ' M src/thing.ts', manifests: good() });
    expect(why(refusals)).toMatch(/uncommitted changes/u);
  });

  it('refuses when the packages disagree about the version', () => {
    const manifests = good();
    manifests[1]!.manifest.version = '1.1.0';

    expect(why(refusalsFor({ dirty: '', manifests }))).toMatch(/disagree about the version/u);
  });

  it('refuses a pin that names a version other than the one being released', () => {
    // The nastier cousin of a version disagreement: every manifest says 1.0.0
    // and the client asks for a contract that will not exist. Inside the
    // workspace it resolves to a sibling directory and looks fine.
    const manifests = good();
    manifests[1]!.manifest.dependencies!['@cocopilot/contract'] = '0.9.0';

    expect(why(refusalsFor({ dirty: '', manifests }))).toMatch(
      /pins @cocopilot\/contract at 0\.9\.0, but the release is 1\.0\.0/u,
    );
  });

  it('ignores third-party pins, which have nothing to do with our versions', () => {
    const manifests = good();
    manifests[1]!.manifest.dependencies!['zod'] = '^3.24.1';

    expect(refusalsFor({ dirty: '', manifests })).toEqual([]);
  });

  it('refuses a scoped package that would publish as private', () => {
    // The failure this prevents arrives as a billing error rather than a
    // configuration one, which is why it is worth catching before the attempt.
    const manifests = good();
    delete manifests[0]!.manifest.publishConfig;

    expect(why(refusalsFor({ dirty: '', manifests }))).toMatch(/access = "public"/u);
  });

  it('refuses a package that could ship a stale dist', () => {
    const manifests = good();
    delete manifests[1]!.manifest.scripts!.prepublishOnly;

    expect(why(refusalsFor({ dirty: '', manifests }))).toMatch(/prepublishOnly/u);
  });

  it('refuses a package that does not restrict what it ships', () => {
    const manifests = good();
    manifests[0]!.manifest.files = [];

    expect(why(refusalsFor({ dirty: '', manifests }))).toMatch(/"files" list/u);
  });

  it('reports every reason at once rather than the first', () => {
    // A release is prepared rarely and fixed in a batch; reporting one problem
    // per attempt turns one round trip into five.
    const manifests = good();
    manifests[1]!.manifest.version = '2.0.0';
    delete manifests[0]!.manifest.publishConfig;

    expect(refusalsFor({ dirty: ' M x', manifests }).length).toBeGreaterThanOrEqual(3);
  });
});
