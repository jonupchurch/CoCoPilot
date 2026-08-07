import { MAX_BODY_BYTES, MAX_TEXT } from '@cocoapilot/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { envelope, startTestService, type TestService } from '../helpers/service.js';

interface Rejection {
  ok: false;
  error: string;
  field: string;
  message: string;
}

const GOOD_REPORT = {
  feature: { id: '001', title: 'Push contract' },
  tasks: [{ id: 'T001', title: 'Hold a report', status: 'done' }],
};

/**
 * Held state is the only copy of what an agent has said — nothing re-derives it.
 * A bad report that corrupted or emptied a good session would destroy
 * information with no recovery path, so every case below re-reads the store and
 * insists it is unchanged (SC-003).
 */
describe('a bad request changes nothing', () => {
  let service: TestService;
  let held: string;

  beforeEach(async () => {
    service = await startTestService();
    await service.post('/v1/push', { ...envelope(), ...GOOD_REPORT });
    held = JSON.stringify(service.store.getSession(process.cwd(), 'a1b2c3'));
  });

  afterEach(async () => {
    await service.close();
  });

  const unchanged = (): void => {
    expect(JSON.stringify(service.store.getSession(process.cwd(), 'a1b2c3'))).toBe(held);
  };

  it('refuses a note one character over the cap, naming the field', async () => {
    const response = await service.post('/v1/note', {
      ...envelope(),
      text: 'x'.repeat(MAX_TEXT + 1),
    });

    expect(response.status).toBe(400);
    expect((response.body as Rejection).field).toBe('text');
    unchanged();
  });

  it('refuses 501 tasks, naming the collection', async () => {
    const response = await service.post('/v1/push', {
      ...envelope(),
      tasks: Array.from({ length: 501 }, (_, i) => ({
        id: `T${i}`,
        title: 'x',
        status: 'todo',
      })),
    });

    expect(response.status).toBe(400);
    expect((response.body as Rejection).field).toBe('tasks');
    unchanged();
  });

  it('refuses a repository path that does not exist', async () => {
    const response = await service.post('/v1/push', {
      ...envelope({ repo: 'D:\\this\\does\\not\\exist\\anywhere' }),
    });

    expect(response.status).toBe(400);
    expect((response.body as Rejection).field).toBe('repo');
    unchanged();
  });

  it('names the offending element of a collection, not just the collection', async () => {
    const response = await service.post('/v1/push', {
      ...envelope(),
      tasks: [
        { id: 'T001', title: 'fine', status: 'todo' },
        { id: 'T002', title: 'x'.repeat(201), status: 'todo' },
      ],
    });

    expect(response.status).toBe(400);
    expect((response.body as Rejection).field).toBe('tasks[1].title');
    unchanged();
  });

  it('refuses a body past the byte ceiling before parsing it', async () => {
    // The per-field caps do not bound a request on their own -- 500 tasks each
    // carrying 50 checks of 4,000 characters is legal by every individual cap.
    const response = await service.post('/v1/push', {
      ...envelope(),
      tasks: Array.from({ length: 400 }, (_, i) => ({
        id: `T${i}`,
        title: 'x',
        status: 'todo',
        checks: Array.from({ length: 20 }, () => 'y'.repeat(MAX_TEXT)),
      })),
    });

    expect(response.status).toBe(413);
    expect((response.body as Rejection).error).toBe('payload_too_large');
    expect((response.body as Rejection).message).toContain(String(MAX_BODY_BYTES));
    unchanged();
  });

  it('accepts an unknown key and quietly drops it, so a newer client degrades', async () => {
    const response = await service.post('/v1/push', {
      ...envelope(),
      ...GOOD_REPORT,
      somethingFromNextYear: { nested: true },
    });

    expect(response.status).toBe(200);
    expect(JSON.stringify(service.store.getSession(process.cwd(), 'a1b2c3'))).not.toContain(
      'somethingFromNextYear',
    );
  });

  it('ignores a client-supplied timestamp rather than treating it as an error', async () => {
    // A client sending one is confused, not hostile.
    const response = await service.post('/v1/push', {
      ...envelope(),
      ...GOOD_REPORT,
      receivedAt: 1,
    });

    expect(response.status).toBe(200);
    expect(service.store.getSession(process.cwd(), 'a1b2c3')?.report?.receivedAt).not.toBe(1);
  });

  it('stores markup verbatim, because escaping belongs at the point of display', async () => {
    const hostile = '<script>alert("x")</script> & <img onerror=1>';

    await service.post('/v1/push', {
      ...envelope(),
      focus: { note: hostile },
      tasks: [{ id: 'T001', title: hostile, status: hostile }],
    });
    await service.post('/v1/note', { ...envelope(), text: hostile });

    const session = service.store.getSession(process.cwd(), 'a1b2c3');
    expect(session?.report?.focus?.note).toBe(hostile);
    expect(session?.report?.tasks[0]?.title).toBe(hostile);
    expect(session?.notes[0]?.text).toBe(hostile);
  });

  it('every rejection carries a field a caller can act on', async () => {
    const bad: Array<[string, unknown]> = [
      ['/v1/push', { branch: 'main' }],
      ['/v1/push', { ...envelope(), tasks: 'not an array' }],
      ['/v1/push', { ...envelope(), focus: { chip: 'panicking' } }],
      ['/v1/note', { ...envelope() }],
      ['/v1/note', { ...envelope(), text: '' }],
    ];

    for (const [path, body] of bad) {
      const response = await service.post(path, body);
      expect(response.status, `${path} ${JSON.stringify(body)}`).toBe(400);
      const rejection = response.body as Rejection;
      expect(rejection.ok).toBe(false);
      expect(rejection.field).not.toBe('');
      expect(rejection.message).not.toBe('');
    }

    unchanged();
  });
});
