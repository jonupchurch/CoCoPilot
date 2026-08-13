import { rejectionFromZodError, TicketRequest } from 'cocoapilot-contract';

import type { HttpResult, ServiceDeps } from '../server.js';
import { validateRepoPath } from '../validate.js';

/**
 * `POST /v1/ticket` — replaces the session's ticket, and only that.
 *
 * **The third door, and the reason there is a third door.** A report is a
 * snapshot that replaces wholesale, so a ticket carried on `/v1/push` would have
 * to survive the replace — a merge inside `putReport`, which that method's own
 * comment forbids — and would be re-sent in full on every report for the life of
 * the session, which is the cost decision 20 cited when notes got their own
 * endpoint. With this door, FR-003 holds because nothing in the report path can
 * reach a ticket, not because someone remembered a guard.
 *
 * A ticket may be the first thing a session ever sends, in which case it creates
 * the session with no report at all — the same as a note (FR-006).
 *
 * **An unopenable address is a 200.** The schema caps `url` for length and says
 * nothing about its protocol, so a ticket carrying `file:` or `javascript:` is
 * accepted, held and displayed as text; it is simply never offered as a control.
 * Discarding a description and its acceptance criteria to protect against a link
 * nobody can activate would serve nobody. The rule that refuses to *open* it
 * lives in `packages/contract/src/url.ts` and runs again in `links.ts`.
 */
export function handleTicket(body: unknown, deps: ServiceDeps): HttpResult {
  const parsed = TicketRequest.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: rejectionFromZodError(parsed.error) };
  }

  const badRepo = validateRepoPath(parsed.data.repo);
  if (badRepo !== null) {
    return { status: 400, body: badRepo };
  }

  const receivedAt = deps.now();

  const stored = deps.store.putTicket(parsed.data, receivedAt);
  if (!stored.ok) {
    return { status: 409, body: stored.rejection };
  }

  return { status: 200, body: { ok: true, receivedAt } };
}
