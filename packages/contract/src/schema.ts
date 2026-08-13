import { z } from 'zod';

import {
  MAX_CHANGED_FILES,
  MAX_CHECKS,
  MAX_COMMENTS,
  MAX_CRITERIA,
  MAX_EXTRA_FIELDS,
  MAX_FILES,
  MAX_LABEL,
  MAX_PATH,
  MAX_PLAN_STEPS,
  MAX_RICH_TEXT,
  MAX_STORIES,
  MAX_TASK_IDS,
  MAX_TASKS,
  MAX_TEXT,
  MAX_TICKET_LABELS,
  MAX_URL,
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

/**
 * An address, capped for size and **nothing else**.
 *
 * Deliberately not validated for openability here. A ticket carrying a `file:`
 * address is still a valid, useful ticket — the address is simply never offered
 * as a control (`isOpenable` in `url.ts` decides that, at display and again
 * before the OS call). Rejecting the whole ticket over one field would discard a
 * description and its acceptance criteria to protect against a link nobody can
 * activate, which serves nobody.
 *
 * The length cap *is* a rejection, because that is a size limit rather than a
 * judgement about content.
 */
const UrlString = z.string().max(MAX_URL);

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

/**
 * One comment on a ticket, as the tracker had it.
 *
 * `at` is a **label, not a timestamp**, and stays a string all the way to the
 * screen. Every time this board shows is elapsed and board-stamped, from a clock
 * it controls; a tracker's comment date is neither, and parsing it into one
 * would invite the board to compute an age it cannot vouch for — across a
 * timezone it was not told and a format it had to guess. Shown as the tracker
 * wrote it, or not at all.
 */
export const Comment = z.object({
  author: Label.nullish().default(null),
  text: Text.min(1),
  at: Label.nullish().default(null),
});

/**
 * A field the board does not model, carried through anyway — FR-012.
 *
 * This is what makes a second tracker an agent-side adapter rather than a
 * release of the board. Order is meaningful and preserved: the agent decides
 * what matters most, and position is the only signal it has for saying so.
 */
export const ExtraField = z.object({
  label: Label.min(1),
  value: Text,
});

/**
 * The ticket one level up. A reference, never a nested ticket.
 *
 * Flat by design — an epic hierarchy is the tracker's business, and one level up
 * is what a developer needs in order to remember what the work is part of.
 */
export const Parent = z.object({
  key: Label.nullish().default(null),
  title: Label.min(1),
  url: UrlString.nullish().default(null),
});

/**
 * The tracker's record of the work.
 *
 * Everything is optional except `key` and `title`: a ticket the developer cannot
 * name is not usable, and every other field varies by tracker. **There is no
 * format rule on `key`** — the contract has never had one for an identifier, and
 * a pattern here would mean the board deciding which trackers exist.
 */
export const Ticket = z.object({
  key: Label,
  title: Label,
  /** Reported, never derived (FR-009). Openability is decided at display. */
  url: UrlString.nullish().default(null),
  /**
   * `Jira`, `Azure DevOps`, or whatever the agent calls it.
   *
   * **Printed and never branched on.** The moment the board can tell which
   * tracker this is, it can build an address for it — and then it has to be
   * taught the next one. This is a label for honest attribution, nothing more.
   */
  system: Label.nullish().default(null),
  type: Label.nullish().default(null),
  /**
   * Named `state` rather than `status` so it is never confused with a task's.
   *
   * Free text, for the reason `Task.status` is: `Ready for QA` is a real state
   * in real trackers, and a union would make an unrecognised one a validation
   * failure rather than a display case.
   */
  state: Label.nullish().default(null),
  priority: Label.nullish().default(null),
  assignee: Label.nullish().default(null),
  reporter: Label.nullish().default(null),
  /** Sprint, iteration, milestone — one slot, whatever the tracker calls it. */
  sprint: Label.nullish().default(null),
  /** Flattened to plain text by the agent before it arrives. */
  description: z.string().max(MAX_RICH_TEXT).nullish().default(null),
  /** The same shape as a story's, deliberately. */
  criteria: z.array(Text).max(MAX_CRITERIA).default([]),
  labels: z.array(Label).max(MAX_TICKET_LABELS).default([]),
  /** Oldest first, as reported: a discussion reads forward. */
  comments: z.array(Comment).max(MAX_COMMENTS).default([]),
  /**
   * How many comments the agent left out — **reported, never derived**.
   *
   * The board cannot know a ticket had 200 comments when it was sent 50. Only
   * the agent knows, so it says. This is a place the board is honestly dependent
   * on the agent, and the alternative was presenting 50 as all of them.
   */
  commentsOmitted: z.number().int().nonnegative().nullish().default(null),
  fields: z.array(ExtraField).max(MAX_EXTRA_FIELDS).default([]),
  parent: Parent.nullish().default(null),
});

/**
 * `POST /v1/ticket` — replaces the session's ticket, and only that.
 *
 * **The third verb, and the reason it is not a field on `PushRequest`.** A
 * report is a snapshot that replaces wholesale (decision 26), so a ticket
 * carried on it would have to survive the replace — which means a merge inside
 * `putReport`, a method whose own comment says there is no merge path there and
 * deliberately none anywhere else in that file. It would also re-send the whole
 * ticket on every report for the life of the session, which is the cost decision
 * 20 cited when it gave notes their own endpoint.
 *
 * With its own door, FR-003 — "a later report carrying no ticket does not
 * withdraw the ticket" — is a property of the wiring rather than a rule someone
 * has to remember. Nothing in the report path can reach a ticket.
 */
export const TicketRequest = Envelope.extend({
  ticket: Ticket,
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
export type Comment = z.output<typeof Comment>;
export type ExtraField = z.output<typeof ExtraField>;
export type Parent = z.output<typeof Parent>;
export type Ticket = z.output<typeof Ticket>;
export type TicketRequest = z.output<typeof TicketRequest>;
