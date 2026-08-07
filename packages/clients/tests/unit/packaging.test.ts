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

const readme = readFileSync(join(root, 'README.md'), 'utf8');

/**
 * Decision 27: the spawnable piece ships as JavaScript fetched by npx, which is
 * what takes it out of the desktop application's code-signing and notarization
 * story entirely. That only holds if the package genuinely stands alone.
 */
describe('the published package', () => {
  it('is the name the documented configuration entry fetches', () => {
    expect(manifest.name).toBe('@cocopilot/mcp');
    expect(readme).toContain('"@cocopilot/mcp"');
  });

  it('declares both binaries', () => {
    expect(Object.keys(manifest.bin).sort()).toEqual(['cocopilot', 'cocopilot-mcp']);
  });

  it('ships only build output', () => {
    expect(manifest.files).toEqual(['dist']);
  });

  it('does not drag the desktop application into its dependency tree', () => {
    // `@cocopilot/board` exists here only so integration tests can run a real
    // service. A consumer installing from npm must never receive it.
    expect(Object.keys(manifest.dependencies)).not.toContain('@cocopilot/board');
    expect(Object.keys(manifest.devDependencies)).toContain('@cocopilot/board');
  });

  it('depends on nothing that could pull in Electron', () => {
    expect(Object.keys(manifest.dependencies).sort()).toEqual([
      '@cocopilot/contract',
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

describe('version drift', () => {
  it('names both sides, so a mismatch is fixable rather than merely confusing', () => {
    const message = versionMismatch('v1', 'v9');

    expect(message).toContain('v1');
    expect(message).toContain('v9');
    expect(message).toMatch(/nothing was sent/i);
    expect(message).toMatch(/no need to retry/i);
  });
});
