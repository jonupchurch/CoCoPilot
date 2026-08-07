import { describe, expect, it } from 'vitest';

import { classify, isActive, isDone, SYNONYMS } from './vocabulary.js';

describe('classify — the documented set', () => {
  it('recognises every term in the table', () => {
    // Written against the table itself so a term added without a treatment
    // cannot slip through: every key must resolve to the value it claims.
    for (const [term, expected] of SYNONYMS) {
      expect(classify(term), term).toBe(expected);
    }
  });

  it('covers the four the design has treatments for', () => {
    expect(new Set(SYNONYMS.values())).toEqual(new Set(['todo', 'active', 'blocked', 'done']));
  });
});

describe('classify — case and surrounding whitespace are ignored', () => {
  it('ignores case', () => {
    expect(classify('DONE')).toBe('done');
    expect(classify('Done')).toBe('done');
    expect(classify('BlOcKeD')).toBe('blocked');
  });

  it('ignores surrounding whitespace', () => {
    expect(classify(' in progress ')).toBe('active');
    expect(classify('\tdone\n')).toBe('done');
  });

  it('ignores both at once', () => {
    expect(classify('  In Progress  ')).toBe('active');
  });
});

describe('classify — everything else is neutral', () => {
  it('leaves an unrecognised status unrecognised', () => {
    expect(classify('waiting on CI')).toBe('unrecognised');
    expect(classify('needs review')).toBe('unrecognised');
    expect(classify('deployed to staging')).toBe('unrecognised');
  });

  it('treats a near miss as unrecognised', () => {
    // The one that matters. If `donee` renders as done, matching is too loose
    // and the board is confidently wrong about work nobody finished.
    expect(classify('donee')).toBe('unrecognised');
    expect(classify('undone')).toBe('unrecognised');
    expect(classify('not done')).toBe('unrecognised');
    expect(classify('done?')).toBe('unrecognised');
    expect(classify('blocked-ish')).toBe('unrecognised');
  });

  it('does not match on a prefix, a substring or a stem', () => {
    expect(classify('do')).toBe('unrecognised');
    expect(classify('doner')).toBe('unrecognised');
    expect(classify('progress')).toBe('unrecognised');
    expect(classify('in  progress')).toBe('unrecognised');
  });

  it('treats an empty or blank status as unrecognised rather than as todo', () => {
    // Absence of a status is not a claim that nothing has started.
    expect(classify('')).toBe('unrecognised');
    expect(classify('   ')).toBe('unrecognised');
  });

  it('is not confused by a status that names a property of the lookup', () => {
    // The key is text an agent composed. A plain object would answer
    // `constructor` with something inherited and truthy, and the row would take
    // a treatment nobody chose; the lookup is a Map so these are just unknown
    // strings.
    expect(classify('constructor')).toBe('unrecognised');
    expect(classify('toString')).toBe('unrecognised');
    expect(classify('__proto__')).toBe('unrecognised');
  });
});

describe('the counting helpers', () => {
  it('counts only what it recognises as done', () => {
    expect(isDone('completed')).toBe(true);
    expect(isDone('DONE')).toBe(true);
    expect(isDone('donee')).toBe(false);
    expect(isDone('active')).toBe(false);
  });

  it('counts only what it recognises as active', () => {
    expect(isActive('wip')).toBe(true);
    expect(isActive(' in progress ')).toBe(true);
    expect(isActive('waiting on CI')).toBe(false);
  });
});
