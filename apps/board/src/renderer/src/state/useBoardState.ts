import { useEffect, useState } from 'react';

import type { BoardState } from '../../../main/view.js';

/**
 * The single subscription to main. Every view reads from here.
 *
 * This is the guard against the failure the design is most exposed to: a
 * component that fetched its own copy would reintroduce polling by the back
 * door, and the whole product rests on the window never refreshing itself.
 */

export const EMPTY: BoardState = {
  sessions: [],
  session: null,
  selectedKey: null,
  sessionCount: 0,
};

interface Bridge {
  getState(): Promise<unknown>;
  subscribe(listener: (state: unknown) => void): () => void;
  /**
   * The two writes, added in feature 008. Both change what this window shows or
   * holds; neither leaves the process, and no agent can observe either.
   *
   * Neither returns anything on purpose: the result arrives through
   * `subscribe`, so there is one path by which this window learns anything and
   * no second one to keep in step.
   */
  select(key: string): void;
  dismiss(key: string): void;
}

declare global {
  interface Window {
    cocopilot?: Bridge;
  }
}

/**
 * Ask main to show a different session, or to forget one.
 *
 * Free functions rather than values returned by the hook: they hold no state,
 * and a component that needs one should not also have to subscribe to the
 * board. Silent when the bridge is absent — the same posture the hook takes,
 * because a renderer running outside Electron is a test harness, not a fault.
 */
export function selectSession(key: string): void {
  window.cocopilot?.select(key);
}

export function dismissSession(key: string): void {
  window.cocopilot?.dismiss(key);
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
