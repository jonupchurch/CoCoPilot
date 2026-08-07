import { describe, expect, it } from 'vitest';

import { fieldPath, rejectionFromZodError } from '../src/errors.js';
import { PushRequest } from '../src/schema.js';

describe('fieldPath', () => {
  it('renders a path the way a developer would write it', () => {
    expect(fieldPath(['tasks', 3, 'title'])).toBe('tasks[3].title');
    expect(fieldPath(['repo'])).toBe('repo');
    expect(fieldPath(['stories', 0, 'criteria', 2])).toBe('stories[0].criteria[2]');
    expect(fieldPath([])).toBe('(body)');
  });
});

describe('rejectionFromZodError', () => {
  it('names the offending field so a caller can fix the request without our source', () => {
    const parsed = PushRequest.safeParse({
      repo: 'D:\\Codelib\\example',
      branch: 'main',
      tasks: [
        { id: 'T001', title: 'ok', status: 'todo' },
        { id: 'T002', title: 'ok', status: 'todo' },
        { id: 'T003', title: 'ok', status: 'todo' },
        { id: 'T004', title: 'x'.repeat(201), status: 'todo' },
      ],
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const rejection = rejectionFromZodError(parsed.error);
    expect(rejection.ok).toBe(false);
    expect(rejection.error).toBe('invalid_field');
    expect(rejection.field).toBe('tasks[3].title');
    expect(rejection.message).toMatch(/200/);
  });

  it('always populates a field, even for a wholly wrong body', () => {
    const parsed = PushRequest.safeParse('not an object at all');
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(rejectionFromZodError(parsed.error).field).not.toBe('');
  });

  it('names a missing required field', () => {
    const parsed = PushRequest.safeParse({ branch: 'main' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(rejectionFromZodError(parsed.error).field).toBe('repo');
  });
});
