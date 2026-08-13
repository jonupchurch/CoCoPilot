import { app, ipcMain, type BrowserWindow } from 'electron';

import iconIco from '../../resources/icon.ico?asset';
import iconPng from '../../resources/icon.png?asset';
import { createService, type Service } from './index.js';
import { openLink } from './links.js';
import { TranscriptSource } from './transcript/index.js';
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
let transcripts: TranscriptSource | undefined;

async function start(): Promise<void> {
  // Normally the documented range, walked in order. `COCOAPILOT_PORT` pins it
  // instead, which is how the end-to-end suite reaches a board without either
  // guessing or colliding with one the developer already has open.
  const pinned = Number(process.env['COCOAPILOT_PORT']);
  service = await createService(Number.isInteger(pinned) ? { port: pinned } : {});
  const held = service.store;

  /*
   * Which session the window is showing.
   *
   * Window state, not stored state: no more durable than the window's size,
   * gone when the process exits (FR-020), and never written anywhere. It lives
   * here rather than in the renderer because only this process can see the
   * other sessions to project one of them -- see `toBoardState`.
   *
   * A key that is no longer held is not an error and is not cleared: the
   * projection falls back on read, so a dismissed session's key simply stops
   * matching. Storing the correction would be a second place to get it right.
   */
  let selected: string | null = null;

  // The renderer's initial read. Without it, reopening the window on a session
  // that is not currently reporting would show nothing until the next report --
  // which for an idle session could be a long time.
  ipcMain.handle('cocoapilot:state', () => toBoardState(held, selected));

  const publish = (): void => {
    // Send the whole projection rather than a delta. The board holds one
    // agent's latest word, and rebuilding it is cheap next to the alternative of
    // two places that have to agree about what changed.
    window?.webContents.send('cocoapilot:state', toBoardState(held, selected));
  };

  ipcMain.on('cocoapilot:select', (_event, key: unknown) => {
    // Validated even here. This channel is reachable only from our own window,
    // but "only our own window" is a claim about the whole renderer, and the
    // renderer's job is drawing text an agent composed.
    if (typeof key !== 'string') return;
    selected = key;
    publish();
  });

  ipcMain.on('cocoapilot:dismiss', (_event, key: unknown) => {
    if (typeof key !== 'string') return;
    // The store announces its own change, so a successful dismissal publishes
    // through the subscription below. Publishing here as well would send the
    // same state twice.
    held.dismissByKey(key);
  });

  /*
   * The third local write, and the only one that leaves the process.
   *
   * `select` and `dismiss` change what this window shows; this asks the
   * operating system to launch a browser. The validation is not here — it is in
   * `links.ts`, so that the rule and the `shell` call are one greppable unit and
   * nobody can add a second caller that skips the check. Fire-and-forget, and
   * nothing is returned: a renderer that could tell "opened" from "refused"
   * would start explaining the difference.
   */
  ipcMain.on('cocoapilot:open-link', (_event, url: unknown) => {
    openLink(url);
  });

  const appPath = app.getAppPath();
  const devServer = process.env['ELECTRON_RENDERER_URL'];

  window = createWindow({
    preload: preloadPath(appPath),
    load: devServer === undefined ? { file: rendererPath(appPath) } : { url: devServer },
    // Windows picks a size out of the `.ico` per surface — taskbar, title bar,
    // alt-tab — and scaling one PNG for all three is soft exactly where it is
    // looked at most. Everywhere else reads the PNG.
    icon: process.platform === 'win32' ? iconIco : iconPng,
  });

  /*
   * macOS ignores a window icon entirely; the dock reads the bundle's `.icns`.
   * Run through `npx` there is no bundle, so the dock would show Electron's own
   * logo — setting it at runtime is the only lever this distribution route has.
   */
  if (process.platform === 'darwin') app.dock?.setIcon(iconPng);

  // The one thing the board reads from disk. It follows only sessions the board
  // is already holding, so nothing is scanned and no other session's transcript
  // is opened (FR-016). Every failure inside it degrades three display sections
  // and touches nothing else.
  transcripts = new TranscriptSource(held);
  transcripts.start();

  held.subscribe(publish);
}

void app.whenReady().then(start);

app.on('window-all-closed', () => {
  // No macOS carve-out: this is a panel, and closing it is how you dismiss the
  // board. Nothing survives it anyway.
  app.quit();
});

app.on('will-quit', () => {
  // File watchers hold nothing open that would block a quit, but stopping is
  // still the honest counterpart to starting.
  transcripts?.stop();
  // Leaving the port held would make the next launch walk the range for no
  // reason, and a client would find a board that is not there.
  void service?.close();
});
