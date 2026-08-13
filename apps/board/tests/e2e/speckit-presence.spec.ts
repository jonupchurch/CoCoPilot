import { expect, test, type Page } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

/**
 * Which destinations a session offers, and — the part that matters — what may
 * never be taken away from it.
 *
 * The last describe here is the reason this feature is shaped as it is. Decision
 * 36 was raised because a count-gated strip withdrew the Tasks tab from a
 * developer mid-read and the fallback moved them to Overview. This feature
 * withdraws destinations *deliberately*, so it has to prove it cannot recreate
 * that: nothing goes from a developer who had opened it. That is a claim about a
 * sequence, and a test that looks at one screen cannot see it.
 */

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
  // Wide enough for the side-by-side arrangement, so which of the two narrow
  // answers a view gives is not accidentally under test here. The breakpoint has
  // its own spec.
  await board.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
});

test.afterEach(async () => {
  await board.close();
});

const STORIES = [{ id: 'US-001', title: 'Read the ticket you are working from' }];
const TASKS = [{ id: 'T-1', title: 'Audit the call sites', status: 'todo', storyId: 'US-001' }];

/** Which of the five destinations the strip is currently offering. */
async function offered(page: Page): Promise<string[]> {
  return page.locator('.tabstrip__tab').evaluateAll((tabs) =>
    tabs.map((tab) => tab.getAttribute('data-testid') ?? ''),
  );
}

test.describe('a project that is not Spec-Kit shaped', () => {
  test('offers no tree, and the same strip it offered before this feature', async () => {
    // The absence test, and it comes first: it is the case most easily broken by
    // the code serving every other one.
    await board.push({ ...envelope(), tasks: [{ id: 'T-1', title: 'A task', status: 'todo' }] });
    const { page } = board;

    await expect(page.getByTestId('tab-speckit')).toHaveCount(0);
    expect(await offered(page)).toEqual([
      'tab-overview',
      'tab-stories',
      'tab-tasks',
      'tab-notes',
    ]);
  });

  test('keeps both old views working exactly as they did', async () => {
    await board.push({ ...envelope(), tasks: [{ id: 'T-1', title: 'A task', status: 'todo' }] });
    const { page } = board;

    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('tasks')).toBeVisible();

    // A task belonging to no story still reaches both views, via the unassigned
    // scope those views have had since feature 006. Nothing about that changes
    // for a session this feature does not take over.
    await page.getByTestId('tab-stories').click();
    await expect(page.getByTestId('stories')).toBeVisible();
    await expect(page.getByTestId('story-row-unassigned')).toBeVisible();
  });
});

test.describe('becoming Spec-Kit shaped', () => {
  test('gains the tree and loses the two views it duplicates', async () => {
    await board.push({ ...envelope(), tasks: [] });
    const { page } = board;
    expect(await offered(page)).toContain('tab-stories');

    await board.push({ ...envelope(), stories: STORIES, tasks: TASKS });

    // One arrived and two left: the strip is shorter than it was.
    expect(await offered(page)).toEqual(['tab-overview', 'tab-speckit', 'tab-notes']);
  });

  test('leaves Overview as the landing view', async () => {
    await board.push({ ...envelope(), stories: STORIES, tasks: TASKS });

    await expect(board.page.getByTestId('body')).toHaveAttribute('data-tab', 'overview');
  });

  test('keeps the tree when a later report carries no stories at all', async () => {
    const { page } = board;
    await board.push({ ...envelope(), stories: STORIES, tasks: TASKS });
    await expect(page.getByTestId('tab-speckit')).toBeVisible();

    // Reports replace wholesale, so this is an ordinary thing to receive. It
    // must not withdraw a destination (FR-003).
    for (let i = 0; i < 3; i += 1) {
      await board.push({ ...envelope(), stories: [], tasks: [] });
    }

    await expect(page.getByTestId('tab-speckit')).toBeVisible();
  });

  test('is decided per session, and does not leak between them', async () => {
    const { page } = board;
    await board.push({ ...envelope({ sessionId: 'spec' }), stories: STORIES, tasks: TASKS });
    await board.push({ ...envelope({ sessionId: 'plain' }), tasks: [] });

    // The second session is selected by nothing; select each in turn.
    await page.locator('.pill__select').first().click();
    await expect(page.getByTestId('tab-speckit')).toBeVisible();
    await expect(page.getByTestId('tab-stories')).toHaveCount(0);

    await page.locator('.pill__select').nth(1).click();
    await expect(page.getByTestId('tab-speckit')).toHaveCount(0);
    await expect(page.getByTestId('tab-stories')).toBeVisible();
  });
});

