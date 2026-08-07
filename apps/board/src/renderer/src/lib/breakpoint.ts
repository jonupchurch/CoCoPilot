import { useEffect, useState } from 'react';

/**
 * One width, two different answers to it.
 *
 * 640px, from the design round. Both detail views share the number and diverge
 * in what they do below it — Stories collapses its list into a picker, Tasks
 * stacks its list above the detail — because their lists are different shapes:
 * a story row is several lines and would push the detail off a narrow panel,
 * while a story's task list is a handful of single rows and stacks for nothing.
 *
 * The number lives here rather than in a media query in each stylesheet so that
 * the CSS and the component agree by construction. A layout that flips in CSS at
 * one width while the component's state flips at another is a bug you find by
 * dragging the window slowly.
 */

/** FR-010 says "at or above", so the boundary itself is the wide arrangement. */
export const BREAKPOINT = 640;

const QUERY = `(max-width: ${BREAKPOINT - 1}px)`;

export function isNarrow(width: number): boolean {
  return width < BREAKPOINT;
}

/**
 * Whether the window is currently in the narrow arrangement.
 *
 * `matchMedia` rather than a resize listener: the browser fires this only when
 * the answer actually changes, so dragging a window across 200 pixels costs one
 * render rather than two hundred. Nothing here polls, and nothing measures on a
 * timer — same rule as everything else on this board.
 */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(QUERY);
    const onChange = (event: MediaQueryListEvent): void => {
      setNarrow(event.matches);
    };

    // Re-read on subscribe: the width can have changed between the initial
    // state and this effect running, and the listener only reports transitions.
    setNarrow(query.matches);
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  return narrow;
}
