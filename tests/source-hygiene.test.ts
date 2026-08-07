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

/**
 * There is one status vocabulary, and three tabs now render it.
 *
 * `status` is free text (decision 25), so *deciding what a string means* is a
 * display decision made in exactly two places: `vocabulary.ts` decides, and
 * `StatusLabel.tsx` draws. Everywhere else asks — `isDone`, `isActive`, or the
 * components.
 *
 * The failure this forbids is cheap to write and expensive to see: a second
 * comparison in a second view, agreeing with the first on the day it is written
 * and drifting the first time a synonym is added. The symptom would be one
 * status shown two colours on two tabs, and nobody looks at two tabs at once.
 *
 * Both halves are checked — an import of the classifier, and a bare literal
 * from the table — because either one alone is a mapping this file exists to
 * prevent.
 */
const DECIDES = [
  'apps/board/src/renderer/src/lib/vocabulary.ts',
  'apps/board/src/renderer/src/components/StatusLabel.tsx',
];

describe('the status vocabulary has exactly one definition', () => {
  it('is neither restated nor re-classified outside the two files that own it', async () => {
    const terms = synonyms();
    // Guard against a vacuous pass: if the extraction below stops matching
    // because `vocabulary.ts` was reformatted, this test would quietly assert
    // nothing at all rather than fail.
    expect(terms.length).toBeGreaterThan(15);

    // Quoted literals only. Prose in this tree quotes code with backticks, so a
    // comment discussing `wip` is not an offence and does not need rewording.
    const literal = new RegExp(`['"](${terms.join('|')})['"]`, 'iu');
    const offenders: string[] = [];

    for await (const file of glob('apps/board/src/renderer/**/*.{ts,tsx}', {
      cwd: ROOT,
      exclude: [...IGNORED, '**/*.test.ts', '**/*.test.tsx'],
    })) {
      const path = file.replaceAll('\\', '/');
      if (DECIDES.includes(path)) continue;

      const source = readFileSync(`${ROOT}${file}`, 'utf8');

      const term = literal.exec(source);
      if (term !== null) offenders.push(`${path}: decides what ${term[1]} means`);

      // A named import or a call — not a bare word, which would also match the
      // transcript's unrelated `main/transcript/classify.js` in an import path.
      const imported = /import[^;]*\{[^}]*\b(classify|SYNONYMS)\b/u.test(source);
      const called = /\bclassify\s*\(/u.test(source);
      if (imported || called) offenders.push(`${path}: classifies a status itself`);
    }

    expect(offenders).toEqual([]);
  });
});

/** The synonym table's keys, read from the table rather than restated here. */
function synonyms(): string[] {
  const source = readFileSync(`${ROOT}apps/board/src/renderer/src/lib/vocabulary.ts`, 'utf8');
  const table = /new Map<string, Recognised>\(\[([\s\S]*?)\]\);/u.exec(source)?.[1] ?? '';

  return [...new Set([...table.matchAll(/'([^']+)'/gu)].map((match) => match[1] ?? ''))];
}
