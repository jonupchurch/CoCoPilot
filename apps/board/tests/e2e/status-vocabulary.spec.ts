import { expect, test, type Locator } from '@playwright/test';

import { envelope, launchBoard, type Board } from './board.js';

/**
 * One vocabulary, asserted identically everywhere a status is drawn.
 *
 * The failure this exists to catch is not a wrong colour — it is a *divergence*.
 * Two surfaces each deciding what `wip` means agree on the day the second one is
 * written and drift the first time a synonym is added, and the symptom is one
 * status shown two ways on two tabs, which nobody sees because nobody looks at
 * two tabs at once. So the assertion is a comparison rather than a table of
 * expectations: every surface must produce the same reading of the same report.
 *
 * `tests/source-hygiene.test.ts` forbids the second mapping from being written;
 * this proves the one mapping reaches the screen intact.
 *
 * Adding a surface means adding one entry to `SURFACES`.
 */

let board: Board;

test.beforeEach(async () => {
  board = await launchBoard();
  // Wide enough for the side-by-side story arrangement. This spec is about what
  // the vocabulary renders as, not where; the breakpoint has its own.
  await board.app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
  });
});

test.afterEach(async () => {
  await board.close();
});

interface Case {
  /** Exactly what the agent reported. */
  reported: string;
  /** What the board is willing to claim about it. */
  vocabulary: 'todo' | 'active' | 'blocked' | 'done' | 'unrecognised';
  why: string;
}

const MATRIX: readonly Case[] = [
  { reported: 'done', vocabulary: 'done', why: 'the documented term itself' },
  { reported: 'completed', vocabulary: 'done', why: 'a documented synonym' },
  { reported: 'in progress', vocabulary: 'active', why: 'a synonym with a space in it' },
  { reported: 'wip', vocabulary: 'active', why: 'an abbreviation agents actually write' },
  { reported: 'blocked', vocabulary: 'blocked', why: 'the one status that is a warning' },
  { reported: 'queued', vocabulary: 'todo', why: 'a synonym for not started' },
  { reported: '  DONE  ', vocabulary: 'done', why: 'case and surrounding space are ignored' },
  { reported: 'donee', vocabulary: 'unrecognised', why: 'no near matching: a typo is not done' },
  {
    reported: 'blocked by review',
    vocabulary: 'unrecognised',
    why: 'no prefix matching: this is a sentence, not the term',
  },
  {
    reported: 'ждём ревью',
    vocabulary: 'unrecognised',
    why: 'an agent describing its work in its own language',
  },
];

/** `T-00`…`T-09`, so a row can be found by its case rather than its content. */
function taskId(index: number): string {
  return `T-${String(index).padStart(2, '0')}`;
}

const REPORT = {
  stories: [{ id: 'US-001', title: 'Every status the board might be sent' }],
  tasks: MATRIX.map((probe, index) => ({
    id: taskId(index),
    title: probe.why,
    status: probe.reported,
    storyId: 'US-001',
  })),
  plan: MATRIX.map((probe) => ({ text: probe.why, status: probe.reported })),
};

interface Surface {
  name: string;
  /** Put this surface on screen, from a freshly launched board. */
  open: () => Promise<void>;
  /** The row drawing the case at this index. */
  row: (index: number) => Locator;
}

const SURFACES: readonly Surface[] = [
  {
    name: 'the tasks of the Spec section, on Overview',
    // Each surface navigates to itself rather than assuming what the previous
    // one left on screen, so the list can be reordered or read one at a time.
    open: async () => {
      await board.page.getByTestId('tab-overview').click();
      await expect(board.page.getByTestId('section-spec')).toBeVisible();
    },
    row: (index) => board.page.getByTestId(`task-${taskId(index)}`),
  },
  {
    name: 'the steps of the Plan section, on Overview',
    open: async () => {
      await board.page.getByTestId('tab-overview').click();
      await expect(board.page.getByTestId('section-plan')).toBeVisible();
    },
    row: (index) => board.page.getByTestId(`plan-step-${index}`),
  },
  {
    name: "a story's tasks, on Stories",
    open: async () => {
      await board.page.getByTestId('tab-stories').click();
      await expect(board.page.getByTestId('stories')).toBeVisible();
    },
    row: (index) => board.page.getByTestId(`story-task-${taskId(index)}`),
  },
  {
    name: 'the task list, on Tasks',
    open: async () => {
      await board.page.getByTestId('tab-tasks').click();
      await expect(board.page.getByTestId('tasks')).toBeVisible();
    },
    row: (index) => board.page.getByTestId(`task-row-${taskId(index)}`),
  },
];

