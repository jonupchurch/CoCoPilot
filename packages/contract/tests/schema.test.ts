import { describe, expect, it } from 'vitest';

import { NoteRequest, PushRequest } from '../src/schema.js';

describe('PushRequest', () => {
  it('accepts a complete report', () => {
    const parsed = PushRequest.parse({
      repo: 'D:\\Codelib\\example',
      branch: 'feat/session-hook',
      sessionId: 'a1b2c3',
      feature: { id: '002', title: 'Share one session fetch', specPath: 'specs/002/spec.md' },
      stories: [{ id: 'US-002', title: 'A story', criteria: ['it works'], taskIds: ['T012'] }],
      tasks: [
        {
          id: 'T012',
          storyId: 'US-002',
          title: 'Wire the fetch',
          status: 'waiting on CI',
          checks: [],
          files: [],
        },
      ],
      plan: [{ text: 'Read the call sites', status: 'done' }],
      focus: { task: 'T012', note: 'blocked — the harness never sets the cookie', chip: 'needs-you' },
      changedFiles: [{ path: 'src/api/client.ts', change: 'modified', added: 21, removed: 18 }],
    });

    expect(parsed.feature?.title).toBe('Share one session fetch');
    expect(parsed.tasks[0]?.status).toBe('waiting on CI');
    expect(parsed.focus?.chip).toBe('needs-you');
    expect(parsed.changedFiles[0]?.added).toBe(21);
  });

  it('accepts an envelope alone — every field below it is optional', () => {
    const parsed = PushRequest.parse({ repo: 'D:\\Codelib\\example', branch: 'main' });

    expect(parsed.sessionId).toBeNull();
    expect(parsed.feature).toBeNull();
    expect(parsed.focus).toBeNull();
    expect(parsed.stories).toEqual([]);
    expect(parsed.tasks).toEqual([]);
    expect(parsed.plan).toEqual([]);
    expect(parsed.changedFiles).toEqual([]);
  });

  it('defaults the chip to thinking when a report omits it', () => {
    const parsed = PushRequest.parse({
      repo: 'D:\\Codelib\\example',
      branch: 'main',
      focus: { note: 'reading the call sites' },
    });

    expect(parsed.focus?.chip).toBe('thinking');
  });

  it('rejects a chip outside the closed set', () => {
    // The one enum in the payload, because it is how an agent asks for a human.
    const parsed = PushRequest.safeParse({
      repo: 'D:\\Codelib\\example',
      branch: 'main',
      focus: { chip: 'panicking' },
    });

    expect(parsed.success).toBe(false);
  });

  it('takes any status text, because status is not an enum', () => {
    const statuses = ['done', 'waiting on CI', 'blocked on review', 'ᕕ( ᐛ )ᕗ', ''];

    for (const status of statuses) {
      const parsed = PushRequest.safeParse({
        repo: 'D:\\Codelib\\example',
        branch: 'main',
        tasks: [{ id: 'T001', title: 'A task', status }],
      });
      expect(parsed.success, `status ${JSON.stringify(status)} should be accepted`).toBe(true);
    }
  });

  it('strips unknown keys instead of failing, so a newer client degrades', () => {
    const parsed = PushRequest.parse({
      repo: 'D:\\Codelib\\example',
      branch: 'main',
      somethingFromNextYear: { nested: true },
      tasks: [{ id: 'T001', title: 'A task', status: 'todo', futureField: 7 }],
    });

    expect(parsed).not.toHaveProperty('somethingFromNextYear');
    expect(parsed.tasks[0]).not.toHaveProperty('futureField');
    expect(parsed.tasks[0]?.id).toBe('T001');
  });

  it('discards a client-supplied timestamp rather than rejecting the request', () => {
    const parsed = PushRequest.parse({
      repo: 'D:\\Codelib\\example',
      branch: 'main',
      receivedAt: 1,
    });

    expect(parsed).not.toHaveProperty('receivedAt');
  });

  it('requires a repo and a branch', () => {
    expect(PushRequest.safeParse({ branch: 'main' }).success).toBe(false);
    expect(PushRequest.safeParse({ repo: 'D:\\x' }).success).toBe(false);
    expect(PushRequest.safeParse({ repo: '', branch: 'main' }).success).toBe(false);
  });
});

describe('NoteRequest', () => {
  it('accepts text with an optional source', () => {
    const parsed = NoteRequest.parse({
      repo: 'D:\\Codelib\\example',
      branch: 'main',
      text: 'The auth middleware expects a cookie the harness never sets.',
      source: 'you asked',
    });

    expect(parsed.source).toBe('you asked');
  });

  it('defaults source to null', () => {
    const parsed = NoteRequest.parse({ repo: 'D:\\x', branch: 'main', text: 'a note' });
    expect(parsed.source).toBeNull();
  });

  it('rejects an empty note', () => {
    expect(NoteRequest.safeParse({ repo: 'D:\\x', branch: 'main', text: '' }).success).toBe(false);
  });
});
