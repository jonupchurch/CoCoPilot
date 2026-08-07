import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { glob } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * Repo-wide checks that belong to no single package.
 *
 * This exists because the failure below has now happened twice here, and it is
 * close to invisible both times: a control character lands inside a string
 * literal, every editor renders it as a space, and the only symptom is that git
 * starts calling the file **binary** — so `git diff` silently stops showing that
 * file's changes to every reviewer from then on. A test is the only thing that
 * catches it, because reading the file cannot.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const IGNORED = [
  '**/node_modules/**',
  '**/out/**',
  '**/dist/**',
  '**/.git/**',
  '**/test-results/**',
  '**/playwright-report/**',
  // Design exports, which are generated artefacts rather than source.
  'resources/**',
];

describe('source files contain no control characters', () => {
  it('has no NUL byte in any tracked source or document', async () => {
    const offenders: string[] = [];

    for await (const file of glob('**/*.{ts,tsx,css,md,json,html,js,cjs,mjs,yml,ps1,sh}', {
      cwd: ROOT,
      exclude: IGNORED,
    })) {
      // Read as bytes: a NUL survives a UTF-8 decode and would be missed by any
      // comparison that went through a string the terminal had already eaten.
      if (readFileSync(`${ROOT}${file}`).includes(0)) offenders.push(file);
    }

    // Write `\0`, not the character. If a separator genuinely needs to be NUL —
    // `store.ts` builds session keys that way — the escape is the thing that
    // belongs in source.
    expect(offenders).toEqual([]);
  });
});

/**
 * The renderer is a window that draws text an AI agent composed, and the main
 * process is the one with a filesystem, a listening socket and the transcript
 * reader. The wall between them is `apps/board/src/preload`, and it holds only
 * as long as nothing steps around it.
 *
 * A type is fine — it is erased before the bundle exists. A *value* imported
 * from `main/` would pull that module and its `node:` dependencies into the
 * renderer graph, and the first symptom would be a build error somewhere else
 * entirely. The electron stack pack asks for this to be verified; verifying it
 * once by hand is how it stops being true three features later.
 */
describe('the renderer never reaches into the main process', () => {
  it('imports from main as types only, and never imports node:', async () => {
    const offenders: string[] = [];

    for await (const file of glob('apps/board/src/renderer/**/*.{ts,tsx}', {
      cwd: ROOT,
      exclude: IGNORED,
    })) {
      const source = readFileSync(`${ROOT}${file}`, 'utf8');

      for (const match of source.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)'/gmu)) {
        const [, typeOnly, specifier] = match;
        if (specifier === undefined) continue;

        if (specifier.startsWith('node:')) {
          offenders.push(`${file}: imports ${specifier}`);
        }
        if (/(^|\/)main\//u.test(specifier) && typeOnly === undefined) {
          offenders.push(`${file}: imports a value from ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
