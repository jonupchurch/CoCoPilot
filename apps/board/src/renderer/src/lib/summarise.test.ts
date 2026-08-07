import type { ChangedFile, Focus, PlanStep, Task } from '@cocopilot/contract';
import { describe, expect, it } from 'vitest';

import {
  changedFilesSummary,
  focusSummary,
  formatChangedFiles,
  planSummary,
  specSummary,
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
