import type { ChangedFile, Focus, PlanStep, Task } from '@cocoapilot/contract';
import { describe, expect, it } from 'vitest';

import {
  changedFilesSummary,
  focusSummary,
  formatChangedFiles,
  formatTokens,
  planSummary,
  specSummary,
  taskSummary,
} from './summarise.js';

const task = (id: string, status: string): Task => ({
  id,
  storyId: null,
  title: `Task ${id}`,
  status,
  detail: null,
  checks: [],
  files: [],
});

const step = (status: string): PlanStep => ({ text: `A ${status} step`, status, detail: null });

const file = (overrides: Partial<ChangedFile> = {}): ChangedFile => ({
  path: 'src/api/client.ts',
  change: 'modified',
  added: null,
  removed: null,
  note: null,
  ...overrides,
});

const focus = (overrides: Partial<Focus> = {}): Focus => ({
  task: null,
  note: null,
  chip: 'thinking',
  ...overrides,
});

describe('focusSummary', () => {
  it('names the task and how long ago it was reported', () => {
    expect(focusSummary(focus({ task: 'T-013' }), 0, 240_000)).toBe('T-013 · 4m');
  });

  it('reads "now" for the first minute rather than counting seconds', () => {
    expect(focusSummary(focus({ task: 'T-013' }), 0, 0)).toBe('T-013 · now');
    expect(focusSummary(focus({ task: 'T-013' }), 0, 40_000)).toBe('T-013 · now');
  });

  it('says so when no current task was reported', () => {
    expect(focusSummary(null, 0, 0)).toBe('none reported');
    expect(focusSummary(focus(), 0, 0)).toBe('none reported');
    expect(focusSummary(focus({ task: '   ' }), 0, 0)).toBe('none reported');
  });

  it('drops the elapsed part rather than inventing one when nothing was reported', () => {
    expect(focusSummary(focus({ task: 'T-013' }), null, 5_000)).toBe('T-013');
  });
});

describe('specSummary', () => {
  const feature = { id: 'US-002', title: 'Share one session fetch', specPath: null };

  it('carries the identifier and the completion count', () => {
    expect(specSummary(feature, [task('T-011', 'done'), task('T-012', 'todo')])).toBe(
      'US-002 · 1 of 2 done',
    );
  });

  it('counts only statuses it recognises as done', () => {
    // `donee` is a near miss and must not be counted; `Completed` must be.
    const tasks = [task('a', 'Completed'), task('b', 'donee'), task('c', 'waiting on CI')];
    expect(specSummary(null, tasks)).toBe('1 of 3 done');
  });

  it('handles a feature with no tasks and tasks with no feature', () => {
    expect(specSummary(feature, [])).toBe('US-002');
    expect(specSummary(null, [task('a', 'done')])).toBe('1 of 1 done');
  });

  it('reports nothing at all when there is nothing to report', () => {
    expect(specSummary(null, [])).toBe('');
  });

  it('stays true to the list at 500 tasks', () => {
    const many = Array.from({ length: 500 }, (_, i) => task(`T${i}`, i < 137 ? 'done' : 'todo'));
    expect(specSummary(null, many)).toBe('137 of 500 done');
  });
});

describe('taskSummary', () => {
  it('counts the done ones against the total', () => {
    expect(taskSummary([task('a', 'done'), task('b', 'todo'), task('c', 'wip')])).toBe('1/3');
  });

  it('recognises done the same way every other count does', () => {
    // The whole reason this lives beside the other summaries: three components
    // draw it, and a second definition would disagree the first time a synonym
    // is added.
    expect(taskSummary([task('a', 'Completed'), task('b', 'donee')])).toBe('1/2');
  });

  it('says there are none rather than reading 0/0', () => {
    // `0/0` is a fraction of nothing, and reads for a moment as a story whose
    // tasks are all outstanding.
    expect(taskSummary([])).toBe('no tasks');
  });
});

describe('planSummary', () => {
  it('states position while a step is active', () => {
    expect(planSummary([step('done'), step('in progress'), step('todo')])).toEqual({
      text: 'Step 2 of 3',
      active: true,
    });
  });

  it('falls back to completion when no step is active', () => {
    // "Step 3 of 4" with nothing in progress would claim a position no reported
    // step supports.
    expect(planSummary([step('done'), step('done'), step('todo')])).toEqual({
      text: '2 of 3 done',
      active: false,
    });
  });

  it('takes the first active step when several claim to be', () => {
    expect(planSummary([step('todo'), step('wip'), step('active')]).text).toBe('Step 2 of 3');
  });

  it('does not read a position out of an unrecognised status', () => {
    expect(planSummary([step('halfway'), step('nearly')])).toEqual({
      text: '0 of 2 done',
      active: false,
    });
  });
});

describe('changedFilesSummary', () => {
  it('sums the counts that were sent', () => {
    const summary = changedFilesSummary([
      file({ added: 48 }),
      file({ added: 21, removed: 18 }),
      file({ added: 17, removed: 13 }),
    ]);

    expect(summary).toEqual({ files: 3, added: 86, removed: 31 });
    expect(formatChangedFiles(summary)).toBe('+86 −31');
  });

  it('distinguishes a reported zero from nothing reported', () => {
    expect(changedFilesSummary([file({ added: 0, removed: 0 })])).toEqual({
      files: 1,
      added: 0,
      removed: 0,
    });
    expect(changedFilesSummary([file()])).toEqual({ files: 1, added: null, removed: null });
  });

  it('falls back to the file count when no line counts were sent', () => {
    expect(formatChangedFiles(changedFilesSummary([file(), file()]))).toBe('2 files');
    expect(formatChangedFiles(changedFilesSummary([file()]))).toBe('1 file');
  });

  it('shows the half it was given when only one side was reported', () => {
    expect(formatChangedFiles(changedFilesSummary([file({ added: 9 })]))).toBe('+9');
    expect(formatChangedFiles(changedFilesSummary([file({ removed: 4 })]))).toBe('−4');
  });
});

describe('formatTokens', () => {
  it('writes a small count as itself', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(840)).toBe('840');
    expect(formatTokens(999)).toBe('999');
  });

  it('writes thousands with one decimal, as the export does', () => {
    expect(formatTokens(1_000)).toBe('1.0k');
    expect(formatTokens(12_400)).toBe('12.4k');
    expect(formatTokens(9_990)).toBe('9.9k');
  });

  it('drops the decimal past six figures', () => {
    expect(formatTokens(10_000)).toBe('10.0k');
    expect(formatTokens(99_999)).toBe('99.9k');
    expect(formatTokens(100_000)).toBe('100k');
    expect(formatTokens(292_835)).toBe('292k');
  });

  it('never rounds up to a figure the count has not reached', () => {
    // 999 must not read as 1.0k, and 99,999 must not read as 100k: a number
    // below a round one should always look below it.
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(99_999)).toBe('99.9k');
    expect(formatTokens(999_999)).toBe('999k');
  });
});
