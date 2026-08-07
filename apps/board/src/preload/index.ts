import { contextBridge, ipcRenderer } from 'electron';

/**
 * The whole bridge. A wire, not a layer — there is no logic here on purpose.
 *
 * `ipcRenderer` itself is never exposed: passing it through would re-expose
 * every channel in the application to a window whose entire job is rendering
 * text an AI agent composed.
 */
const api = {
  /** Read held state once, on mount. Without this an idle session shows nothing. */
  getState: async (): Promise<unknown> => ipcRenderer.invoke('cocopilot:state'),

  /**
   * Called whenever main's store changes (decision 28). No polling anywhere.
   * Returns an unsubscribe so a remount cannot stack listeners.
   */
  subscribe: (listener: (state: unknown) => void): (() => void) => {
    const handler = (_event: unknown, state: unknown): void => {
      listener(state);
    };
    ipcRenderer.on('cocopilot:state', handler);
    return () => {
      ipcRenderer.off('cocopilot:state', handler);
    };
  },
};

contextBridge.exposeInMainWorld('cocopilot', api);

export type CoCoPilotBridge = typeof api;
