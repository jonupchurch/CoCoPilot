import { defineConfig } from '@playwright/test';

/**
 * End-to-end against the built Electron app.
 *
 * No web server: the app is the thing under test, launched per spec file from
 * `apps/board/out`. Run `npm run build --workspace @cocopilot/board` first —
 * testing the dev server would test a different artefact from the one that
 * ships.
 */
export default defineConfig({
  testDir: './apps/board/tests/e2e',
  fullyParallel: false,
  workers: 1,
  // A launch failure shows a modal dialog per attempt. Stopping after a few
  // means a broken build costs three dialogs rather than one per test.
  maxFailures: 3,
  reporter: process.env['CI'] === undefined ? 'list' : 'github',
  timeout: 30_000,
  expect: { timeout: 5_000 },
});
