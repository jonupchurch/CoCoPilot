#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createMcpServer } from './server.js';

/**
 * The `cocoapilot-mcp` binary.
 *
 * Starts unconditionally. Whether a board is running is not consulted here and
 * must not be — see the note in `server.ts`.
 */
await createMcpServer().connect(new StdioServerTransport());
