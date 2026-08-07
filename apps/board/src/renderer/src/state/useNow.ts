import { useEffect, useState } from 'react';

import { TICK_MS } from '../lib/elapsed.js';

/**
 * The one permitted timer in the entire renderer, and it **fetches nothing**.
 *
 * `stacks/vite-react.md` forbids timers that refresh data, and this is the
 * exception that proves it: it re-renders state the window already has so that a
 * counter advances. It must never be allowed to grow into a refresh — the moment
 * anything here reaches for the bridge, the window has started refreshing itself
 * and decision 12 is gone.
 *
 * `apps/board/src/renderer/tests/e2e/no-timer-changes.spec.ts` is what holds
 * that line, rather than this comment.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      clearInterval(id);
    };
  }, []);

  return now;
}
