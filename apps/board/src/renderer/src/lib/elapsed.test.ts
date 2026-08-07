import { describe, expect, it } from 'vitest';

import { elapsed, focusAge, heardAgo } from './elapsed.js';

const at = (ms: number): string => elapsed(0, ms);

describe('elapsed', () => {
  it('counts seconds below a minute', () => {
    expect(at(0)).toBe('0s');
    expect(at(999)).toBe('0s');
    expect(at(1_000)).toBe('1s');
    expect(at(40_000)).toBe('40s');
    expect(at(59_999)).toBe('59s');
  });

  it('counts minutes below an hour', () => {
    expect(at(60_000)).toBe('1m');
    expect(at(4 * 60_000)).toBe('4m');
    expect(at(59 * 60_000 + 59_000)).toBe('59m');
  });

  it('counts hours below a day', () => {
    expect(at(60 * 60_000)).toBe('1h');
    expect(at(2 * 60 * 60_000)).toBe('2h');
    expect(at(23 * 60 * 60_000)).toBe('23h');
  });

  it('counts days beyond that', () => {
    expect(at(24 * 60 * 60_000)).toBe('1d');
    expect(at(9 * 24 * 60 * 60_000)).toBe('9d');
  });

  it('stays a measurement at absurd durations', () => {
    // The point of the whole design: a genuinely hung agent looks exactly like a
    // slow one, and the board never decides which it is.
    const veryLong = at(400 * 24 * 60 * 60_000);

    expect(veryLong).toBe('400d');
    expect(veryLong).not.toMatch(/stall|stuck|dead|fail|idle|\?/i);
  });

  it('never goes backwards when a clock skews', () => {
    expect(elapsed(1_000, 0)).toBe('0s');
  });

  it('phrases the title bar without editorialising', () => {
    expect(heardAgo(0, 40_000)).toBe('heard 40s ago');
  });
});

describe('focusAge', () => {
  it('reads "now" for the whole first minute', () => {
    expect(focusAge(0, 0)).toBe('now');
    expect(focusAge(0, 40_000)).toBe('now');
    expect(focusAge(0, 59_999)).toBe('now');
  });

  it('counts from a minute onwards, exactly as the title bar does', () => {
    expect(focusAge(0, 60_000)).toBe('1m');
    expect(focusAge(0, 4 * 60_000)).toBe('4m');
    expect(focusAge(0, 2 * 60 * 60_000)).toBe('2h');
    expect(focusAge(0, 3 * 24 * 60 * 60_000)).toBe('3d');
  });

  it('is coarser than the title bar within that first minute', () => {
    // Liveness is watched second by second; which task is being worked on is
    // not, and a report every few seconds would make this flicker.
    expect(elapsed(0, 40_000)).toBe('40s');
    expect(focusAge(0, 40_000)).toBe('now');
  });

  it('stays a measurement at absurd durations', () => {
    expect(focusAge(0, 400 * 24 * 60 * 60_000)).toBe('400d');
  });
});
