import { expect, test } from '@playwright/test';

import { envelope, keepOldViews, launchBoard, type Board } from './board.js';

/**
 * The ticket destination: the tracker record the work came from.
 *
 * The first test here is an **absence**, and it is the comparison the whole
 * feature turns on. Since decision 36 every other destination is offered from
 * the first report whether or not its view has content; this one is not offered
 * at all until a ticket exists, because a session working from repository specs
 * has no ticket *concept*. "Absent" and "empty" have to stay distinguishable, so
 * the empty case is measured rather than assumed.
 */

let board: Board;

/** Requests the window makes on its own account, recorded from launch. */
let outbound: string[];

test.beforeEach(async () => {
  board = await launchBoard();
  outbound = [];

  // Everything the built app needs is on disk, so any http/ws request at all is
  // the finding. A ticket carries the first addresses the board has ever held,
  // and the temptation they create — fetch the title, resolve the redirect,
  // show a preview — is exactly what FR-024 forbids.
  board.page.on('request', (request) => {
    const url = request.url();
    if (/^(https?|wss?):/u.test(url)) outbound.push(`${request.method()} ${url}`);
  });

  await board.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(900, 700);
  });
});

test.afterEach(async () => {
  await board.close();
});

const TICKET = {
  key: 'PROJ-1234',
  title: 'Tabbing past the password field returns focus to the top',
  url: 'https://example.atlassian.net/browse/PROJ-1234',
  system: 'Jira',
  type: 'Bug',
  state: 'In Progress',
  priority: 'High',
  assignee: 'A. Developer',
  reporter: 'A. Tester',
  sprint: 'Sprint 42',
  description: 'The login form loses focus.\n\nOnly after the password field.',
  criteria: ['Focus advances to Submit', 'Shift-tab returns to Password'],
  labels: ['accessibility', 'regression'],
  parent: { key: 'PROJ-1000', title: 'Accessibility pass', url: 'https://example.com/e/1000' },
};

async function report(overrides: Record<string, unknown> = {}): Promise<void> {
  await board.push({ ...envelope(), ...overrides });
}

async function ticket(overrides: Record<string, unknown> = {}): Promise<void> {
  const status = await board.ticket({ ...envelope(), ticket: { ...TICKET, ...overrides } });
  expect(status, 'the ticket should have been accepted').toBe(200);
}

/** Every destination currently on offer, by label, in strip order. */
async function destinations(): Promise<string[]> {
  return board.page.locator('.tabstrip__tab').allInnerTexts();
}

test.describe('a session with no ticket is offered no ticket destination', () => {
  test('offers four destinations and no ticket among them', async () => {
    /*
     * SC-002, and the reason it is a comparison rather than an assertion about
     * one tab: a suite that only checked `tab-ticket` is absent would pass on a
     * board where the strip failed to render at all.
     *
     * Four is the count for a session that has reported no stories: Overview,
     * Stories, Tasks, Notes. The tree is not offered without a story, and each
     * of the other three states its own emptiness rather than being withheld.
     */
    await report();

    await expect(board.page.getByTestId('tab-overview')).toBeVisible();
    expect(await destinations()).toEqual(['Overview', 'Stories', 'Tasks', 'Notes']);
    await expect(board.page.getByTestId('tab-ticket')).toHaveCount(0);
  });

  test('offers no ticket destination however much else is reported', async () => {
    // Not withheld for want of *content* — this session is busy and still has no
    // ticket concept. That is the distinction the destination is gated on.
    await keepOldViews(board);
    await report({
      stories: [{ id: 'US1', title: 'A story' }],
      tasks: [{ id: 'T1', title: 'A task', status: 'active' }],
      focus: { task: 'T1', chip: 'watching' },
    });
    await board.note({ ...envelope(), text: 'a note' });

    await expect(board.page.getByTestId('tab-speckit')).toBeVisible();
    await expect(board.page.getByTestId('tab-ticket')).toHaveCount(0);
  });
});

