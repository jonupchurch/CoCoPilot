import { join } from 'node:path';

import { BrowserWindow } from 'electron';

/**
 * The one main window.
 *
 * Sized to live beside an editor, and **it never resizes itself**. Nothing in
 * this file or any other changes the window's geometry after creation: a panel
 * that resizes itself is worse than one that is slightly too small, because it
 * disturbs a workspace someone arranged deliberately.
 *
 * Geometry is also not persisted. That is consistent with holding no durable
 * state, and it is the one place that rule costs ergonomics rather than
 * correctness — if it proves annoying, reopen the decision rather than quietly
 * adding a settings file.
 */

/** Below this, no layout can honour the design. Enforced, not advisory. */
export const MIN_WIDTH = 380;
export const MIN_HEIGHT = 320;

const DEFAULT_WIDTH = 452;
const DEFAULT_HEIGHT = 760;

export interface WindowOptions {
  preload: string;
  /** A dev-server URL, or a built index.html to load from disk. */
  load: { url: string } | { file: string };
}

export function createWindow(options: WindowOptions): BrowserWindow {
  const window = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: '#0E0D0C',
    autoHideMenuBar: true,
    webPreferences: {
      preload: options.preload,
      // Not negotiable: this window renders text composed by an AI agent.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  // Nothing in this window should ever navigate or open a window. Agent text is
  // rendered as text, so a link is not supposed to exist — but if one is ever
  // introduced, it must not become a way to launch something.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  if ('url' in options.load) void window.loadURL(options.load.url);
  else void window.loadFile(options.load.file);

  return window;
}

/**
 * Where the built preload and renderer land, relative to the application root.
 *
 * Derived from `app.getAppPath()` rather than from the main bundle's own
 * location: that works identically from source and from inside a packaged asar,
 * and it does not depend on whether this file was built as CommonJS or ESM.
 */
export function preloadPath(appPath: string): string {
  return join(appPath, 'out', 'preload', 'index.cjs');
}

export function rendererPath(appPath: string): string {
  return join(appPath, 'out', 'renderer', 'index.html');
}
