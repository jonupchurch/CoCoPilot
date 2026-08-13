import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { BOARD_ABSENT } from '../../src/messages.js';
import { createMcpServer } from '../../src/mcp/server.js';
import { NOTE_TOOL, REPORT_TOOL, TICKET_TOOL } from '../../src/mcp/tools.js';
import { closedPort } from '../helpers/harness.js';

/**
 * The scenario the quickstart says to run first, because its failure is
 * invisible in every other test.
 *
 * If the server reaches for the board during initialisation, an agent session
 * started before the board is opened has no reporting tools at all — for the
 * whole session, including after the board appears. Everything else here would
 * still pass.
 */
describe('the MCP server with no board running anywhere', () => {
  let ports: number[];
  let fetchSpy: MockInstance<typeof globalThis.fetch>;

  beforeEach(async () => {
    ports = [await closedPort(), await closedPort()];
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  async function connect(): Promise<Client> {
    const server = createMcpServer({ ports, cwd: process.cwd(), sessionId: 'test-session' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test', version: '0.0.0' });
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    return client;
  }

  it('initialises and lists all three tools', async () => {
    // A counting assertion, and the kind that should have to be edited on
    // purpose: a tool appearing here is new agent-facing surface, and it should
    // not be possible to add one without saying so in a test.
    const client = await connect();

    const names = (await client.listTools()).tools.map((tool) => tool.name).sort();
    expect(names).toEqual([NOTE_TOOL, REPORT_TOOL, TICKET_TOOL]);
  });

  it('makes no network call while starting up or listing tools', async () => {
    // The assertion that actually protects the behaviour. Registering tools and
    // answering tools/list must both be entirely offline.
    const client = await connect();
    await client.listTools();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('answers a report with the board-absent message rather than failing', async () => {
    const client = await connect();

    const result = await client.callTool({
      name: REPORT_TOOL,
      arguments: { task: 'T012', note: 'trying anyway', chip: 'thinking' },
    });

    expect(textOf(result)).toBe(BOARD_ABSENT);
    // Not flagged as an error: a host presenting this as a tool failure is what
    // sends an agent investigating something that is not its problem.
    expect(result.isError).toBeFalsy();
  });

  it('answers a note the same way', async () => {
    const client = await connect();

    const result = await client.callTool({
      name: NOTE_TOOL,
      arguments: { text: 'a note with nowhere to go' },
    });

    expect(textOf(result)).toBe(BOARD_ABSENT);
  });

  it('answers a ticket the same way', async () => {
    const client = await connect();

    const result = await client.callTool({
      name: TICKET_TOOL,
      arguments: { ticket: { key: 'PROJ-1', title: 'A ticket with nowhere to go' } },
    });

    expect(textOf(result)).toBe(BOARD_ABSENT);
    expect(result.isError).toBeFalsy();
  });

  it('describes what an agent cannot infer from each schema', async () => {
    const client = await connect();
    const tools = (await client.listTools()).tools;

    const report = tools.find((tool) => tool.name === REPORT_TOOL);
    expect(report?.description).toContain('needs-you');
    expect(report?.description).toMatch(/replaces/i);

    const note = tools.find((tool) => tool.name === NOTE_TOOL);
    expect(note?.description).toMatch(/cleared/i);
    expect(note?.description).toMatch(/not storage/i);

    // The three for the ticket: report it once rather than per update, flatten
    // to plain text first, and say how many comments were left out. The last is
    // the one the board cannot derive for itself.
    const ticket = tools.find((tool) => tool.name === TICKET_TOOL);
    expect(ticket?.description).toMatch(/once/i);
    expect(ticket?.description).toMatch(/plain text/i);
    expect(ticket?.description).toMatch(/commentsOmitted/);
    // And it must not invite the agent to build an address of its own.
    expect(ticket?.description).toMatch(/never construct/i);
  });

  it('exposes no identity parameters for a model to get wrong', async () => {
    const client = await connect();
    const tools = (await client.listTools()).tools;

    for (const tool of tools) {
      const properties = Object.keys(
        (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {},
      );
      expect(properties).not.toContain('repo');
      expect(properties).not.toContain('branch');
      expect(properties).not.toContain('sessionId');
    }
  });
});

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return content.map((part) => part.text ?? '').join('');
}
