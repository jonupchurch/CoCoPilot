import { MAX_SESSIONS } from '@cocopilot/contract';
import { afterEach, describe, expect, it } from 'vitest';

import { startTestService, type TestService } from '../helpers/service.js';

const SESSIONS = 20;
const TASKS_PER_SESSION = 200;
const NOTES_PER_SESSION = 100;

let running: TestService[] = [];

async function start(): Promise<TestService> {
  const service = await startTestService();
  running.push(service);
  return service;
}

afterEach(async () => {
  const open = running;
  running = [];
  await Promise.all(open.map((service) => service.close()));
});

function tasks(count: number): Array<Record<string, string>> {
  return Array.from({ length: count }, (_, index) => ({
    id: `T${String(index + 1).padStart(3, '0')}`,
    title: `Task ${index + 1}`,
    status: index % 3 === 0 ? 'done' : 'waiting on CI',
  }));
}

describe('nothing survives a restart', () => {
  it('starts holding zero sessions after being populated and stopped', async () => {
    const first = await start();
    for (let index = 0; index < 3; index += 1) {
      await first.post('/v1/push', {
        repo: process.cwd(),
        branch: 'main',
        sessionId: `session-${index}`,
        tasks: tasks(5),
      });
      await first.post('/v1/note', {
        repo: process.cwd(),
        branch: 'main',
        sessionId: `session-${index}`,
        text: 'a note worth keeping',
      });
    }
    expect(first.store.size).toBe(3);

    await first.close();
    running = running.filter((service) => service !== first);

    const second = await start();

    // Emptiness is the default, not something cleaned up on startup. There is
    // nothing on disk to clear, which is why this passes for free.
    expect(second.store.size).toBe(0);
    expect(second.store.listSessions()).toEqual([]);
    expect(second.store.getSession(process.cwd(), 'session-0')).toBeUndefined();
  });
});

describe('scale', () => {
  it(
    `holds ${SESSIONS} sessions of ${TASKS_PER_SESSION} tasks and ${NOTES_PER_SESSION} notes`,
    async () => {
      const service = await start();
      const repo = process.cwd();

      for (let index = 0; index < SESSIONS; index += 1) {
        const response = await service.post('/v1/push', {
          repo,
          branch: `feat/branch-${index}`,
          sessionId: `session-${index}`,
          tasks: tasks(TASKS_PER_SESSION),
        });
        expect(response.status).toBe(200);
      }

      // The notes go through the store rather than 2,000 round trips. The route
      // that reaches this method is covered by note.test.ts; what is under test
      // here is that the store holds the volume without loss.
      for (let index = 0; index < SESSIONS; index += 1) {
        for (let n = 0; n < NOTES_PER_SESSION; n += 1) {
          const result = service.store.appendNote(
            {
              repo,
              branch: `feat/branch-${index}`,
              sessionId: `session-${index}`,
              text: `note ${n} for session ${index}`,
              source: null,
            },
            n,
          );
          expect(result.ok).toBe(true);
        }
      }

      expect(service.store.size).toBe(SESSIONS);
      for (let index = 0; index < SESSIONS; index += 1) {
        const session = service.store.getSession(repo, `session-${index}`);
        expect(session?.report?.tasks).toHaveLength(TASKS_PER_SESSION);
        expect(session?.notes).toHaveLength(NOTES_PER_SESSION);
        expect(session?.notes[0]?.text).toBe(`note 0 for session ${index}`);
        expect(session?.report?.tasks[TASKS_PER_SESSION - 1]?.id).toBe(
          `T${String(TASKS_PER_SESSION).padStart(3, '0')}`,
        );
      }

      // Well inside the backstop, which is the point: the cap is there for a
      // runaway client, not for anyone doing real work.
      expect(service.store.size).toBeLessThan(MAX_SESSIONS);
    },
    30_000,
  );
});
