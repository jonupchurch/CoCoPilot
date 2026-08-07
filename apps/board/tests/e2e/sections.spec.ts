import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
});

test.afterEach(async () => {
  await board.close();
});

/** Enough of everything that all four sections render. */
function full(taskCount = 4): Record<string, unknown> {
  return {
    ...envelope(),
    feature: { id: 'US-002', title: 'Share one session fetch', specPath: 'specs/002/spec.md' },
    tasks: Array.from({ length: taskCount }, (_, i) => ({
      id: `T-${String(i).padStart(3, '0')}`,
      title: `Task number ${i}`,
      status: i === 0 ? 'active' : i < taskCount / 2 ? 'done' : 'todo',
    })),
    plan: [
      { text: 'Read the three call sites', status: 'done' },
      { text: 'Write the hook', status: 'active' },
      { text: 'Replace the call sites', status: 'todo' },
    ],
    focus: { task: 'T-000', note: 'Working through the call sites.', chip: 'watching' },
    changedFiles: [
      { path: 'src/hooks/useSession.ts', change: 'added', added: 48 },
      { path: 'src/routes/index.tsx', change: 'modified', added: 21, removed: 18 },
    ],
  };
}

/**
 * Every section on the Overview tab, transcript-fed ones included.
 *
 * Listed in full rather than as the four reported ones, because SC-002's claim
 * is about a developer with *everything* closed — a section added later that
 * quietly stopped summarising itself would pass a list that had not grown with
 * it. The harness points at a home with no transcripts, so the two transcript
 * sections summarise as unavailable here, which is still a summary.
 */
const SECTIONS = [
  'last-prompt',
  'history',
  'context',
  'focus',
  'spec',
  'plan',
  'changed',
] as const;

test.describe('sections collapse independently', () => {
  test('hides its content and moves the sections below it up', async () => {
    const { page } = board;
    await board.push(full());

    const planBefore = await page.getByTestId('section-plan').boundingBox();

    await page.getByTestId('section-toggle-spec').click();

    await expect(page.getByTestId('section-spec')).toHaveAttribute('data-open', 'false');
    await expect(page.getByTestId('section-spec').locator('.section__body')).toHaveCount(0);
    await expect(page.getByTestId('task-T-001')).toHaveCount(0);

    const planAfter = await page.getByTestId('section-plan').boundingBox();
    expect(planAfter?.y ?? 0).toBeLessThan(planBefore?.y ?? 0);

    // Only the one that was clicked.
    await expect(page.getByTestId('section-focus')).toHaveAttribute('data-open', 'true');
    await expect(page.getByTestId('section-plan')).toHaveAttribute('data-open', 'true');
  });

  test('expands again when activated a second time', async () => {
    const { page } = board;
    await board.push(full());

    await page.getByTestId('section-toggle-spec').click();
    await expect(page.getByTestId('task-T-001')).toHaveCount(0);

    await page.getByTestId('section-toggle-spec').click();
    await expect(page.getByTestId('task-T-001')).toBeVisible();
    await expect(page.getByTestId('section-toggle-spec')).toHaveAttribute('aria-expanded', 'true');
  });

  test('is operable from the keyboard', async () => {
    const { page } = board;
    await board.push(full());

    await page.getByTestId('section-toggle-plan').focus();
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('section-plan')).toHaveAttribute('data-open', 'false');
  });
});

test.describe('a collapsed header still answers its question', () => {
  test('keeps every label and summary visible with all of them closed', async () => {
    const { page } = board;
    await board.push(full());

    for (const section of SECTIONS) {
      await page.getByTestId(`section-toggle-${section}`).click();
    }

    for (const section of SECTIONS) {
      await expect(page.getByTestId(`section-${section}`)).toHaveAttribute('data-open', 'false');
      await expect(page.getByTestId(`section-${section}`).locator('.section__label')).toBeVisible();
      await expect(page.getByTestId(`section-summary-${section}`)).toBeVisible();
    }

    // SC-002 stated literally: completion, position in the plan and volume of
    // change, all readable with nothing expanded.
    await expect(page.getByTestId('section-summary-focus')).toContainText('T-000');
    await expect(page.getByTestId('section-summary-spec')).toHaveText('US-002 · 1 of 4 done');
    await expect(page.getByTestId('section-summary-plan')).toHaveText('Step 2 of 3');
    await expect(page.getByTestId('section-summary-changed')).toContainText('+69');
  });
});

test.describe('an arriving report leaves the reader alone', () => {
  test('preserves the section arrangement and the scroll position', async () => {
    const { page, app } = board;

    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(420, 360);
    });
    await board.push(full(40));

    await page.getByTestId('section-toggle-focus').click();
    await page.getByTestId('section-toggle-plan').click();

    const body = page.getByTestId('body');
    await body.evaluate((el) => {
      el.scrollTop = 200;
    });
    const scrolled = await body.evaluate((el) => el.scrollTop);
    expect(scrolled).toBeGreaterThan(0);

    // Same payload with a changed chip, so the report definitely landed and the
    // scroll height it lands into is identical.
    await board.push({ ...full(40), focus: { task: 'T-000', chip: 'needs-you' } });
    await expect(page.locator('.chip')).toHaveAttribute('data-chip', 'needs-you');

    expect(await body.evaluate((el) => el.scrollTop)).toBe(scrolled);
    await expect(page.getByTestId('section-focus')).toHaveAttribute('data-open', 'false');
    await expect(page.getByTestId('section-plan')).toHaveAttribute('data-open', 'false');
    await expect(page.getByTestId('section-spec')).toHaveAttribute('data-open', 'true');
  });
});
