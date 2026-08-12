import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';
import { glob } from 'node:fs/promises';

import { envelope, launchBoard, type Board } from './board.js';

/**
 * The notes tab: what the agent recorded this session.
 *
 * The only view whose content accumulates, which puts the weight in two places
 * nothing else on the board has to worry about — that an arriving note does not
 * move the reader, and that the view's statement about impermanence stays true
 * of the tree beneath it.
 */

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
});

test.afterEach(async () => {
  await board.close();
});

/** Record a note as an agent would, over the same HTTP contract the clients use. */
async function record(text: string, source?: string): Promise<void> {
  await board.note({ ...envelope(), text, ...(source === undefined ? {} : { source }) });
}

async function openNotes(): Promise<void> {
  await board.page.getByTestId('tab-notes').click();
  await expect(board.page.getByTestId('notes')).toBeVisible();
}

test.describe('reading what the agent recorded', () => {
  test('lists notes newest first, with the text as written', async () => {
    await record('The refresh race guard only worked because the routes mounted in order.');
    await record('api/client.ts changed on disk between my read and my write. I stopped.');
    await openNotes();

    await expect(board.page.locator('.noterow__text')).toHaveText([
      'api/client.ts changed on disk between my read and my write. I stopped.',
      'The refresh race guard only worked because the routes mounted in order.',
    ]);
  });

  test('shows how long ago each was recorded', async () => {
    await record('A note');
    await openNotes();

    // Seconds, not the focus tag's `now` band: several notes can land inside a
    // minute and the gutter is what tells them apart.
    await expect(board.page.getByTestId('note-age-0')).toHaveText(/^\d+[smhd]$/u);
  });

  test('shows the stated reason where there is one, and nothing where there is not', async () => {
    // FR-004. A placeholder here would be the board writing a reason the agent
    // did not give.
    await record('You asked me to remember the settings rewrite.', 'you asked');
    await record('The three call sites differed in one place only.');
    await openNotes();

    await expect(board.page.locator('.noterow__source')).toHaveText(['you asked']);
    await expect(board.page.getByTestId('note-1').locator('.noterow__source')).toHaveCount(0);
    await expect(board.page.getByTestId('note-0').locator('.noterow__source')).toHaveText(
      'you asked',
    );
  });

  test('treats a blank source as no source rather than an empty line', async () => {
    await record('A note', '   ');
    await openNotes();

    await expect(board.page.locator('.noterow__source')).toHaveCount(0);
  });

  test('says there is nothing yet, and gives way to the list when a note arrives', async () => {
    /*
     * How FR-010 is actually satisfied — and since decision 36 it is satisfied
     * by this view rather than one level up.
     *
     * The empty state was written with feature 007 and was unreachable for as
     * long as a tab whose view would be empty was not offered at all. The tab
     * is permanent now, so the sentence the view was given is the answer, and
     * this is the test that stops it being read as dead code to delete.
     */
    await board.push({ ...envelope(), tasks: [{ id: 'T-1', title: 'A task', status: 'todo' }] });
    await openNotes();
    await expect(board.page.getByTestId('notes-empty')).toBeVisible();
    await expect(board.page.getByTestId('notes-list')).toHaveCount(0);

    await record('The first thing worth writing down.');

    await expect(board.page.getByTestId('notes-list')).toBeVisible();
    await expect(board.page.getByTestId('notes-empty')).toHaveCount(0);
  });

  test('summarises the count and the span in its header', async () => {
    await record('First');
    await record('Second');
    await openNotes();

    await expect(board.page.getByTestId('notes-summary')).toHaveText(/^2 notes · over \d+[smhd]$/u);
  });
});

