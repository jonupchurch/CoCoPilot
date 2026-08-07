import type { Chip } from '@cocoapilot/contract';

import { findRepository, transcriptId } from './identity.js';
import {
  BOARD_ABSENT,
  DELIVERED,
  NOT_A_REPOSITORY,
  rejected,
  versionMismatch,
} from './messages.js';
import { CLIENT_CONTRACT, send, type SendOptions } from './transport.js';

/**
 * The one surface both binaries wrap.
 *
 * Every failure becomes a value here. Nothing throws past this boundary, so a
 * tool handler cannot turn a closed board into an agent-visible error, and a
 * hook cannot fail because a dashboard was shut.
 */

export type ResultKind = 'delivered' | 'no-board' | 'not-a-repo' | 'version-mismatch' | 'rejected';

export interface ClientResult {
  kind: ResultKind;
  message: string;
}

/** What a model composes. Identity is not in here, on purpose. */
export interface ReportContent {
  task?: string | undefined;
  note?: string | undefined;
  chip?: Chip | undefined;
  feature?: unknown;
  stories?: unknown;
  tasks?: unknown;
  plan?: unknown;
  changedFiles?: unknown;
}

export interface NoteContent {
  text: string;
  source?: string | undefined;
}

export interface CallOptions extends SendOptions {
  /** Where to start looking for the repository. Defaults to the process cwd. */
  cwd?: string | undefined;
  /**
   * Stable per agent session, or **null** for a hook or script.
   *
   * Null rather than the literal `"unattributed"`: the service assigns that id
   * itself and derives attribution from the *absence* of one (001 FR-004), so a
   * client spelling the string out would be recorded as an agent narrating.
   */
  sessionId: string | null;
}

export async function report(
  content: ReportContent,
  options: CallOptions,
): Promise<ClientResult> {
  const identity = findRepository(options.cwd ?? process.cwd());
  if (!identity.ok) return { kind: 'not-a-repo', message: NOT_A_REPOSITORY };

  const body: Record<string, unknown> = {
    repo: identity.value.repo,
    branch: identity.value.branch,
    sessionId: options.sessionId,
    transcriptId: transcriptId(),
  };

  if (content.task !== undefined || content.note !== undefined || content.chip !== undefined) {
    body['focus'] = {
      task: content.task ?? null,
      note: content.note ?? null,
      ...(content.chip === undefined ? {} : { chip: content.chip }),
    };
  }
  for (const key of ['feature', 'stories', 'tasks', 'plan', 'changedFiles'] as const) {
    if (content[key] !== undefined) body[key] = content[key];
  }

  return interpret(await send('/v1/push', body, options));
}

export async function note(content: NoteContent, options: CallOptions): Promise<ClientResult> {
  const identity = findRepository(options.cwd ?? process.cwd());
  if (!identity.ok) return { kind: 'not-a-repo', message: NOT_A_REPOSITORY };

  return interpret(
    await send(
      '/v1/note',
      {
        repo: identity.value.repo,
        branch: identity.value.branch,
        sessionId: options.sessionId,
        transcriptId: transcriptId(),
        text: content.text,
        ...(content.source === undefined ? {} : { source: content.source }),
      },
      options,
    ),
  );
}

function interpret(delivery: Awaited<ReturnType<typeof send>>): ClientResult {
  if (delivery.ok) return { kind: 'delivered', message: DELIVERED };

  switch (delivery.kind) {
    case 'no-board':
      return { kind: 'no-board', message: BOARD_ABSENT };
    case 'version-mismatch':
      return {
        kind: 'version-mismatch',
        message: versionMismatch(CLIENT_CONTRACT, delivery.boardContract),
      };
    case 'rejected':
      return { kind: 'rejected', message: rejected(delivery.field, delivery.message) };
  }
}
