import { createServer, type Server } from 'node:http';

import { APP_NAME, CONTRACT_VERSION, isCoCoPilotHealth } from '@cocopilot/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { envelope, startTestService, type TestService } from '../helpers/service.js';

describe('GET /v1/health', () => {
  let service: TestService;

  beforeEach(async () => {
    service = await startTestService();
  });

  afterEach(async () => {
    await service.close();
  });

  it('names the application, its version and the contract', async () => {
    const response = await service.get('/v1/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ app: APP_NAME, contract: CONTRACT_VERSION });
    expect((response.body as { version: string }).version).not.toBe('');
  });

  it('satisfies the guard a probing client uses', async () => {
    const response = await service.get('/v1/health');
    expect(isCoCoPilotHealth(response.body)).toBe(true);
  });

  it('needs no body, and answers before anything has been pushed', async () => {
    expect(service.store.size).toBe(0);
    expect((await service.get('/v1/health')).status).toBe(200);
  });

  it('refuses a POST', async () => {
    expect((await service.post('/v1/health', envelope())).status).toBe(405);
  });
});

describe('a client probing the range', () => {
  let stub: Server;
  let stubPort: number;

  beforeEach(async () => {
    // Unrelated local software that answers 200 to anything.
    stub = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
    await new Promise<void>((resolve) => {
      stub.listen({ host: '127.0.0.1', port: 0 }, resolve);
    });
    const address = stub.address();
    stubPort = typeof address === 'object' && address !== null ? address.port : 0;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      stub.close(() => {
        resolve();
      });
      stub.closeAllConnections();
    });
  });

  it('does not accept a 200 from something that is not the board', async () => {
    // This is the failure the health endpoint exists to prevent: without the
    // payload check a client would post an agent's prompt text into whatever
    // program happened to hold the port.
    const response = await fetch(`http://127.0.0.1:${stubPort}/v1/health`);

    expect(response.status).toBe(200);
    expect(isCoCoPilotHealth(await response.json())).toBe(false);
  });
});
