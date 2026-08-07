import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UNATTRIBUTED } from '../../src/main/store.js';
import { envelope, startTestService, type TestService } from '../helpers/service.js';

describe('POST /v1/push', () => {
  let service: TestService;

  beforeEach(async () => {
    service = await startTestService();
  });

  afterEach(async () => {
    await service.close();
  });

  it('accepts a report and answers with the arrival time it recorded', async () => {
    const before = Date.now();
    const response = await service.post('/v1/push', {
      ...envelope(),
      tasks: [{ id: 'T012', title: 'Wire the fetch', status: 'waiting on CI' }],
    });
    const after = Date.now();

    expect(response.status).toBe(200);
    const body = response.body as { ok: boolean; receivedAt: number };
    expect(body.ok).toBe(true);
    expect(body.receivedAt).toBeGreaterThanOrEqual(before);
    expect(body.receivedAt).toBeLessThanOrEqual(after);

    const session = service.store.getSession(process.cwd(), 'a1b2c3');
    expect(session?.report?.tasks[0]?.status).toBe('waiting on CI');
    expect(session?.report?.receivedAt).toBe(body.receivedAt);
  });

  it('uses its own clock, not one the client supplied', async () => {
    await service.close();
    service = await startTestService(() => 4_242);

    const response = await service.post('/v1/push', { ...envelope(), receivedAt: 999 });

    expect((response.body as { receivedAt: number }).receivedAt).toBe(4_242);
    expect(service.store.getSession(process.cwd(), 'a1b2c3')?.report?.receivedAt).toBe(4_242);
  });

  it('holds two repositories independently', async () => {
    await service.post('/v1/push', envelope({ repo: process.cwd() }));
    await service.post('/v1/push', envelope({ repo: import.meta.dirname }));

    expect(service.store.size).toBe(2);
  });

  it('attributes a push with no session id to the unattributed session', async () => {
    const body = envelope();
    delete body['sessionId'];

    const response = await service.post('/v1/push', body);

    expect(response.status).toBe(200);
    const session = service.store.getSession(process.cwd(), UNATTRIBUTED);
    expect(session?.attributed).toBe(false);
  });

  it('serves a report and a note on the same session', async () => {
    await service.post('/v1/push', envelope());
    await service.post('/v1/note', { ...envelope(), text: 'a note' });

    expect(service.store.size).toBe(1);
  });

  it('answers 404 for an unknown path and 405 for the wrong method', async () => {
    expect((await service.post('/v1/nope', envelope())).status).toBe(404);
    expect((await service.get('/v1/push')).status).toBe(405);
  });

  it('refuses a body that is not JSON', async () => {
    const response = await service.post('/v1/push', 'not json at all');

    expect(response.status).toBe(400);
    expect((response.body as { error: string }).error).toBe('invalid_json');
  });

  it('refuses a request that does not declare JSON', async () => {
    // Requiring the content type is what forces a browser to preflight, and
    // nothing here answers a preflight.
    const response = await service.post('/v1/push', envelope(), {
      headers: { 'content-type': 'text/plain' },
    });

    expect(response.status).toBe(415);
  });
});
