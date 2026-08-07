import { createServer } from 'node:net';
import { resolve } from 'node:path';
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

export async function launchBoard(): Promise<Board> {
  const port = await freePort();

  // `ELECTRON_RUN_AS_NODE` makes electron.exe behave as plain Node, so the
  // built-in `electron` module is never registered and the app cannot start.
  // Some environments set it globally; inheriting it here would fail every test
  // for a reason that has nothing to do with the code.
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env;

  const app = await electron.launch({
    args: [APP],
    env: { ...env, COCOPILOT_PORT: String(port) } as Record<string, string>,
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

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
