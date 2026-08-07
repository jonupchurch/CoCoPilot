import { MAX_NOTES_PER_SESSION } from '@cocopilot/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UNATTRIBUTED } from '../../src/main/store.js';
import { envelope, startTestService, type TestService } from '../helpers/service.js';

describe('POST /v1/note', () => {
  let service: TestService;

  beforeEach(async () => {
    service = await startTestService();
  });

  afterEach(async () => {
    await service.close();
  });

  const session = () => service.store.getSession(process.cwd(), 'a1b2c3');

  it('appends three notes in order', async () => {
    for (const text of ['first', 'second', 'third']) {
      const response = await service.post('/v1/note', { ...envelope(), text });
      expect(response.status).toBe(200);
    }

    expect(session()?.notes.map((n) => n.text)).toEqual(['first', 'second', 'third']);
  });

  it('creates the session with no report when a note arrives first', async () => {
    await service.post('/v1/note', { ...envelope(), text: 'before anything was reported' });

    expect(session()?.report).toBeNull();
    expect(session()?.notes).toHaveLength(1);
  });

  it('survives a report replacing the reported state', async () => {
    await service.post('/v1/note', { ...envelope(), text: 'keep me', source: 'you asked' });
    await service.post('/v1/push', {
      ...envelope(),
      tasks: [{ id: 'T001', title: 'x', status: 'todo' }],
    });

    expect(session()?.notes.map((n) => n.text)).toEqual(['keep me']);
    expect(session()?.report?.tasks).toHaveLength(1);
  });

  it('does not disturb the reported state', async () => {
    await service.post('/v1/push', {
      ...envelope(),
      feature: { id: '001', title: 'Push contract' },
    });
    const before = structuredClone(session()?.report);

    await service.post('/v1/note', { ...envelope(), text: 'a note' });

    expect(session()?.report).toEqual(before);
  });

  it('carries the reason the agent gave for recording it', async () => {
    await service.post('/v1/note', { ...envelope(), text: 'a note', source: 'you asked' });
    expect(session()?.notes[0]?.source).toBe('you asked');
  });

  it('stamps its own arrival time', async () => {
    await service.close();
    service = await startTestService(() => 4_242);

    await service.post('/v1/note', { ...envelope(), text: 'a note', receivedAt: 1 });

    expect(session()?.notes[0]?.receivedAt).toBe(4_242);
  });

  it('goes to the unattributed session when no session id is supplied', async () => {
    const body = envelope();
    delete body['sessionId'];

    await service.post('/v1/note', { ...body, text: 'from a hook' });

    const unattributed = service.store.getSession(process.cwd(), UNATTRIBUTED);
    expect(unattributed?.attributed).toBe(false);
    expect(unattributed?.notes).toHaveLength(1);
  });

  it(`refuses note ${MAX_NOTES_PER_SESSION + 1} rather than dropping the oldest`, async () => {
    // Driven through the store rather than the wire: a thousand round trips
    // would prove nothing the store test does not already prove, and the point
    // here is the status code the route maps that refusal to.
    for (let index = 0; index < MAX_NOTES_PER_SESSION; index += 1) {
      service.store.appendNote(
        { repo: process.cwd(), branch: 'main', sessionId: 'a1b2c3', text: `note ${index}`, source: null },
        index,
      );
    }

    const response = await service.post('/v1/note', { ...envelope(), text: 'one too many' });

    expect(response.status).toBe(409);
    expect((response.body as { error: string }).error).toBe('note_limit');
    expect(session()?.notes).toHaveLength(MAX_NOTES_PER_SESSION);
    expect(session()?.notes[0]?.text).toBe('note 0');
  });
});
