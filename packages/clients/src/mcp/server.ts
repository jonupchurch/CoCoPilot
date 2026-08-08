import { APP_VERSION } from 'cocoapilot-contract';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerTools, type ToolOptions } from './tools.js';

/**
 * The MCP server. **Nothing in this file touches the network.**
 *
 * This is the single most important behaviour in the feature and the easiest to
 * get wrong. A host discovers a server's tool list once, when a session starts.
 * A server that probes for the board during initialisation — and errors, or
 * exits, or hangs, because nothing is listening — leaves the agent with no
 * reporting ability for that entire session, *including* after the board is
 * opened two minutes later.
 *
 * So the tools come from static definitions, initialisation is offline, and
 * every tool call is an independent attempt at reaching the board.
 *
 * Kept free of the stdio transport on purpose: a module that connects a
 * transport when imported cannot be imported by a test, and the test that this
 * server starts with no board running is the one worth protecting most. The
 * binary is `main.ts`.
 */
export function createMcpServer(options: ToolOptions = {}): McpServer {
  const server = new McpServer(
    { name: 'cocoapilot', version: APP_VERSION },
    { capabilities: { tools: {} } },
  );

  registerTools(server, options);
  return server;
}
