import { z } from 'zod';

import {
  MAX_CHANGED_FILES,
  MAX_CHECKS,
  MAX_CRITERIA,
  MAX_FILES,
  MAX_LABEL,
  MAX_PATH,
  MAX_PLAN_STEPS,
  MAX_STORIES,
  MAX_TASK_IDS,
  MAX_TASKS,
  MAX_TEXT,
} from './caps.js';

/**
 * The payload three surfaces wrap: the HTTP service, the MCP server and the CLI.
 *
 * Two rules govern everything below.
 *
 * Unknown keys are **stripped**, not rejected (FR-013), which is zod's default
 * for `z.object` and is load-bearing rather than incidental: a newer client
 * degrades against an older board instead of failing. It is also what discards a
 * client-supplied timestamp — a client sending one is confused, not hostile, so
 * the value is ignored rather than treated as an error (FR-003).
 *
 * Caps **reject**, never truncate (FR-011). Silently shortening an agent's prose
 * would put words on the board that nobody wrote.
 */

const Label = z.string().max(MAX_LABEL);
const Text = z.string().max(MAX_TEXT);
const PathString = z.string().max(MAX_PATH);

/** Present on every request. None of it is composed by the model. */
export const Envelope = z.object({
  repo: z.string().min(1).max(MAX_PATH),
  branch: Label,
  sessionId: Label.nullish().default(null),
  /**
   * The AI tool's *own* session identifier, which is not `sessionId`.
   *
   * `sessionId` is minted by the client process and identifies a board session.
   * This one is read from `CLAUDE_CODE_SESSION_ID` and identifies a transcript
   * file, which is named after it. The two are unrelated, and without this field
   * the board cannot tell which transcript belongs to the session it is showing
   * — feature 005's FR-016.
   *
   * Derived from the environment, never composed by a model, and optional: an
   * agent that is not Claude Code reports nothing here and the board falls back
   * to the most recently modified transcript in the repository's directory.
   */
  transcriptId: Label.nullish().default(null),
});

export const ReportedFeature = z.object({
  id: Label,
  title: Label,
  specPath: PathString.nullish().default(null),
});

export const Story = z.object({
  id: Label,
  title: Label,
  priority: Label.nullish().default(null),
  status: Label.nullish().default(null),
  asA: Text.nullish().default(null),
  want: Text.nullish().default(null),
  soThat: Text.nullish().default(null),
  criteria: z.array(Text).max(MAX_CRITERIA).default([]),
  taskIds: z.array(Label).max(MAX_TASK_IDS).default([]),
  files: z.array(PathString).max(MAX_FILES).default([]),
});

export const Task = z.object({
  id: Label,
  storyId: Label.nullish().default(null),
  title: Label,
  /**
   * Free text, deliberately, and this is the one field most likely to be
   * "improved" into an enum later (decision 25). A union would make an
   * unrecognised status a *validation failure* rather than a *display case*,
   * which inverts the decision. The recognised vocabulary — todo, active,
   * blocked, done and their synonyms — is a rendering concern and lives in the
   * renderer.
   */
  status: Label,
  detail: Text.nullish().default(null),
  checks: z.array(Text).max(MAX_CHECKS).default([]),
  files: z.array(PathString).max(MAX_FILES).default([]),
});

export const PlanStep = z.object({
  text: Text,
  status: Label,
  detail: Text.nullish().default(null),
});

/** Every value the attention chip can take. */
export const CHIPS = ['idle', 'watching', 'thinking', 'needs-you'] as const;

export const Chip = z.enum(CHIPS);

export const Focus = z.object({
  task: Label.nullish().default(null),
  note: Text.nullish().default(null),
  /**
   * The only closed enum in the payload, and closed for one specific reason:
   * this is the sole channel by which an agent asks for a human (decision 15),
   * so the values must be exhaustively known for the UI to treat one of them as
   * attention. Every other status in the contract is free text.
   */
  chip: Chip.default('thinking'),
});

export const ChangedFile = z.object({
  path: PathString,
  change: Label,
  added: z.number().int().nonnegative().nullish().default(null),
  removed: z.number().int().nonnegative().nullish().default(null),
  note: Label.nullish().default(null),
});

/** `POST /v1/push` — a full snapshot that replaces what the board holds. */
export const PushRequest = Envelope.extend({
  feature: ReportedFeature.nullish().default(null),
  stories: z.array(Story).max(MAX_STORIES).default([]),
  tasks: z.array(Task).max(MAX_TASKS).default([]),
  plan: z.array(PlanStep).max(MAX_PLAN_STEPS).default([]),
  focus: Focus.nullish().default(null),
  changedFiles: z.array(ChangedFile).max(MAX_CHANGED_FILES).default([]),
});

/** `POST /v1/note` — appends. The one thing in the system that accumulates. */
export const NoteRequest = Envelope.extend({
  text: Text.min(1),
  source: Label.nullish().default(null),
});

export type Envelope = z.output<typeof Envelope>;
export type ReportedFeature = z.output<typeof ReportedFeature>;
export type Story = z.output<typeof Story>;
export type Task = z.output<typeof Task>;
export type PlanStep = z.output<typeof PlanStep>;
export type Chip = z.output<typeof Chip>;
export type Focus = z.output<typeof Focus>;
export type ChangedFile = z.output<typeof ChangedFile>;
export type PushRequest = z.output<typeof PushRequest>;
export type NoteRequest = z.output<typeof NoteRequest>;
