import { CONTRACT_VERSION, HOST } from 'cocoapilot-contract';

import { CALL_BUDGET_MS, Deadline } from './deadline.js';
import { discover } from './discover.js';

/**
 * Discover, then post, then say what happened. Once.
 *
 * Nothing here buffers, queues or retries an undelivered report (FR-010), and
 * nothing launches anything (FR-011). Every one of those is an additive
 * temptation that would make an absent board cost the agent something, which is
 * the exact failure this feature exists to avoid.
 */

export type Delivery =
  | { ok: true; receivedAt: number }
  | { ok: false; kind: 'no-board' }
  | { ok: false; kind: 'version-mismatch'; boardContract: string }
  | { ok: false; kind: 'rejected'; field: string; message: string };

export interface SendOptions {
  ports?: readonly number[] | undefined;
  budgetMs?: number | undefined;
}

interface Rejection {
  field?: unknown;
  message?: unknown;
}

/**
 * The three doors, closed as a union rather than left as `string`.
 *
 * A typo in a path would otherwise be a silent 404 that the client reports as a
 * soft "no board", which is the worst available failure: the agent is told to
 * carry on and the developer sees nothing. Adding a door is a deliberate edit
 * here.
 */
type ServicePath = '/v1/push' | '/v1/note' | '/v1/ticket';

export async function send(
  path: ServicePath,
  body: unknown,
  options: SendOptions = {},
): Promise<Delivery> {
  const deadline = new Deadline(options.budgetMs ?? CALL_BUDGET_MS);

  const found = await discover({ ports: options.ports, deadline });
  if (!found.ok) {
    return found.reason === 'absent'
      ? { ok: false, kind: 'no-board' }
      : { ok: false, kind: 'version-mismatch', boardContract: found.boardContract };
  }

  try {
    const response = await fetch(`http://${HOST}:${found.port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: deadline.signal(deadline.remaining()),
    });

    const payload: unknown = await response.json().catch(() => null);

    if (response.ok) {
      const receivedAt = (payload as { receivedAt?: unknown } | null)?.receivedAt;
      return { ok: true, receivedAt: typeof receivedAt === 'number' ? receivedAt : Date.now() };
    }

    // The service names the offending field, and that reason travels back to the
    // caller intact rather than being flattened into "request failed" (FR-013).
    const rejection = (payload ?? {}) as Rejection;
    return {
      ok: false,
      kind: 'rejected',
      field: typeof rejection.field === 'string' ? rejection.field : '(unknown)',
      message:
        typeof rejection.message === 'string'
          ? rejection.message
          : `the board answered ${response.status}`,
    };
  } catch {
    // The board was there a moment ago and is not now. Same outcome as never
    // having found it: say so, and do not try again.
    return { ok: false, kind: 'no-board' };
  }
}

/** What this client speaks, surfaced so a mismatch can name both sides. */
export const CLIENT_CONTRACT = CONTRACT_VERSION;