test.describe('a reported ticket', () => {
  test('adds the destination second, and does not move the developer', async () => {
    const { page } = board;
    await report();
    await expect(page.getByTestId('tab-overview')).toBeVisible();

    await ticket();

    await expect(page.getByTestId('tab-ticket')).toBeVisible();
    // Second, after Overview. The active destination falls back to the first
    // available one, so a ticket tab placed first would silently change which
    // view a ticket-driven session lands on.
    expect(await destinations()).toEqual(['Overview', 'Ticket', 'Stories', 'Tasks', 'Notes']);
    // FR-017: an agent reporting something does not move the human's attention.
    await expect(page.getByTestId('body')).toHaveAttribute('data-tab', 'overview');
  });

  test('shows every field that was reported', async () => {
    const { page } = board;
    await ticket();
    await page.getByTestId('tab-ticket').click();

    await expect(page.getByTestId('ticket-key')).toHaveText('PROJ-1234');
    await expect(page.getByTestId('ticket-title')).toHaveText(TICKET.title);
    await expect(page.getByTestId('ticket-type')).toHaveText('Bug');
    await expect(page.getByTestId('ticket-description-text')).toContainText(
      'The login form loses focus.',
    );
    await expect(page.getByTestId('ticket-parent-title')).toHaveText('Accessibility pass');
    await expect(page.getByTestId('ticket-parent-key')).toHaveText('PROJ-1000');

    for (const criterion of TICKET.criteria) {
      await expect(page.getByTestId('section-ticket-criteria')).toContainText(criterion);
    }
    const rows: Array<[string, string]> = [
      ['Tracker', 'Jira'],
      ['Priority', 'High'],
      ['Assignee', 'A. Developer'],
      ['Reporter', 'A. Tester'],
      ['Sprint', 'Sprint 42'],
    ];
    for (const [label, value] of rows) {
      await expect(page.getByTestId(`ticket-detail-${label}`)).toContainText(value);
    }
    for (const label of TICKET.labels) {
      await expect(page.getByTestId('ticket-labels')).toContainText(label);
    }
  });

  test('omits every field that was not reported, rather than blanking it', async () => {
    /*
     * FR-008. The failure this guards against is not a crash: it is a "Sprint —"
     * row on a ticket from a tracker that has no sprints, which reads as the
     * tracker having one and leaving it empty. An absent field must leave no
     * trace, including its own label.
     */
    const { page } = board;
    await board.ticket({
      ...envelope(),
      ticket: { key: 'AB#7', title: 'Only what a tracker must have' },
    });
    await page.getByTestId('tab-ticket').click();

    await expect(page.getByTestId('ticket-key')).toHaveText('AB#7');
    for (const absent of [
      'ticket-type',
      'ticket-parent',
      'ticket-labels',
      'section-ticket-description',
      'section-ticket-criteria',
      'section-ticket-details',
      'ticket-url-text',
    ]) {
      await expect(page.getByTestId(absent), `${absent} should be absent`).toHaveCount(0);
    }

    // And none of the board's own labels for those fields survive either.
    const body = await page.getByTestId('ticket').innerText();
    for (const word of ['Sprint', 'Assignee', 'Priority', 'Tracker', 'Reporter', 'unknown', '—']) {
      expect(body, `"${word}" should not appear`).not.toContain(word);
    }
  });

  test('shows how long ago it was reported, and judges nothing about it', async () => {
    // FR-011. The board stamps its own clock and says the age; whether a ticket
    // is still current is a question about a tracker it cannot see.
    const { page } = board;
    await ticket();
    await page.getByTestId('tab-ticket').click();

    await expect(page.getByTestId('ticket-age')).toBeVisible();
    await expect(page.getByTestId('ticket-age')).toContainText('reported');

    const body = await page.getByTestId('ticket').innerText();
    for (const verdict of ['stale', 'out of date', 'outdated', 'current', 'up to date', 'fresh']) {
      expect(body.toLowerCase(), `"${verdict}" is an assessment`).not.toContain(verdict);
    }
  });

  test('says nothing about how the ticket compares with the reported work', async () => {
    // FR-018. The ticket says one thing and the tasks say another, which is
    // ordinary; the board draws both and points at neither.
    const { page } = board;
    await report({ tasks: [{ id: 'T1', title: 'Fix the focus order', status: 'done' }] });
    await ticket({ state: 'To Do' });
    await page.getByTestId('tab-ticket').click();

    const body = await page.getByTestId('ticket').innerText();
    for (const word of ['disagree', 'mismatch', 'conflict', 'inconsistent', 'but the']) {
      expect(body.toLowerCase()).not.toContain(word);
    }
  });

  test('keeps the destination and the ticket through ten reports that ignore it', async () => {
    /*
     * SC-009 and FR-003, end-to-end rather than as a unit fact, because the
     * failure it catches is a **destination withdrawn from under a reader**: the
     * developer is on the Ticket tab when a report lands, and the active-tab
     * fallback would move them to Overview.
     *
     * Ten reports rather than one: a guard that worked on the first and decayed
     * would pass a single-report version of this.
     */
    const { page } = board;
    await ticket();
    await page.getByTestId('tab-ticket').click();
    await expect(page.getByTestId('body')).toHaveAttribute('data-tab', 'ticket');

    for (let i = 0; i < 10; i += 1) {
      await report({ tasks: [{ id: `T${i}`, title: 'ongoing work', status: 'active' }] });
      await expect(page.getByTestId('tab-ticket'), `after report ${i}`).toBeVisible();
      await expect(page.getByTestId('body'), `after report ${i}`).toHaveAttribute(
        'data-tab',
        'ticket',
      );
    }

    await expect(page.getByTestId('ticket-key')).toHaveText('PROJ-1234');
    // The reports really were landing, so the loop above is not vacuous.
    await page.getByTestId('tab-overview').click();
    await expect(page.getByTestId('overview')).toContainText('ongoing work');
  });

  test('replaces the ticket when a different one is reported', async () => {
    const { page } = board;
    await ticket();
    await page.getByTestId('tab-ticket').click();

    await board.ticket({
      ...envelope(),
      ticket: { key: 'PROJ-9999', title: 'Something else entirely' },
    });

    await expect(page.getByTestId('ticket-key')).toHaveText('PROJ-9999');
    // Replaced rather than accumulated: one ticket per session, never a list.
    await expect(page.getByTestId('ticket-key')).toHaveCount(1);
    await expect(page.getByTestId('ticket')).not.toContainText('PROJ-1234');
    // And the fields the new one does not carry are gone, not left behind.
    await expect(page.getByTestId('section-ticket-criteria')).toHaveCount(0);
  });
});

