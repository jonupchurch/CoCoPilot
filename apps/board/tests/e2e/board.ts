import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

/**
 * Launch the built board on a port of our own choosing, so the suite never
 * fights a board the developer already has open on 41847.
 */

/**
 * The application directory, so Electron reads `main` from its package.json.
 *
 * `resolve` rather than `fileURLToPath(new URL('../..'))`: the URL form keeps a
 * trailing separator, and on Windows a trailing backslash escapes the closing
 * quote when the argument is passed to the process — Electron then receives a
 * path with a stray `"` on the end and refuses to start.
 */
const APP = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

export interface Board {
  app: ElectronApplication;
  page: Page;
  port: number;
  /** Report as an agent would, over the same HTTP contract the clients use. */
  push(body: Record<string, unknown>): Promise<number>;
  note(body: Record<string, unknown>): Promise<number>;
  close(): Promise<void>;
}

export interface LaunchOptions {
  /**
   * Where the board should look for `.claude/projects`.
   *
   * Without it the board would read the developer's own transcripts while the
   * suite runs — their real prompts on screen, and a test whose result depends
   * on what they happened to be doing.
   */
  home?: string | undefined;
}

export async function launchBoard(options: LaunchOptions = {}): Promise<Board> {
  const port = await freePort();

  // `ELECTRON_RUN_AS_NODE` makes electron.exe behave as plain Node, so the
  // built-in `electron` module is never registered and the app cannot start.
  // Some environments set it globally; inheriting it here would fail every test
  // for a reason that has nothing to do with the code.
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;

  const app = await electron.launch({
    args: [APP],
    env: {
      ...env,
      COCOPILOT_PORT: String(port),
      // Always set, even when a test does not care: an unset value would send
      // the reader to the real home directory.
      COCOPILOT_HOME: options.home ?? join(APP, 'tests', 'fixtures', 'empty-home'),
    } as Record<string, string>,
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await moveOffPrimary(app);

  const send = async (path: string, body: Record<string, unknown>): Promise<number> => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.status;
  };

  return {
    app,
    page,
    port,
    push: (body) => send('/v1/push', body),
    note: (body) => send('/v1/note', body),
    close: () => app.close(),
  };
}

/** An envelope pointing at a directory that certainly exists. */
export function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    repo: process.cwd(),
    branch: 'feat/session-hook',
    sessionId: 'e2e',
    ...overrides,
  };
}

/**
 * Put the test window on a secondary display when one exists.
 *
 * The suite launches and closes a window per test, so a full run flashes fifty
 * windows over whatever the developer is reading. This moves them out of the
 * way rather than changing what the product does: feature 003 holds that the
 * window belongs to the developer, and the app deciding its own display would
 * be exactly the behaviour `inert-and-layout.spec.ts` exists to forbid. The
 * placement lives here, in the harness, for that reason.
 *
 * Size is untouched -- only the origin moves -- and on a single-display machine
 * (CI, most laptops) this does nothing at all. Set `COCOPILOT_E2E_PRIMARY=1` to
 * keep the window where it would otherwise land.
 */
async function moveOffPrimary(app: ElectronApplication): Promise<void> {
  if (process.env['COCOPILOT_E2E_PRIMARY'] === '1') return;

  await app.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window === undefined) return;

    const primary = screen.getPrimaryDisplay();
    const other = screen.getAllDisplays().find((display) => display.id !== primary.id);
    if (other === undefined) return;

    const bounds = window.getBounds();
    window.setBounds({
      ...bounds,
      x: other.workArea.x + 40,
      y: other.workArea.y + 40,
    });
  });
}

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = probe.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      probe.close(() => {
        resolve(port);
      });
    });
  });
}
