import {
  ChangedFile,
  CHIPS,
  MAX_CHANGED_FILES,
  MAX_PLAN_STEPS,
  MAX_STORIES,
  MAX_TASKS,
  PlanStep,
  ReportedFeature,
  Story,
  Task,
  Ticket,
} from 'cocoapilot-contract';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { note, report, ticket, type ClientResult } from '../client.js';
import { processSessionId } from '../identity.js';
import type { SendOptions } from '../transport.js';

export const REPORT_TOOL = 'cocoapilot_report';
export const NOTE_TOOL = 'cocoapilot_note';
export const TICKET_TOOL = 'cocoapilot_ticket';

/**
 * Two facts an agent cannot infer from the schema, and behaves wrongly without,
 * no matter how correct the code is (FR-019). They are in the descriptions
 * because that is the only place the model will read them.
 */
export const REPORT_DESCRIPTION = [
  'Report what you are working on right now, for a human watching the CoCoapilot board.',
  '',
  'This REPLACES your previous report entirely — send the whole current picture, not a delta.',
  'Set chip to "needs-you" when you want the human to look: it is the only way to ask for',
  'their attention, and the board will never decide on its own that you are stuck.',
  '',
  'Repository, branch and session identity are filled in for you. Do not ask for them.',
].join('\n');

export const NOTE_DESCRIPTION = [
  'Record a note for the human on the CoCoapilot board — because they asked you to, or',
  'because you judged it worth their attention.',
  '',
  'Notes are CLEARED when the board window closes. They are not storage. Anything worth',
  'keeping should be written into the repository with your own file tools instead.',
].join('\n');

/**
 * Three things an agent gets wrong without being told, and which no amount of
 * correct code prevents — the same reasoning as the two above.
 *
 * The comment guidance is the one that matters most: `commentsOmitted` cannot be
 * derived by the board, which sees only what it was sent. An agent that drops
 * comments silently makes the board present a partial discussion as a whole one.
 */
export const TICKET_DESCRIPTION = [
  'Report the tracker ticket this work comes from — Jira, Azure DevOps, or anything else —',
  'so the human can read it on the CoCoapilot board without switching windows.',
  '',
  'Report it ONCE when you pick the work up, not on every update. It stays on the board',
  'until you report a different one; your ordinary reports never disturb it.',
  '',
  'Flatten the description and comments to PLAIN TEXT before sending. The board renders',
  'every character as written and interprets no markup, so wiki syntax or ADF will show as',
  'itself.',
  '',
  'Send the ticket URL exactly as the tracker gives it — never construct one. If you leave',
  'comments out, say how many in commentsOmitted, or the human will read a partial',
  'discussion as the whole of it.',
  '',
  'Anything the schema does not model goes in fields, as label/value, most important first.',
  '',
  'Repository, branch and session identity are filled in for you. Do not ask for them.',
].join('\n');

/**
 * Status is free text and stays free text. Saying so matters because the
 * alternative failure is silent: an agent that assumes a closed set will either
 * force its real state into the nearest listed word or avoid reporting status at
 * all, and both put something less true on the board than the string it had.
 */
const STATUS_NOTE =
  'status is any text. "done", "active", "blocked", "todo" and obvious synonyms get colour; ' +
  'anything else shows as written, in grey, which is fine. Use the words you would use.';

/**
 * `repo`, `branch` and `sessionId` are deliberately absent. Exposing them would
 * be three more chances for a model to get identity wrong mid-task, for no
 * benefit — the client already knows all three (FR-002, FR-004).
 */
export const reportInputShape = {
  task: z.string().optional().describe('The task id you are working on, e.g. T012'),
  note: z
    .string()
    .optional()
    .describe('Prose for the human: why, not what. What is blocking, what you decided.'),
  chip: z
    .enum(CHIPS)
    .optional()
    .describe('Your state. "needs-you" is the only way to request a human.'),
  feature: ReportedFeature.optional().describe('The feature being worked'),
  stories: z.array(Story).max(MAX_STORIES).optional(),
  // The status note appears on `tasks` and `plan` rather than once, because a
  // model reads the parameter it is filling in and not the one above it.
  tasks: z.array(Task).max(MAX_TASKS).optional().describe(STATUS_NOTE),
  plan: z.array(PlanStep).max(MAX_PLAN_STEPS).optional().describe(STATUS_NOTE),
  changedFiles: z
    .array(ChangedFile)
    .max(MAX_CHANGED_FILES)
    .optional()
    .describe(
      'Files you changed. Set note on one to flag it for the human — the note is why it ' +
        'wants their eye ("conflict", "regenerated, check the diff"), and it is the only way ' +
        'to single a file out.',
    ),
};

export const noteInputShape = {
  text: z.string().min(1).describe('The note itself'),
  source: z
    .string()
    .optional()
    .describe('Why it exists: "you asked", "noticed while editing"'),
};

/**
 * The whole ticket as one argument, rather than its fields spread across the
 * tool's surface.
 *
 * A ticket is copied from somewhere else in one go — the agent has the record in
 * hand and is relaying it — so flattening seventeen fields into the tool schema
 * would invite a model to fill them in one at a time from memory.
 */
export const ticketInputShape = {
  ticket: Ticket.describe('The ticket as the tracker has it, flattened to plain text'),
};

export interface ToolOptions extends SendOptions {
  cwd?: string | undefined;
  sessionId?: string | undefined;
}

export function registerTools(server: McpServer, options: ToolOptions = {}): void {
  const call = (): { sessionId: string; cwd?: string | undefined } & SendOptions => ({
    sessionId: options.sessionId ?? processSessionId(),
    cwd: options.cwd,
    ports: options.ports,
    budgetMs: options.budgetMs,
  });

  server.registerTool(
    REPORT_TOOL,
    { title: 'Report to the CoCoapilot board', description: REPORT_DESCRIPTION, inputSchema: reportInputShape },
    async (args) => toToolResult(await report(args, call())),
  );

  server.registerTool(
    NOTE_TOOL,
    { title: 'Note on the CoCoapilot board', description: NOTE_DESCRIPTION, inputSchema: noteInputShape },
    async (args) => toToolResult(await note(args, call())),
  );

  server.registerTool(
    TICKET_TOOL,
    {
      title: 'Report the ticket to the CoCoapilot board',
      description: TICKET_DESCRIPTION,
      inputSchema: ticketInputShape,
    },
    async (args) => toToolResult(await ticket(args, call())),
  );
}

/**
 * An absent board is **not** a tool error.
 *
 * Flagging it as one invites the host to present it as a failure and the agent
 * to investigate or retry — which is precisely the cost this feature exists to
 * avoid. A rejection is different: that one is the caller's own malformed call,
 * the message names the offending field, and a corrected retry is the right
 * response to it.
 */
function toToolResult(result: ClientResult): {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
} {
  const content: Array<{ type: 'text'; text: string }> = [{ type: 'text', text: result.message }];
  return result.kind === 'rejected' ? { content, isError: true } : { content };
}