test.describe('opening a link — the safety test', () => {
  /*
   * **One case per row of the quickstart's address table**, and the two rows
   * that matter most are the ones a plausible implementation lets through:
   * `httpx://example.com` passes a `startsWith('http')` check, and
   * `javascript:void(0)//https://example.com` passes any `includes('https://')`
   * check because the string genuinely contains it.
   *
   * Each is a **200** on the endpoint — an unopenable address is not an invalid
   * ticket — and each must be visible as text and offered as no control.
   */
  const REFUSED: Array<[string, string]> = [
    ['file:///C:/Windows/System32/calc.exe', 'a local executable'],
    ['javascript:alert(1)', 'script as an address'],
    ['ms-msdt:/id', 'a registered application handler'],
    ['httpx://example.com', 'the one a startsWith check passes'],
    ['javascript:void(0)//https://example.com', 'the one an includes check passes'],
    ['www.example.com', 'no protocol, and never promoted to one'],
  ];

  for (const [url, why] of REFUSED) {
    test(`shows ${url} as text and offers no control — ${why}`, async () => {
      const { page } = board;
      const status = await board.ticket({
        ...envelope(),
        ticket: { key: 'PROJ-1', title: 'A ticket with an address to refuse', url },
      });
      // FR-021 and the data model: the ticket is held, the address is kept.
      expect(status, 'an unopenable address is not an invalid ticket').toBe(200);

      await page.getByTestId('tab-ticket').click();
      // Still on screen, verbatim — and not repaired into something openable.
      await expect(page.getByTestId('ticket-url-text')).toHaveText(url);
      // But not a control.
      await expect(page.getByTestId('ticket-url')).toHaveCount(0);
      await expect(page.getByTestId('ticket')).not.toContainText('https://example.com/');
    });
  }

  test('opens an ordinary address in the system browser, and nothing else moves', async () => {
    const { page } = board;
    const url = 'https://example.atlassian.net/browse/PROJ-1234';

    /*
     * `shell.openExternal` is stubbed in the main process rather than allowed to
     * launch a real browser: the assertion is about what the *board* asks for,
     * and a test that actually opened a browser window per run would be
     * unrunnable. What the OS then does is the OS's business.
     */
    await board.app.evaluate(({ shell }) => {
      const opened: string[] = [];
      (globalThis as unknown as { __opened: string[] }).__opened = opened;
      shell.openExternal = async (target: string): Promise<void> => {
        opened.push(target);
      };
    });

    await board.ticket({
      ...envelope(),
      ticket: {
        key: 'PROJ-1234',
        title: 'An ordinary ticket',
        url,
        parent: { key: 'PROJ-1000', title: 'The epic', url: 'https://example.com/e/1000' },
      },
    });
    await page.getByTestId('tab-ticket').click();

    // FR-025: the developer can read where it leads before activating it.
    await expect(page.getByTestId('ticket-url')).toHaveText(url);
    await page.getByTestId('ticket-url').click();

    // FR-020: a parent's address opens the same way.
    await page.getByTestId('ticket-parent-url').click();

    await expect
      .poll(async () =>
        board.app.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened),
      )
      .toEqual([url, 'https://example.com/e/1000']);

    /*
     * FR-023: the application's own window went nowhere and opened nothing.
     * Checked as the window's *count* and its *address*, because "navigated
     * away" and "opened a second window" are two different failures and a
     * ticket link is capable of either.
     */
    const windows = await board.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((w) => w.webContents.getURL()),
    );
    expect(windows).toHaveLength(1);
    expect(windows[0] ?? '').not.toContain('atlassian');
    await expect(page.getByTestId('ticket')).toBeVisible();

    /*
     * FR-024 and SC-005: zero outbound requests from the application. No title
     * fetch, no redirect resolution, no preview — the board vouches for the
     * *kind* of address and never for the destination, which would require
     * asking the destination.
     */
    expect(outbound).toEqual([]);
  });

  test('drops an address the renderer never offered, if one reaches the channel', async () => {
    /*
     * The main-process check is the one that counts, so it is tested **without
     * the renderer** — sent straight down the IPC channel, which is what a
     * compromised renderer would do. "The renderer only asks for validated
     * addresses" is a claim about the whole renderer; this is a claim about one
     * function, and it is the claim that holds.
     */
    await board.app.evaluate(({ shell }) => {
      const opened: string[] = [];
      (globalThis as unknown as { __opened: string[] }).__opened = opened;
      shell.openExternal = async (target: string): Promise<void> => {
        opened.push(target);
      };
    });

    await board.page.evaluate(() => {
      const bridge = (window as unknown as { cocoapilot: { openLink: (u: unknown) => void } })
        .cocoapilot;
      for (const bad of [
        'file:///C:/Windows/System32/calc.exe',
        'javascript:alert(1)',
        'ms-msdt:/id',
        'httpx://example.com',
        'javascript:void(0)//https://example.com',
        'www.example.com',
        '',
      ]) {
        bridge.openLink(bad);
      }
      /*
       * Non-strings too, which is why the rule type-checks before it parses.
       *
       * An object carrying its own `toString` is **not** in this list, and that
       * is a finding rather than an omission: Electron's IPC structured-clones
       * its payload, so such an object throws in the renderer and never reaches
       * the channel at all. The type check in `isOpenable` is still what makes
       * the rule correct — `url.test.ts` proves it never calls `toString` — but
       * the transport turns out to refuse the case first.
       */
      for (const bad of [null, undefined, 42, true, ['https://example.com']]) {
        bridge.openLink(bad);
      }
      // And one good one last, so the channel is proved to be working at all —
      // otherwise every assertion above would pass on a disconnected wire.
      bridge.openLink('https://example.com/allowed');
    });

    await expect
      .poll(async () =>
        board.app.evaluate(() => (globalThis as unknown as { __opened: string[] }).__opened),
      )
      .toEqual(['https://example.com/allowed']);
  });
});