test.describe('the view says what it does, and does what it says', () => {
  test('states that closing the window clears these notes, and how many', async () => {
    // FR-006. The count is the one number this feature draws, and it is here
    // rather than on the tab for a reason the footer's own comment gives: on a
    // tab a number reads as an inbox, and in this sentence it makes the loss
    // concrete instead of leaving the reader to guess whether it means much.
    await record('First');
    await record('Second');
    await openNotes();

    const footer = board.page.getByTestId('impermanence');
    await expect(footer).toContainText('Notes live in this window only.');
    await expect(footer).toContainText('Closing it clears all 2');
  });

  test('states that anything worth keeping belongs in the repository', async () => {
    // FR-007, and the half that makes the warning actionable rather than sad.
    await record('A note');
    await openNotes();

    await expect(board.page.getByTestId('impermanence')).toContainText(
      'ask the agent to write anything worth keeping into the repository',
    );
  });

  test('offers no way to keep, alter or write a note', async () => {
    // FR-008 and FR-009, over the rendered page. A pin would not break any
    // code — it would make the sentence above it false, which is why the test
    // is an absence test rather than a behaviour one.
    await record('A note', 'you asked');
    await openNotes();

    const view = board.page.getByTestId('notes');
    // Nothing operable in the whole tree: no button, no link, no field, no
    // control of any kind. The view is text.
    await expect(view.locator('button, a, input, textarea, select, [role="button"]')).toHaveCount(
      0,
    );
    await expect(view.locator('[contenteditable]')).toHaveCount(0);
  });

  test('has nothing operable anywhere in its source', async () => {
    /*
     * The same requirement structurally, because the rendered check above only
     * sees the state the view happened to be put in. A star that appears on
     * hover, or on the four hundredth note, is still a star.
     *
     * Asserted on *interactivity* rather than on a list of words like `pin` and
     * `archive`. Two reasons, and the first draft of this test hit both: a word
     * list matches the `export` keyword in every module and the prose in this
     * very tree explaining why a pin is absent, and it misses a control called
     * something nobody thought to add to the list. A control needs a handler or
     * an interactive element, whatever it is called.
     */
    const root = fileURLToPath(new URL('../../src/renderer/src/views/notes', import.meta.url));
    const HANDLER = /\bon[A-Z]\w*\s*=/u;
    const INTERACTIVE = /<(button|a|input|textarea|select|form|dialog)[\s>/]|role\s*=\s*["'`]/u;

    const offenders: string[] = [];
    for await (const file of glob('**/*.{ts,tsx}', { cwd: root })) {
      // Comments first: this tree argues at length about the controls it does
      // not have, and the argument is not a control.
      const source = readFileSync(`${root}/${file}`, 'utf8')
        .replaceAll(/\/\*[\s\S]*?\*\//gu, ' ')
        .replaceAll(/\/\/[^\n]*/gu, ' ');

      const handler = HANDLER.exec(source);
      if (handler !== null) offenders.push(`${file}: handler ${handler[0]}`);

      const element = INTERACTIVE.exec(source);
      if (element !== null) offenders.push(`${file}: ${element[0]}`);
    }

    expect(offenders).toEqual([]);
  });

  test('is empty again after a restart', async () => {
    // SC-007, and the reason the sentence is true: the store is in memory and
    // the process exiting is the whole of the retention policy.
    await record('Something worth remembering, briefly.');
    await openNotes();
    await expect(board.page.locator('.noterow')).toHaveCount(1);

    const { port } = board;
    await board.close();
    board = await launchBoard();

    // Same port, so this is the same board as far as any agent is concerned.
    expect(board.port).not.toBe(port);
    // Nothing held at all, so there is not yet a session for notes to belong to.
    await expect(board.page.getByTestId('waiting-state')).toBeVisible();

    /*
     * Asserted by writing one, which is what makes this SC-007 rather than a
     * restatement of the line above. Under the count-gated strip the absent tab
     * was the whole assertion; it proved less than it looked, because a tab is
     * also absent when no session has reported. One note, and the view holds
     * one row: the note from before the restart did not come back with it.
     */
    await record('The first thing recorded by the new process.');
    await openNotes();
    await expect(board.page.locator('.noterow')).toHaveCount(1);
    await expect(board.page.getByTestId('notes-summary')).toHaveText(/^1 note/u);
  });
});

test.describe('a long session, a long note, and hostile content', () => {
  test('stays scrollable and legible at 300 notes', async () => {
    // SC-006. The last one is what matters: a list that quietly stopped
    // rendering past some limit would look perfect at the top.
    for (let i = 0; i < 300; i += 1) await record(`Note number ${i}`);
    await openNotes();

    const { page } = board;
    await expect(page.locator('.noterow')).toHaveCount(300);
    // Newest first, so note 299 is at the top and note 0 needs scrolling to.
    await expect(page.locator('.noterow__text').first()).toHaveText('Note number 299');

    const oldest = page.getByTestId('note-0');
    await oldest.scrollIntoViewIfNeeded();
    await expect(oldest).toBeInViewport();
    await expect(oldest.locator('.noterow__text')).toHaveText('Note number 0');
    await expect(page.getByTestId('notes-summary')).toContainText('300 notes');
  });

  test('shows a note at the contract cap whole, and a one-character note too', async () => {
    // 4,000 is MAX_TEXT. A note is the agent's entire thought and FR-002 says
    // it is shown as written — an ellipsis in the middle of one would hide
    // exactly the part that mattered, so this wraps rather than truncating.
    const long = `Start ${'and it continues '.repeat(230)}end.`.slice(0, 4_000);

    await record('x');
    await record(long);
    await openNotes();

    const { page } = board;
    await expect(page.getByTestId('note-1').locator('.noterow__text')).toHaveText(long);
    await expect(page.getByTestId('note-0').locator('.noterow__text')).toHaveText('x');

    // Wrapped, not clipped: the element is as tall as its content.
    const clipped = await page
      .getByTestId('note-1')
      .locator('.noterow__text')
      .evaluate((el) => el.scrollHeight > el.clientHeight + 1);
    expect(clipped).toBe(false);
  });

  test('renders markup as visible characters', async () => {
    // SC-009. Note text is the most freely-composed field in the whole
    // contract — it is whatever the agent felt like writing.
    const hostile = '<script>window.__pwned = true</script><img src=x onerror="window.__pwned=1">';

    await record(hostile, hostile);
    await openNotes();

    const { page } = board;
    await expect(page.locator('.noterow__text')).toContainText('<script>');
    await expect(page.locator('.noterow__source')).toContainText('<script>');
    expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined();
    await expect(page.locator('img')).toHaveCount(0);
  });

  test('never scrolls sideways at the narrowest the panel goes', async () => {
    // FR-016 and SC-008, at the 380px floor. An unbroken 200-character token is
    // the case that actually pushes a row past the panel edge.
    const unbroken = 'A'.repeat(200);

    await record(`A note containing ${unbroken} and a path src/${'deeply/'.repeat(40)}client.ts`);
    await record('A short one.', unbroken);
    await openNotes();

    const applied = await board.app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window?.setContentSize(380, 320);
      return window?.getContentSize()[0] ?? 0;
    });
    // Asserted rather than assumed, as feature 006's breakpoint spec found the
    // hard way: a resize that silently lands elsewhere tests the wrong width.
    expect(applied).toBe(380);
    await board.page.waitForFunction(() => window.innerWidth === 380, undefined, { timeout: 5_000 });

    const overflow = await board.page.evaluate(() => {
      const list = document.querySelector('[data-testid="notes-list"]');
      const panel = document.querySelector('.app__body');
      return {
        body: document.body.scrollWidth - document.body.clientWidth,
        panel: panel === null ? 0 : panel.scrollWidth - panel.clientWidth,
        list: list === null ? 0 : list.scrollWidth - list.clientWidth,
      };
    });

    expect(overflow.body).toBeLessThanOrEqual(0);
    expect(overflow.panel).toBeLessThanOrEqual(0);
    expect(overflow.list).toBeLessThanOrEqual(0);
  });
});

