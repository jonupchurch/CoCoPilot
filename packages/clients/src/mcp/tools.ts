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
} from '@cocopilot/contract';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { note, report, type ClientResult } from '../client.js';
import { processSessionId } from '../identity.js';
import type { SendOptions } from '../transport.js';

export const REPORT_TOOL = 'cocopilot_report';
export const NOTE_TOOL = 'cocopilot_note';

/**
 * Two facts an agent cannot infer from the schema, and behaves wrongly without,
 * no matter how correct the code is (FR-019). They are in the descriptions
 * because that is the only place the model will read them.
 */
export const REPORT_DESCRIPTION = [
  'Report what you are working on right now, for a human watching the CoCoPilot board.',
  '',
  'This REPLACES your previous report entirely — send the whole current picture, not a delta.',
  'Set chip to "needs-you" when you want the human to look: it is the only way to ask for',
  'their attention, and the board will never decide on its own that you are stuck.',
  '',
  'Repository, branch and session identity are filled in for you. Do not ask for them.',
].join('\n');

export const NOTE_DESCRIPTION = [
  'Record a note for the human on the CoCoPilot board — because they asked you to, or',
  'because you judged it worth their attention.',
  '',
  'Notes are CLEARED when the board window closes. They are not storage. Anything worth',
  'keeping should be written into the repository with your own file tools instead.',
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
    { title: 'Report to the CoCoPilot board', description: REPORT_DESCRIPTION, inputSchema: reportInputShape },
    async (args) => toToolResult(await report(args, call())),
  );

  server.registerTool(
    NOTE_TOOL,
    { title: 'Note on the CoCoPilot board', description: NOTE_DESCRIPTION, inputSchema: noteInputShape },
    async (args) => toToolResult(await note(args, call())),
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
