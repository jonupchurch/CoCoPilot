import { expect, test } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

/**
 * Both detail views in the panel they will actually live in.
 *
 * The product's habitat is a strip beside an editor, and the default window is
 * 452px wide — *below* the breakpoint. The narrow arrangement is therefore the
 * common case rather than the edge one, which is why this spec exists at all.
 *
 * Everything here sets the **content** size rather than the window size. A
 * window is its frame plus its contents, `matchMedia` sees only the contents,
 * and a boundary test off by the width of a frame would pass at the wrong
 * number and prove nothing.
 */

let board: Board;

/** FR-010: at or above this the arrangement is the wide one. */
const BREAKPOINT = 640;
/** `MIN_WIDTH` in `main/window.ts` — the narrowest the panel can be dragged. */
const FLOOR = 380;

test.beforeEach(async () => {
  board = await launchBoard();
});

test.afterEach(async () => {
  await board.close();
});

/**
 * Resize, and return the width the window **actually** took.
 *
 * Two things make the requested number and the real one differ, and both were
 * found by a test that looked like it passed:
 *
 * - A display scale of 1.5 quantises content widths to whole physical pixels,
 *   so an odd request rounds up: asking for 639 gets 640. A boundary test that
 *   trusted its own argument would be asserting the narrow arrangement at a
 *   width that is not narrow.
 * - The renderer sees the new size a beat after the main process applies it, so
 *   reading `innerWidth` straight after the call reports the *previous* width.
 *
 * Hence: ask, read back what was applied, then wait for the renderer to agree.
 */
async function resize(width: number, height = 700): Promise<number> {
  const applied = await board.app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setContentSize(size.width, size.height);
    return win?.getContentSize()[0] ?? size.width;
  }, { width, height });

  await board.page.waitForFunction((expected) => window.innerWidth === expected, applied, {
    timeout: 5_000,
  });

  return applied;
}

const REPORT = {
  stories: [
    { id: 'US-002', title: 'Share one session fetch across routes', priority: 'P1' },
    { id: 'US-004', title: 'Read the prompt history without leaving the panel' },
    { id: 'US-007', title: 'Show what the agent is holding' },
  ],
  tasks: [
    { id: 'T-011', title: 'Audit the three call sites', status: 'done', storyId: 'US-002' },
    { id: 'T-013', title: 'Implement useSession', status: 'active', storyId: 'US-002' },
    { id: 'T-031', title: 'Expandable history rows', status: 'todo', storyId: 'US-004' },
    { id: 'T-044', title: 'Read the transcript', status: 'todo', storyId: 'US-007' },
  ],
  focus: { task: 'T-013', chip: 'watching' },
};

async function open(tab: 'stories' | 'tasks'): Promise<void> {
  await board.push({ ...envelope(), ...REPORT });
  await board.page.getByTestId(`tab-${tab}`).click();
  await expect(board.page.getByTestId(tab)).toBeVisible();
}

test.describe('the boundary itself', () => {
  test('is wide at exactly 640 and narrow below it', async () => {
    // "At or above", not "above". The off-by-one here is the whole content of
    // FR-010, and it is invisible without a test at both sides.
    await open('stories');

    // Asserted, not assumed: on a display where the breakpoint itself is not a
    // reachable width this should fail rather than silently test 642.
    expect(await resize(BREAKPOINT)).toBe(BREAKPOINT);
    await expect(board.page.getByTestId('stories')).toHaveAttribute('data-narrow', 'false');
    await expect(board.page.getByTestId('story-list')).toBeVisible();

    // 639 rounds back up to 640 at a 1.5 display scale, so the nearest width
    // actually below the boundary is two pixels down.
    expect(await resize(BREAKPOINT - 2)).toBeLessThan(BREAKPOINT);
    await expect(board.page.getByTestId('stories')).toHaveAttribute('data-narrow', 'true');
    await expect(board.page.getByTestId('story-list')).toHaveCount(0);
  });
});

test.describe('the Stories tab swaps its list for a picker', () => {
  test('shows the column wide and the picker narrow, never both', async () => {
    await open('stories');

    await resize(900);
    await expect(board.page.getByTestId('story-list')).toBeVisible();
    await expect(board.page.getByTestId('story-picker')).toHaveCount(0);

    await resize(FLOOR);
    await expect(board.page.getByTestId('story-picker')).toBeVisible();
    await expect(board.page.getByTestId('story-list')).toHaveCount(0);
    // The detail is the whole panel now, which is the point of the swap.
    await expect(board.page.getByTestId('story-detail')).toBeVisible();
  });

  test('reaches every story from the picker', async () => {
    await open('stories');
    await resize(FLOOR);

    for (const id of ['US-007', 'US-004', 'US-002']) {
      await board.page.getByTestId('story-picker').click();
      await board.page.getByTestId(`story-picker-option-${id}`).click();
      await expect(board.page.getByTestId('story-detail-id')).toHaveText(id);
    }
  });

  test('distinguishes the options by more than their titles', async () => {
    // US4 scenario 4. A spec whose stories all open "As a developer…" would be
    // a list of identical rows if the title were all a row carried.
    await open('stories');
    await resize(FLOOR);
    await board.page.getByTestId('story-picker').click();

    const option = board.page.getByTestId('story-picker-option-US-002');
    await expect(option.locator('.scopepicker__id')).toHaveText('US-002');
    await expect(option.locator('.scopepicker__tasks')).toHaveText('1/2');
  });
});