test.describe('a note arriving while the view is open', () => {
  test('appears at the top without any action', async () => {
    await record('First');
    await openNotes();

    await record('Second');

    await expect(board.page.locator('.noterow__text').first()).toHaveText('Second');
    await expect(board.page.locator('.noterow')).toHaveCount(2);
  });

  test('does not move what the developer is reading', async () => {
    // FR-005, and the thing most likely to break in this feature: notes enter
    // at the *top* of a list that may be scrolled, and in an ordinary scroll
    // container inserting above the viewport pushes everything down by the
    // height of the new row. Chromium's scroll anchoring is what absorbs it;
    // this is the test that proves it is actually doing so.
    for (let i = 0; i < 40; i += 1) {
      await record(`Note number ${i}, long enough to take a line or two of the panel's width.`);
    }
    await openNotes();

    const { page } = board;
    const list = page.getByTestId('notes-list');
    const scrolled = await list.evaluate((el) => {
      el.scrollTop = 600;
      return el.scrollTop;
    });
    // Confirmed, not assumed. A list that did not scroll makes every assertion
    // below it true for the wrong reason.
    expect(scrolled).toBeGreaterThan(0);

    // Measured against a row rather than against scrollTop alone: if the
    // browser compensated by adjusting scrollTop, the number changes and the
    // reader does not move, which is a pass. What must not change is where the
    // row sits on screen.
    const anchor = page.getByTestId('note-20');
    const before = await anchor.evaluate((el) => el.getBoundingClientRect().top);

    await record('A brand new note that lands above everything being read.');
    await expect(page.locator('.noterow__text').first()).toHaveText(
      'A brand new note that lands above everything being read.',
    );

    const after = await anchor.evaluate((el) => el.getBoundingClientRect().top);
    // A pixel of tolerance for sub-pixel layout, and no more.
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });

  test('keeps its place through a burst', async () => {
    for (let i = 0; i < 40; i += 1) await record(`Note number ${i}`);
    await openNotes();

    const { page } = board;
    const scrolled = await page.getByTestId('notes-list').evaluate((el) => {
      el.scrollTop = 400;
      return el.scrollTop;
    });
    expect(scrolled).toBeGreaterThan(0);

    const anchor = page.getByTestId('note-15');
    const before = await anchor.evaluate((el) => el.getBoundingClientRect().top);

    for (let i = 0; i < 10; i += 1) await record(`Burst note ${i}`);
    await expect(page.locator('.noterow')).toHaveCount(50);

    const after = await anchor.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });
});
