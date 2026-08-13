import { describe, expect, it } from 'vitest';

import { resolveUnread } from './useUnread.js';

/**
 * The unread rule, driven the way the component drives it: what was remembered
 * is fed back in from the previous answer, so each test is a sequence rather
 * than a single call. A rule that is correct once and wrong on the second update
 * would pass any test that only ever called it once.
 *
 * Remembered **per session**, because that is the shape of the bug this driver
 * was rewritten to be able to express: a single carried-forward number cannot
 * tell "a note arrived" from "you are now looking at a different agent", and a
 * driver with one variable cannot tell them apart either.
 */
interface Step {
  notes: number;
  viewing: boolean;
  /** Defaults to a single session, for the cases where switching is not the point. */
  session?: string;
}

function drive(steps: readonly Step[]): boolean[] {
  const seen = new Map<string, number>();

  return steps.map((step) => {
    const key = step.session ?? 'only';
    const next = resolveUnread(seen.get(key) ?? null, step.notes, step.viewing);
    seen.set(key, next.seen);
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

  it('marks nothing on arriving at a session whose notes piled up unwatched', () => {
    /*
     * The false positive. FR-011 marks a note that arrived *for the selected
     * session* while another view was active; forty notes that accumulated in a
     * session nobody was looking at did not. The developer switching to it is
     * turning up to a full view, not being told something landed.
     *
     * A single carried-forward count gets this wrong in the most misleading
     * direction available: it announces news that is hours old, on the one
     * indicator the board has for saying an agent wants attention now.
     */
    expect(
      drive([
        { session: 'busy-elsewhere', notes: 2, viewing: true },
        { session: 'busy-elsewhere', notes: 2, viewing: false },
        { session: 'quiet-here', notes: 40, viewing: false },
      ]),
    ).toEqual([false, false, false]);
  });

  it('marks nothing on switching to a quieter session', () => {
    // The other direction, and the one feature 007 wrote a defensive line for
    // before it was reachable. Five read notes here, two unread-by-nobody
    // there: no arrival either way.
    expect(
      drive([
        { session: 'a', notes: 5, viewing: true },
        { session: 'a', notes: 5, viewing: false },
        { session: 'b', notes: 2, viewing: false },
        { session: 'b', notes: 2, viewing: false },
      ]),
    ).toEqual([false, false, false, false]);
  });

  it('marks an arrival in the session switched to, and not before', () => {
    // What makes the two tests above a rule rather than a mute button: the
    // session the developer moved to still speaks up when something new lands.
    expect(
      drive([
        { session: 'a', notes: 5, viewing: true },
        { session: 'b', notes: 40, viewing: false },
        { session: 'b', notes: 41, viewing: false },
      ]),
    ).toEqual([false, false, true]);
  });

  it('keeps each session’s memory to itself across a switch and back', () => {
    /*
     * Switching away and back must not re-announce what was already read, and
     * must not swallow what arrived in the meantime. Both sessions are driven
     * past each other so that a rule holding one number could not pass: `a`
     * ends where it started while `b` moves, and then the reverse.
     */
    expect(
      drive([
        { session: 'a', notes: 3, viewing: true },
        { session: 'b', notes: 9, viewing: false },
        { session: 'b', notes: 9, viewing: true },
        { session: 'a', notes: 3, viewing: false },
        { session: 'a', notes: 4, viewing: false },
        { session: 'b', notes: 9, viewing: false },
      ]),
    ).toEqual([false, false, false, false, true, false]);
  });

  it('does not treat the count going down as an arrival', () => {
    // Impossible within a live session — notes only append — so a drop means the
    // key was reused: dismissed, then re-created under the same repository and
    // session id. The count on screen wins over the memory.
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

  it('remembers what a first sight held, so the next note is the first mark', () => {
    // The seeding rule stated as a fact about the return value rather than only
    // as a sequence: never-seen answers "no", and hands back the count it was
    // handed, so nothing already on screen can be counted as new later.
    expect(resolveUnread(null, 40, false)).toEqual({ seen: 40, unread: false });
  });
});