test.describe('the Tasks tab stacks instead', () => {
  test('keeps its list visible at every width', async () => {
    // The divergence from the Stories tab, and the reason both CSS files carry
    // a comment: a task row is two short lines, so stacking costs almost
    // nothing, and hiding the list behind a control would cost a click a task.
    await open('tasks');

    await resize(900);
    await expect(board.page.getByTestId('tasks')).toHaveAttribute('data-narrow', 'false');
    await expect(board.page.getByTestId('task-list')).toBeVisible();

    await resize(FLOOR);
    await expect(board.page.getByTestId('tasks')).toHaveAttribute('data-narrow', 'true');
    await expect(board.page.getByTestId('task-list')).toBeVisible();
    await expect(board.page.getByTestId('task-detail')).toBeVisible();
  });

  test('keeps the scope picker at every width', async () => {
    await open('tasks');

    await resize(900);
    await expect(board.page.getByTestId('scope-picker')).toBeVisible();

    await resize(FLOOR);
    await expect(board.page.getByTestId('scope-picker')).toBeVisible();
  });

  test('reaches every story from the scope picker while narrow', async () => {
    await open('tasks');
    await resize(FLOOR);

    for (const [id, task] of [
      ['US-007', 'T-044'],
      ['US-004', 'T-031'],
      ['US-002', 'T-011'],
    ] as const) {
      await board.page.getByTestId('scope-picker').click();
      await board.page.getByTestId(`scope-picker-option-${id}`).click();
      await expect(board.page.getByTestId('task-detail-id')).toHaveText(task);
    }
  });
});

test.describe('a resize does not move the developer', () => {
  test('keeps the story chosen wide when the panel is narrowed and widened again', async () => {
    // SC-004. FR-012 and FR-014 are the same promise from two directions: an
    // arriving report must not move them, and neither must the window.
    await open('stories');
    await resize(900);
    await board.page.getByTestId('story-row-US-007').click();

    await resize(FLOOR);
    await expect(board.page.getByTestId('story-detail-id')).toHaveText('US-007');

    await resize(900);
    await expect(board.page.getByTestId('story-detail-id')).toHaveText('US-007');
    await expect(board.page.getByTestId('story-row-US-007')).toHaveAttribute(
      'data-selected',
      'true',
    );
  });

  test('keeps the task chosen wide across the same journey', async () => {
    await open('tasks');
    await resize(900);
    await board.page.getByTestId('task-row-T-013').click();

    await resize(FLOOR);
    await expect(board.page.getByTestId('task-detail-id')).toHaveText('T-013');

    await resize(900);
    await expect(board.page.getByTestId('task-detail-id')).toHaveText('T-013');
    await expect(board.page.getByTestId('task-row-T-013')).toHaveAttribute('data-selected', 'true');
  });
});

test.describe('nothing scrolls sideways at the narrowest the panel goes', () => {
  for (const tab of ['stories', 'tasks'] as const) {
    test(`on the ${tab} tab`, async () => {
      // Asserted on scrollWidth rather than by eye, the way feature 004 does
      // it. A panel that scrolls horizontally has lost content off the right,
      // and at 380px that is where every unbroken agent-composed string goes.
      await open(tab);
      // Confirmed rather than assumed: this is the assertion that decides
      // whether the test is about 380px or about whatever the window settled on.
      expect(await resize(FLOOR, 320)).toBe(FLOOR);

      const overflow = await board.page.evaluate((testId) => {
        const view = document.querySelector(`[data-testid="${testId}"]`);
        const panel = document.querySelector('.app__body');
        return {
          body: document.body.scrollWidth - document.body.clientWidth,
          panel: panel === null ? 0 : panel.scrollWidth - panel.clientWidth,
          view: view === null ? 0 : view.scrollWidth - view.clientWidth,
        };
      }, tab);

      expect(overflow.body).toBeLessThanOrEqual(0);
      expect(overflow.panel).toBeLessThanOrEqual(0);
      expect(overflow.view).toBeLessThanOrEqual(0);
    });
  }
});
