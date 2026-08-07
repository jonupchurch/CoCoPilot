import { app, ipcMain, type BrowserWindow } from 'electron';

import { createService, type Service } from './index.js';
import { toBoardState } from './view.js';
import { createWindow, preloadPath, rendererPath } from './window.js';

/**
 * The Electron entry point: start the service, open the window, and wire the
 * one to the other in-process (decision 28).
 *
 * There is no polling anywhere. The renderer reads once on mount and is pushed
 * to thereafter, so the application does no work at all while an agent is quiet.
 */

let service: Service | undefined;
let window: BrowserWindow | undefined;

async function start(): Promise<void> {
  // Normally the documented range, walked in order. `COCOPILOT_PORT` pins it
  // instead, which is how the end-to-end suite reaches a board without either
  // guessing or colliding with one the developer already has open.
  const pinned = Number(process.env['COCOPILOT_PORT']);
  service = await createService(Number.isInteger(pinned) ? { port: pinned } : {});
  const held = service.store;

  // The renderer's initial read. Without it, reopening the window on a session
  // that is not currently reporting would show nothing until the next report --
  // which for an idle session could be a long time.
  ipcMain.handle('cocopilot:state', () => toBoardState(held));

  const appPath = app.getAppPath();
  const devServer = process.env['ELECTRON_RENDERER_URL'];

  window = createWindow({
    preload: preloadPath(appPath),
    load: devServer === undefined ? { file: rendererPath(appPath) } : { url: devServer },
  });

  held.subscribe(() => {
    // Send the whole projection rather than a delta. The board holds one
    // agent's latest word, and rebuilding it is cheap next to the alternative of
    // two places that have to agree about what changed.
    window?.webContents.send('cocopilot:state', toBoardState(held));
  });
}

void app.whenReady().then(start);

app.on('window-all-closed', () => {
  // No macOS carve-out: this is a panel, and closing it is how you dismiss the
  // board. Nothing survives it anyway.
  app.quit();
});

app.on('will-quit', () => {
  // Leaving the port held would make the next launch walk the range for no
  // reason, and a client would find a board that is not there.
  void service?.close();
});