test.describe('sessions and lifetime', () => {
  const REPO_B = `${process.cwd()}/apps`;

  test('keeps "opened" to the session it happened in', async () => {
    const { page } = board;
    await board.push({ ...envelope({ sessionId: 'a1' }), tasks: [] });
    await board.push({ ...envelope({ repo: REPO_B, sessionId: 'b2' }), tasks: [] });

    // The developer opens the task view in a1 only.
    await page.locator('.pill__select').first().click();
    await page.getByTestId('tab-tasks').click();

    // Both then become Spec-Kit shaped.
    await board.push({ ...envelope({ sessionId: 'a1' }), stories: STORIES, tasks: TASKS });
    await board.push({ ...envelope({ repo: REPO_B, sessionId: 'b2' }), stories: STORIES, tasks: TASKS });

    await page.locator('.pill__select').first().click();
    await expect(page.getByTestId('tab-tasks')).toBeVisible();

    // b2's developer never went there, so b2 does not inherit a1's history.
    await page.locator('.pill__select').nth(1).click();
    await expect(page.getByTestId('tab-tasks')).toHaveCount(0);
    await expect(page.getByTestId('tab-speckit')).toBeVisible();
  });

  test('carries nothing about shape on the switcher pills', async () => {
    const { page } = board;
    await board.push({ ...envelope({ sessionId: 'a1' }), stories: STORIES, tasks: TASKS });
    await board.push({ ...envelope({ repo: REPO_B, sessionId: 'b2' }), tasks: [] });

    // A pill draws identity, chip and elapsed time. Which destinations a session
    // offers is not a pill's business, and `SessionSummary` cannot carry it.
    for (const pill of await page.locator('.pill').all()) {
      await expect(pill).not.toContainText('Spec-Kit');
    }
  });

  test('starts a dismissed session over when it reports again', async () => {
    const { page } = board;
    await board.push({ ...envelope(), stories: STORIES, tasks: TASKS });
    await board.push({ ...envelope({ repo: REPO_B, sessionId: 'other' }), tasks: [] });
    await expect(page.getByTestId('tab-speckit')).toBeVisible();

    await page.locator('.pill').first().locator('.pill__dismiss').click();
    await board.push({ ...envelope(), tasks: [{ id: 'T-9', title: 'Fresh', status: 'todo' }] });
    await page.locator('.pill__select').first().click();

    // The session went, and with it everything the board knew about its shape.
    await expect(page.getByTestId('tab-speckit')).toHaveCount(0);
    await expect(page.getByTestId('tab-stories')).toBeVisible();
  });

  test('remembers neither boolean across a restart', async () => {
    // The store is in memory and the process exiting is the whole of the
    // retention policy — the same reason notes do not survive (FR-039).
    await board.push({ ...envelope(), stories: STORIES, tasks: TASKS });
    await expect(board.page.getByTestId('tab-speckit')).toBeVisible();

    await board.close();
    board = await launchBoard();

    // Nothing held at all, so nothing to be Spec-Kit shaped.
    await expect(board.page.locator('.tabstrip')).toHaveCount(0);

    // And the next report earns the strip from scratch: no stories, no tree.
    await board.push({ ...envelope(), tasks: [{ id: 'T-1', title: 'After', status: 'todo' }] });
    await expect(board.page.getByTestId('tab-speckit')).toHaveCount(0);
    await expect(board.page.getByTestId('tab-stories')).toBeVisible();
  });
});

