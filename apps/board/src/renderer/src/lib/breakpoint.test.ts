import { describe, expect, it } from 'vitest';

import { BREAKPOINT, isNarrow } from './breakpoint.js';

/**
 * `useIsNarrow` itself is exercised end-to-end, where a real window is resized
 * across the boundary — a jsdom `matchMedia` stub would only prove the stub
 * works. What is worth pinning here is the boundary condition, which is stated
 * in FR-010 as "at or above" and is exactly the kind of thing that silently
 * becomes off-by-one.
 */
describe('the breakpoint', () => {
  it('is 640, the number the design round chose', () => {
    expect(BREAKPOINT).toBe(640);
  });

  it('counts the boundary itself as wide', () => {
    // FR-010: list and detail side by side "at or above a defined width".
    expect(isNarrow(BREAKPOINT)).toBe(false);
    expect(isNarrow(BREAKPOINT - 1)).toBe(true);
  });

  it('holds at the extremes', () => {
    expect(isNarrow(0)).toBe(true);
    expect(isNarrow(320)).toBe(true);
    expect(isNarrow(1_920)).toBe(false);
  });
});
