import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { envelope, startTestService, type TestService } from '../helpers/service.js';

function tasks(count: number): Array<Record<string, string>> {
  return Array.from({ length: count }, (_, index) => ({
    id: `T${String(index + 1).padStart(3, '0')}`,
    title: `Task ${index + 1}`,
    status: 'todo',
  }));
}

describe('POST /v1/push — replacement over the wire', () => {
  let service: TestService;

  beforeEach(async () => {
    service = await startTestService();
  });

  afterEach(async () => {
    await service.close();
  });

  it('replaces the held report wholesale', async () => {
    await service.post('/v1/push', {
      ...envelope(),
      feature: { id: '001', title: 'Push contract' },
      tasks: tasks(5),
    });
    await service.post('/v1/push', { ...envelope(), tasks: tasks(3) });

    const held = service.store.getSession(process.cwd(), 'a1b2c3')?.report;
    expect(held?.tasks).toHaveLength(3);
    expect(held?.feature).toBeNull();
  });

  it('leaves a different repository alone', async () => {
    await service.post('/v1/push', { ...envelope({ repo: process.cwd() }), tasks: tasks(5) });
    await service.post('/v1/push', {
      ...envelope({ repo: import.meta.dirname }),
      tasks: tasks(1),
    });

    expect(service.store.getSession(process.cwd(), 'a1b2c3')?.report?.tasks).toHaveLength(5);
    expect(service.store.getSession(import.meta.dirname, 'a1b2c3')?.report?.tasks).toHaveLength(1);
  });

  it('costs nothing to send the same report twice', async () => {
    const body = { ...envelope(), tasks: tasks(4) };

    await service.post('/v1/push', body);
    const first = structuredClone(service.store.getSession(process.cwd(), 'a1b2c3')?.report);
    await service.post('/v1/push', body);
    const second = service.store.getSession(process.cwd(), 'a1b2c3')?.report;

    expect(second?.tasks).toEqual(first?.tasks);
    expect(service.store.size).toBe(1);
  });
});
