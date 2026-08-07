import type { Service } from '@cocopilot/board';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';

import { BOARD_ABSENT, DELIVERED } from '../../src/messages.js';
import { createMcpServer } from '../../src/mcp/server.js';
import { REPORT_TOOL } from '../../src/mcp/tools.js';
import { closedPort, startBoard } from '../helpers/harness.js';

let board: Service | undefined;

afterEach(async () => {
  await board?.close();
  board = undefined;
});

/**
 * Most people start working before they open a dashboard. If reports only
 * worked when the board happened to be open first, the feature would be
 * unreliable in the ordinary case.
 */
describe('a board opened after the session began', () => {
  it('receives the next report, with no restart of anything', async () => {
    // One port that is closed now and will hold the board shortly. The client
    // caches nothing, so it simply finds it on the next call.
    const port = await closedPort();

    const server = createMcpServer({ ports: [port], cwd: process.cwd(), sessionId: 'late-board' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    const before = await client.callTool({
      name: REPORT_TOOL,
      arguments: { task: 'T012', note: 'nothing listening yet' },
    });
    expect(textOf(before)).toBe(BOARD_ABSENT);

    board = await startBoardOn(port);

    const after = await client.callTool({
      name: REPORT_TOOL,
      arguments: { task: 'T012', note: 'and now there is' },
    });

    expect(textOf(after)).toBe(DELIVERED);
    expect(board.store.listSessions()).toHaveLength(1);
    expect(board.store.listSessions()[0]?.report?.focus?.note).toBe('and now there is');
  });

  it('follows the board when it moves to another port in the range', async () => {
    const first = await closedPort();
    const second = await closedPort();

    const server = createMcpServer({
      ports: [first, second],
      cwd: process.cwd(),
      sessionId: 'moving-board',
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    board = await startBoardOn(first);
    expect(textOf(await client.callTool({ name: REPORT_TOOL, arguments: { task: 'T1' } }))).toBe(
      DELIVERED,
    );

    await board.close();
    board = await startBoardOn(second);

    // No intervention, no restart, no cached port to invalidate.
    expect(textOf(await client.callTool({ name: REPORT_TOOL, arguments: { task: 'T2' } }))).toBe(
      DELIVERED,
    );
    expect(board.store.listSessions()[0]?.report?.focus?.task).toBe('T2');
  });
});

async function startBoardOn(port: number): Promise<Service> {
  const { createService } = await import('@cocopilot/board');
  return createService({ port });
}

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return content.map((part) => part.text ?? '').join('');
}
