import { PushRequest, rejectionFromZodError } from '@cocopilot/contract';

import type { HttpResult, ServiceDeps } from '../server.js';
import { validateRepoPath } from '../validate.js';

/**
 * `POST /v1/push` — a full snapshot that replaces what the board holds.
 *
 * The order below is the requirement, not an implementation detail: parse, then
 * check the path, and only then touch the store. Held state is the only copy of
 * what an agent has said — nothing re-derives it — so a request that fails
 * anywhere must leave it exactly as it was (FR-010, SC-003).
 */
export function handlePush(body: unknown, deps: ServiceDeps): HttpResult {
  const parsed = PushRequest.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: rejectionFromZodError(parsed.error) };
  }

  const badRepo = validateRepoPath(parsed.data.repo);
  if (badRepo !== null) {
    return { status: 400, body: badRepo };
  }

  // The service's own clock, never the client's. A timestamp in the request was
  // already discarded as an unknown key (FR-003).
  const receivedAt = deps.now();

  const stored = deps.store.putReport(parsed.data, receivedAt);
  if (!stored.ok) {
    return { status: 409, body: stored.rejection };
  }

  return { status: 200, body: { ok: true, receivedAt } };
}
