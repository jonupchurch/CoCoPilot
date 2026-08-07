import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BOARD_ABSENT, versionMismatch } from '../../src/messages.js';

const root = join(import.meta.dirname, '..', '..');

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  name: string;
  bin: Record<string, string>;
  files: string[];
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

// Normalised, because git may check this file out with CRLF. A test that reads
// a tracked file and then matches on `\n` passes on the machine that wrote it
// and fails on the next checkout.
const readme = readFileSync(join(root, 'README.md'), 'utf8').replaceAll('\r\n', '\n');

/**
 * Decision 27: the spawnable piece ships as JavaScript fetched by npx, which is
 * what takes it out of the desktop application's code-signing and notarization
 * story entirely. That only holds if the package genuinely stands alone.
 */
describe('the published package', () => {
  it('is the name the documented configuration entry fetches', () => {
    expect(manifest.name).toBe('@cocoapilot/mcp');
    expect(readme).toContain('"@cocoapilot/mcp"');
  });

  it('declares both binaries', () => {
    expect(Object.keys(manifest.bin).sort()).toEqual(['cocoapilot', 'cocoapilot-mcp']);
  });

  it('ships only build output', () => {
    expect(manifest.files).toEqual(['dist']);
  });

  it('does not drag the desktop application into its dependency tree', () => {
    // `@cocoapilot/board` exists here only so integration tests can run a real
    // service. A consumer installing from npm must never receive it.
    expect(Object.keys(manifest.dependencies)).not.toContain('@cocoapilot/board');
    expect(Object.keys(manifest.devDependencies)).toContain('@cocoapilot/board');
  });

  it('depends on nothing that could pull in Electron', () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@cocoapilot/contract',
      '@modelcontextprotocol/sdk',
      'zod',
    ]);
  });
});

describe('the documented configuration entry', () => {
  it('names no filesystem path to the desktop application', () => {
    const config = /```json\n([\s\S]*?)```/.exec(readme)?.[1] ?? '';

    expect(config).toContain('npx');
    expect(config).not.toMatch(/[A-Za-z]:\\/); // a Windows path
    expect(config).not.toMatch(/\/(usr|opt|Applications|home)\//); // a POSIX one
    expect(config).not.toMatch(/\.exe|\.app\b/);
  });

  it('is one entry that works unchanged on all three platforms', () => {
    expect(readme).toMatch(/same on Windows, macOS and Linux/i);
  });

  it('states the two things an agent cannot infer', () => {
    expect(readme).toMatch(/only.*way to ask for a human/i);
    expect(readme).toMatch(/cleared when the board window closes/i);
  });

  it('quotes the board-absent message the clients actually return', () => {
    expect(readme).toContain(BOARD_ABSENT);
  });
});

/**
 * Every package that will be published, checked as a set.
 *
 * Read from disk rather than imported, because what matters is what npm will
 * see. The three are not equals: `contract` exists so two others can agree,
 * `clients` is what an agent fetches and must stay runtime-free, and `runner`
 * is what a human fetches and is allowed to be large.
 */
const PUBLISHED = ['contract', 'clients', 'runner'].map((name) => {
  const path = join(root, '..', name, 'package.json');
  return {
    name,
    manifest: JSON.parse(readFileSync(path, 'utf8')) as {
      name: string;
      version: string;
      files?: string[];
      publishConfig?: { access?: string };
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      engines?: Record<string, string>;
      bin?: Record<string, string>;
    },
  };
});

describe('every published package can actually be published', () => {
  it('declares public access, without which a scoped publish is a billing error', () => {
    // The most common first-publish failure there is: a scoped package defaults
    // to *restricted*, so `npm publish` fails asking for a paid plan rather
    // than saying anything about configuration.
    for (const { name, manifest } of PUBLISHED) {
      expect(manifest.publishConfig?.access, name).toBe('public');
    }
  });

  it('builds on prepublishOnly, so a stale or absent dist cannot ship', () => {
    // `files` ships whatever is on disk, including nothing at all.
    for (const { name, manifest } of PUBLISHED) {
      expect(typeof manifest.scripts?.prepublishOnly, name).toBe('string');
    }
  });

  it('restricts what it ships, and agrees on a version', () => {
    for (const { name, manifest } of PUBLISHED) {
      expect(manifest.files?.length ?? 0, name).toBeGreaterThan(0);
    }

    // The client pins the contract *exactly*, so a drift is a 404 at install
    // time rather than a warning.
    expect(new Set(PUBLISHED.map((p) => p.manifest.version)).size).toBe(1);
  });
});

describe('the runner carries the product, and the client stays out of it', () => {
  const runner = PUBLISHED.find((p) => p.name === 'runner')?.manifest;

  it('declares Electron as a real dependency, which is why it is its own package', () => {
    // `electron-builder` requires Electron in devDependencies because it
    // bundles the runtime itself; this route requires the opposite so that
    // `npm install` fetches it. One manifest cannot be both.
    expect(Object.keys(runner?.dependencies ?? {}).sort()).toEqual([
      '@cocoapilot/mcp',
      'electron',
    ]);
    expect(runner?.bin?.['cocoapilot-board']).toBe('bin/cocoapilot-board.mjs');
    expect(runner?.engines?.['node']).toBeTruthy();
  });

  it('keeps the arrow pointing one way', () => {
    // The runner depends on the client. The moment that reverses, an agent
    // starts downloading a browser in order to report a task.
    expect(Object.keys(manifest.dependencies)).not.toContain('cocoapilot-board');
    expect(Object.keys(manifest.devDependencies)).not.toContain('cocoapilot-board');
  });
});

describe('version drift', () => {
  it('names both sides, so a mismatch is fixable rather than merely confusing', () => {
    const message = versionMismatch('v1', 'v9');

    expect(message).toContain('v1');
    expect(message).toContain('v9');
    expect(message).toMatch(/nothing was sent/i);
    expect(message).toMatch(/no need to retry/i);
  });
});