/**
 * What one surface makes of the report: the disc's reading, the label's reading
 * and the text it kept, per case.
 *
 * Returned as strings so a mismatch prints the whole matrix side by side rather
 * than `expected true, got false` on whichever case happened to be checked
 * first.
 */
async function read(surface: Surface): Promise<string[]> {
  await surface.open();

  const readings: string[] = [];
  for (const [index, probe] of MATRIX.entries()) {
    const row = surface.row(index);
    await expect(row).toHaveCount(1);

    const disc = row.locator('.disc');
    const label = row.locator('.status');

    readings.push(
      [
        JSON.stringify(probe.reported),
        `disc=${await disc.getAttribute('data-vocabulary')}`,
        `label=${await label.getAttribute('data-vocabulary')}`,
        // The raw string, from `title` rather than text: HTML collapses the
        // spaces around `  DONE  ` when it draws it, and the reported value is
        // what must survive.
        `text=${JSON.stringify(await label.getAttribute('title'))}`,
      ].join(' '),
    );
  }

  return readings;
}

test.describe('the status vocabulary', () => {
  test.beforeEach(async () => {
    await board.push({ ...envelope(), ...REPORT });
    await expect(board.page.getByTestId('overview')).toBeVisible();
  });

  test('classifies each reported status as documented, and keeps its text', async () => {
    const expected = MATRIX.map(
      (probe) =>
        [
          JSON.stringify(probe.reported),
          `disc=${probe.vocabulary}`,
          `label=${probe.vocabulary}`,
          `text=${JSON.stringify(probe.reported)}`,
        ].join(' '),
      // A recognised status is never replaced by its canonical form: an agent
      // that wrote `wip` gets `wip` back, coloured as active. Substituting
      // `active` would put a word on screen that nobody wrote.
    );

    expect(await read(SURFACES[0] as Surface)).toEqual(expected);
  });

  test('reads the same on every surface that draws one', async () => {
    // The point of the whole file. A divergence fails here rather than being
    // noticed by a developer with two tabs open a month from now.
    const [first, ...rest] = SURFACES;
    const reference = await read(first as Surface);

    for (const surface of rest) {
      // Named in the message because the diff alone does not say which surface
      // disagreed.
      expect(await read(surface), `${surface.name} disagrees`).toEqual(reference);
    }
  });

  test('draws no disc at all for a status it does not understand', async () => {
    // An outline circle is the `todo` treatment, and it claims "not started" —
    // which is a statement about a string the board cannot read. The slot keeps
    // its width so rows stay aligned; the text carries the whole meaning.
    const unknown = board.page.getByTestId('task-T-07').locator('.disc');

    await expect(unknown).toHaveAttribute('data-vocabulary', 'unrecognised');
    await expect(unknown).toHaveText('');
    await expect(board.page.getByTestId('task-T-00').locator('.disc')).toHaveText('✓');
  });

  test("gives a story's own status the same treatment as its tasks'", async () => {
    await board.push({
      ...envelope(),
      ...REPORT,
      stories: [{ id: 'US-001', title: 'One story', status: '  DONE  ' }],
    });
    await board.page.getByTestId('tab-stories').click();

    for (const status of [
      board.page.getByTestId('story-list').locator('.status').first(),
      board.page.getByTestId('story-detail').locator('.storydetail__meta .status'),
    ]) {
      await expect(status).toHaveAttribute('data-vocabulary', 'done');
      await expect(status).toHaveAttribute('title', '  DONE  ');
    }
  });
});

test.describe('a status far longer than the panel', () => {
  test('truncates it and keeps the whole of it retrievable', async () => {
    // FR-009. `only-reported.spec.ts` covers this for the Overview task row;
    // this is the same requirement on the tab that did not exist then.
    const long = 'S'.repeat(200);

    await board.app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]?.setSize(900, 700);
    });
    await board.push({
      ...envelope(),
      stories: [{ id: 'US-001', title: 'One story', status: long }],
      tasks: [{ id: 'T-01', title: 'One task', status: long, storyId: 'US-001' }],
    });
    await board.page.getByTestId('tab-stories').click();

    const status = board.page.getByTestId('story-task-T-01').locator('.status');
    await expect(status).toHaveAttribute('title', long);

    // Truncated rather than wrapped or overflowing: the box is narrower than the
    // text in it, which is what the ellipsis is drawn from.
    const clipped = await status.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(clipped).toBe(true);

    // And nothing it sits in scrolls sideways because of it.
    const overflow = await board.page.evaluate(() => {
      const el = document.querySelector('.app__body');
      return {
        body: document.body.scrollWidth - document.body.clientWidth,
        panel: el === null ? 0 : el.scrollWidth - el.clientWidth,
      };
    });
    expect(overflow.body).toBeLessThanOrEqual(0);
    expect(overflow.panel).toBeLessThanOrEqual(0);
  });
});
