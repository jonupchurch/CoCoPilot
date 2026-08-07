import { describe, expect, it } from 'vitest';

import { resolveUnread } from './useUnread.js';

/**
 * The unread rule, driven the way the component drives it: `seen` is fed back
 * in from the previous answer, so each test is a sequence rather than a single
 * call. A rule that is correct once and wrong on the second update would pass
 * any test that only ever called it once.
 */
function drive(steps: readonly { notes: number; viewing: boolean }[]): boolean[] {
  let seen = steps[0]?.notes ?? 0;

  return steps.map((step) => {
    const next = resolveUnread(seen, step.notes, step.viewing);
    seen = next.seen;
    return next.unread;
  });
}

describe('resolveUnread', () => {
  it('marks a note that arrived while the developer was elsewhere', () => {
    expect(
      drive([
        { notes: 0, viewing: false },
        { notes: 1, viewing: false },
      ]),
    ).toEqual([false, true]);
  });

  it('marks nothing when the note arrives with the view already open', () => {
    // US3 scenario 4. A dot on the tab you are looking at is noise about
    // something you can already see.
    expect(
      drive([
        { notes: 0, viewing: true },
        { notes: 1, viewing: true },
      ]),
    ).toEqual([false, false]);
  });

  it('clears when the view is visited, and stays clear', () => {
    expect(
      drive([
        { notes: 0, viewing: false },
        { notes: 2, viewing: false },
        { notes: 2, viewing: true },
        { notes: 2, viewing: false },
      ]),
    ).toEqual([false, true, false, false]);
  });

  it('marks again when a further note arrives after a visit', () => {
    expect(
      drive([
        { notes: 1, viewing: true },
        { notes: 2, viewing: false },
        { notes: 2, viewing: true },
        { notes: 3, viewing: false },
      ]),
    ).toEqual([false, true, false, true]);
  });

  it('treats several notes arriving at once as one mark', () => {
    // Snapshots cross the bridge whole, so a burst is a single update. There is
    // no per-note state here and nothing that could count them.
    expect(
      drive([
        { notes: 0, viewing: false },
        { notes: 40, viewing: false },
      ]),
    ).toEqual([false, true]);
  });

  it('does not treat the count going down as an arrival', () => {
    // Impossible for one session — notes only append — but feature 008 makes
    // the count belong to whichever session is selected. Without this the dot
    // would appear on switching to a quieter session and never clear.
    expect(
      drive([
        { notes: 5, viewing: false },
        { notes: 2, viewing: false },
        { notes: 2, viewing: false },
      ]),
    ).toEqual([false, false, false]);
  });

  it('marks a genuine arrival after the count has dropped', () => {
    expect(
      drive([
        { notes: 5, viewing: false },
        { notes: 2, viewing: false },
        { notes: 3, viewing: false },
      ]),
    ).toEqual([false, false, true]);
  });

  it('answers a boolean and remembers a count, and never offers the difference', () => {
    // FR-012 lives here as much as in the markup: a caller that cannot obtain a
    // number cannot render one. `seen` is the rule's own memory, not a total to
    // display — the only other field is the boolean.
    const answer = resolveUnread(2, 9, false);

    expect(answer.unread).toBe(true);
    expect(Object.keys(answer).sort()).toEqual(['seen', 'unread']);
  });
});
