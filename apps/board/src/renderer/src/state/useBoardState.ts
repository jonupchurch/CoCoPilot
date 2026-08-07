import { useEffect, useState } from 'react';

import type { BoardState } from '../../../main/view.js';

/**
 * The single subscription to main. Every view reads from here.
 *
 * This is the guard against the failure the design is most exposed to: a
 * component that fetched its own copy would reintroduce polling by the back
 * door, and the whole product rests on the window never refreshing itself.
 */

export const EMPTY: BoardState = { session: null, sessionCount: 0 };

interface Bridge {
  getState(): Promise<unknown>;
  subscribe(listener: (state: unknown) => void): () => void;
}

declare global {
  interface Window {
    cocopilot?: Bridge;
  }
}

export function useBoardState(): BoardState {
  const [state, setState] = useState<BoardState>(EMPTY);

  useEffect(() => {
    const bridge = window.cocopilot;
    if (bridge === undefined) return;

    let live = true;

    // Read once. A renderer that only subscribed would show nothing until the
    // next report, which for a quiet session could be a very long time.
    void bridge.getState().then((initial) => {
      if (live) setState(initial as BoardState);
    });

    const unsubscribe = bridge.subscribe((next) => {
      setState(next as BoardState);
    });

    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  return state;
}
