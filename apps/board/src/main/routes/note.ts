import { NoteRequest, rejectionFromZodError } from '@cocopilot/contract';

import type { HttpResult, ServiceDeps } from '../server.js';
import { validateRepoPath } from '../validate.js';

/**
 * `POST /v1/note` — appends, and appending is the whole point.
 *
 * Notes are what the user asked the agent to record, plus whatever the agent
 * judged worth adding. They are also the one exception to snapshot-replace: a
 * note arriving does not disturb the session's reported state, and a report
 * arriving does not disturb the notes (decision 20).
 *
 * A note may be the first thing a session ever sends, in which case it creates
 * the session with no report at all (FR-006).
 */
export function handleNote(body: unknown, deps: ServiceDeps): HttpResult {
  const parsed = NoteRequest.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: rejectionFromZodError(parsed.error) };
  }

  const badRepo = validateRepoPath(parsed.data.repo);
  if (badRepo !== null) {
    return { status: 400, body: badRepo };
  }

  const receivedAt = deps.now();

  const stored = deps.store.appendNote(parsed.data, receivedAt);
  if (!stored.ok) {
    return { status: 409, body: stored.rejection };
  }

  return { status: 200, body: { ok: true, receivedAt } };
}
