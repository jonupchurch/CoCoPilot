import { describe, expect, it } from 'vitest';

import {
  MAX_CHANGED_FILES,
  MAX_CHECKS,
  MAX_CRITERIA,
  MAX_FILES,
  MAX_LABEL,
  MAX_PATH,
  MAX_PLAN_STEPS,
  MAX_STORIES,
  MAX_TASK_IDS,
  MAX_TASKS,
  MAX_TEXT,
} from '../src/caps.js';
import { NoteRequest, PushRequest } from '../src/schema.js';

const chars = (count: number): string => 'x'.repeat(count);
const items = <T>(count: number, make: (index: number) => T): T[] =>
  Array.from({ length: count }, (_, index) => make(index));

const task = (status = 'todo'): Record<string, unknown> => ({
  id: 'T001',
  title: 'A task',
  status,
});

const story = (): Record<string, unknown> => ({ id: 'US-001', title: 'A story' });

function push(overrides: Record<string, unknown>): Record<string, unknown> {
  return { repo: 'D:\\Codelib\\example', branch: 'main', ...overrides };
}

/**
 * Every cap accepts exactly the limit and refuses one past it.
 *
 * The refusal matters more than the limit: FR-011 rejects rather than
 * truncating, because silently shortening an agent's prose would put words on
 * the board that nobody wrote.
 */
describe('length caps', () => {
  const cases: Array<[string, number, (value: string) => Record<string, unknown>]> = [
    ['branch (label)', MAX_LABEL, (v) => push({ branch: v })],
    ['sessionId (label)', MAX_LABEL, (v) => push({ sessionId: v })],
    ['repo (path)', MAX_PATH, (v) => push({ repo: v })],
    ['task.status (label)', MAX_LABEL, (v) => push({ tasks: [task(v)] })],
    ['task.detail (text)', MAX_TEXT, (v) => push({ tasks: [{ ...task(), detail: v }] })],
    ['task.files[] (path)', MAX_PATH, (v) => push({ tasks: [{ ...task(), files: [v] }] })],
    ['story.want (text)', MAX_TEXT, (v) => push({ stories: [{ ...story(), want: v }] })],
    ['plan.text (text)', MAX_TEXT, (v) => push({ plan: [{ text: v, status: 'done' }] })],
    ['focus.note (text)', MAX_TEXT, (v) => push({ focus: { note: v } })],
    ['changedFiles.path (path)', MAX_PATH, (v) => push({ changedFiles: [{ path: v, change: 'M' }] })],
  ];

  for (const [name, cap, build] of cases) {
    it(`accepts ${name} at ${cap} and refuses ${cap + 1}`, () => {
      expect(PushRequest.safeParse(build(chars(cap))).success).toBe(true);
      expect(PushRequest.safeParse(build(chars(cap + 1))).success).toBe(false);
    });
  }

  it(`accepts a note of ${MAX_TEXT} characters and refuses ${MAX_TEXT + 1}`, () => {
    const note = (text: string): unknown => ({ repo: 'D:\\x', branch: 'main', text });
    expect(NoteRequest.safeParse(note(chars(MAX_TEXT))).success).toBe(true);
    expect(NoteRequest.safeParse(note(chars(MAX_TEXT + 1))).success).toBe(false);
  });
});

describe('collection caps', () => {
  const cases: Array<[string, number, (count: number) => Record<string, unknown>]> = [
    ['tasks', MAX_TASKS, (n) => push({ tasks: items(n, () => task()) })],
    ['stories', MAX_STORIES, (n) => push({ stories: items(n, () => story()) })],
    ['plan', MAX_PLAN_STEPS, (n) => push({ plan: items(n, () => ({ text: 'a', status: 'b' })) })],
    [
      'changedFiles',
      MAX_CHANGED_FILES,
      (n) => push({ changedFiles: items(n, () => ({ path: 'a', change: 'M' })) }),
    ],
    [
      'story.criteria',
      MAX_CRITERIA,
      (n) => push({ stories: [{ ...story(), criteria: items(n, () => 'c') }] }),
    ],
    [
      'story.taskIds',
      MAX_TASK_IDS,
      (n) => push({ stories: [{ ...story(), taskIds: items(n, () => 'T001') }] }),
    ],
    ['task.checks', MAX_CHECKS, (n) => push({ tasks: [{ ...task(), checks: items(n, () => 'c') }] })],
    ['task.files', MAX_FILES, (n) => push({ tasks: [{ ...task(), files: items(n, () => 'f') }] })],
  ];

  for (const [name, cap, build] of cases) {
    it(`accepts ${cap} ${name} and refuses ${cap + 1}`, () => {
      expect(PushRequest.safeParse(build(cap)).success).toBe(true);
      expect(PushRequest.safeParse(build(cap + 1)).success).toBe(false);
    });
  }
});
