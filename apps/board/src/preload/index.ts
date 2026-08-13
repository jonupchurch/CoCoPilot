import { contextBridge, ipcRenderer } from 'electron';

/**
 * The whole bridge. A wire, not a layer — there is no logic here on purpose.
 *
 * `ipcRenderer` itself is never exposed: passing it through would re-expose
 * every channel in the application to a window whose entire job is rendering
 * text an AI agent composed.
 *
 * **Two reads and three writes as of feature 010**, where it was two reads
 * before feature 008 and two writes before this one. The writes are worth being
 * precise about, because "the renderer sends nothing" was never quite the
 * property: it was that *nothing reaches an agent*.
 *
 * `select` and `dismiss` change what this window is showing and what this board
 * holds. Neither leaves the process, neither is transmitted anywhere, and no
 * agent can observe that either happened.
 *
 * `openLink` is different in kind and the same in that respect: it does leave
 * the process — it is the only thing here that does — but it goes to the
 * operating system's URL handler, not to an agent, and no request is made by
 * this application at all. What the browser then does is the browser's.
 */
const api = {
  /** Read held state once, on mount. Without this an idle session shows nothing. */
  getState: async (): Promise<unknown> => ipcRenderer.invoke('cocoapilot:state'),

  /**
   * Show a different held session.
   *
   * Returns nothing: the new state arrives by `subscribe`, like every other
   * change, so there is one path by which this window learns anything.
   */
  select: (key: string): void => {
    ipcRenderer.send('cocoapilot:select', key);
  },

  /**
   * Clear the board's copy of one session.
   *
   * Not muting, and nothing is told: the agent goes on working and reappears
   * here the moment it reports again (decision 17).
   */
  dismiss: (key: string): void => {
    ipcRenderer.send('cocoapilot:dismiss', key);
  },

  /**
   * Open a reported address in the developer's own browser.
   *
   * Carries a URL string and nothing else, returns nothing, and is **not** a
   * promise: there is no success to await and no failure to report. The main
   * process validates it again before the operating system sees it, and drops
   * it silently if it is not an ordinary web address — so a caller cannot learn
   * from this function whether anything happened.
   */
  openLink: (url: string): void => {
    ipcRenderer.send('cocoapilot:open-link', url);
  },

  /**
   * Called whenever main's store changes (decision 28). No polling anywhere.
   * Returns an unsubscribe so a remount cannot stack listeners.
   */
  subscribe: (listener: (state: unknown) => void): (() => void) => {
    const handler = (_event: unknown, state: unknown): void => {
      listener(state);
    };
    ipcRenderer.on('cocoapilot:state', handler);
    return () => {
      ipcRenderer.off('cocoapilot:state', handler);
    };
  },
};

contextBridge.exposeInMainWorld('cocoapilot', api);

export type CoCoapilotBridge = typeof api;