test.describe('nothing is taken from a developer who opened it', () => {
  test('keeps both old views for the rest of a session in which one was opened', async () => {
    const { page } = board;
    await board.push({
      ...envelope(),
      tasks: [{ id: 'T-0', title: 'Reported before any story', status: 'todo' }],
    });

    // The developer goes to the Tasks view before the session is Spec-Kit
    // shaped. From here on those destinations are theirs.
    await page.getByTestId('tab-tasks').click();
    await expect(page.getByTestId('tasks')).toBeVisible();

    await board.push({ ...envelope(), stories: STORIES, tasks: TASKS });

    expect(await offered(page)).toEqual([
      'tab-overview',
      'tab-speckit',
      'tab-stories',
      'tab-tasks',
      'tab-notes',
    ]);
    // And they were not moved out of the view they were reading.
    await expect(page.getByTestId('body')).toHaveAttribute('data-tab', 'tasks');
  });

  test('holds across a long sequence of reports and navigations', async () => {
    /*
     * The property, asserted over a run rather than at a moment: once a
     * destination has been offered *and opened*, it is offered at every later
     * step. Anything that withdraws it has re-created decision 36's fault.
     */
    const { page } = board;
    const opened = new Set<string>();

    const step = async (): Promise<void> => {
      const now = await offered(page);
      for (const tab of opened) expect(now).toContain(tab);
    };

    const visit = async (tab: string): Promise<void> => {
      await page.getByTestId(tab).click();
      opened.add(tab);
      await step();
    };

    await board.push({ ...envelope(), tasks: [] });
    await step();

    await visit('tab-stories');
    await visit('tab-notes');

    await board.push({ ...envelope(), stories: STORIES, tasks: TASKS });
    await step();

    await visit('tab-speckit');

    await board.push({ ...envelope(), stories: [], tasks: [] });
    await step();

    await board.push({ ...envelope(), stories: STORIES, tasks: TASKS });
    await step();

    await visit('tab-overview');
    await step();

    // Teeth: the run has to have actually opened something, or every assertion
    // above passed over an empty set.
    expect(opened.size).toBeGreaterThan(2);
  });

  test('measures the widest strip this feature can produce, at the floor', async () => {
    /*
     * The case worth measuring is not the ordinary one.
     *
     * A Spec-Kit session whose developer never opened a legacy view has a
     * *shorter* strip than before this feature: one destination arrived and two
     * left. The widest case needs a Spec-Kit session **and** a developer who
     * deliberately went to one of the old views — so that is what this sets up.
     *
     * **This is five destinations, not six.** Feature 010 adds a sixth, and its
     * ticket view does not exist yet; the six-destination measurement is owed
     * once 010 lands and cannot be taken before it. Per the plan, if that one
     * fails the answer is to bring the retirement of these two views forward,
     * not to relax the floor.
     */
    const { page } = board;
    await board.push({
      ...envelope(),
      tasks: [{ id: 'T-0', title: 'Reported before any story', status: 'todo' }],
    });
    await page.getByTestId('tab-tasks').click();
    await board.push({ ...envelope(), stories: STORIES, tasks: TASKS });

    const strip = await offered(page);
    expect(strip).toHaveLength(5);

    // Content size, not window size: `matchMedia` sees the contents, and a
    // measurement off by the width of a frame would prove nothing.
    const applied = await board.app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.setContentSize(380, 700);
      return win?.getContentSize()[0] ?? 0;
    });
    await page.waitForFunction((w) => window.innerWidth === w, applied, { timeout: 5_000 });

    // Every destination still legible and operable — visible, non-zero, and
    // actually clickable rather than merely present in the DOM.
    for (const id of strip) {
      const tab = page.getByTestId(id);
      await expect(tab).toBeVisible();
      const box = await tab.boundingBox();
      expect(box, `${id} has no box`).not.toBeNull();
      expect(box!.width, `${id} is not legible`).toBeGreaterThan(8);
    }

    // And nothing scrolls sideways, anywhere.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('never withdraws a destination the developer is currently reading', async () => {
    const { page } = board;
    await board.push({ ...envelope(), tasks: [] });

    await page.getByTestId('tab-stories').click();
    await expect(page.getByTestId('body')).toHaveAttribute('data-tab', 'stories');

    // Ten reports, each of which would previously have been a chance to be moved.
    for (let i = 0; i < 10; i += 1) {
      await board.push({ ...envelope(), stories: STORIES, tasks: TASKS });
    }

    await expect(page.getByTestId('body')).toHaveAttribute('data-tab', 'stories');
    await expect(page.getByTestId('tab-stories')).toBeVisible();
  });
});