test('keeps six destinations legible and operable at the 380px floor', async () => {
  /*
   * SC-008 and FR-006, measured rather than eyeballed — and this is the
   * **six**-destination measurement feature 011 recorded as owed when it
   * measured five and held.
   *
   * Six requires a session that is every kind at once: a ticket, a reported
   * story for the tree, and a developer who opened the old views before the tree
   * arrived so they are kept. That is the widest the strip can ever be.
   */
  const { page } = board;

  const resize = async (width: number): Promise<number> => {
    const applied = await board.app.evaluate(({ BrowserWindow }, target) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.setContentSize(target, 700);
      return win?.getContentSize()[0] ?? target;
    }, width);
    await page.waitForFunction((expected) => window.innerWidth === expected, applied, {
      timeout: 5_000,
    });
    return applied;
  };

  await keepOldViews(board);
  await ticket();
  await report({ stories: [{ id: 'US1', title: 'A story' }] });

  const applied = await resize(380);
  // The requested width is not always the applied one — a fractional display
  // scale quantises to whole physical pixels. Assert what was actually applied,
  // or this measures a window that was never narrow.
  expect(applied, 'the window should be at or below the floor').toBeLessThanOrEqual(400);

  expect(await destinations()).toEqual([
    'Overview',
    'Ticket',
    'Spec-Kit',
    'Stories',
    'Tasks',
    'Notes',
  ]);

  // No horizontal scrolling on the page as a whole.
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

  /*
   * **The assertion that actually holds this**, and the one above is not a
   * substitute for it. A tab strip too wide for the window clips rather than
   * widening the document, so `scrollWidth` stays equal to `clientWidth` while a
   * destination sits off the right-hand edge — confirmed by giving each tab a
   * 120px floor and watching only this loop fail, at x + width = 488 in a 381px
   * window. Every label needs a real box, and that box has to be *inside* the
   * window.
   */
  for (const label of ['Overview', 'Ticket', 'Spec-Kit', 'Stories', 'Tasks', 'Notes']) {
    const tab = page.locator('.tabstrip__tab', { hasText: label });
    const box = await tab.boundingBox();
    expect(box, `${label} should have a box`).not.toBeNull();
    expect(box?.width ?? 0, `${label} should be wider than nothing`).toBeGreaterThan(8);
    expect((box?.x ?? 0) + (box?.width ?? 0), `${label} should be within the window`).toBeLessThanOrEqual(
      applied + 1,
    );
  }

  // And operable: each one still selects its view at this width.
  await page.getByTestId('tab-ticket').click();
  await expect(page.getByTestId('body')).toHaveAttribute('data-tab', 'ticket');
  await page.getByTestId('tab-notes').click();
  await expect(page.getByTestId('body')).toHaveAttribute('data-tab', 'notes');
});
