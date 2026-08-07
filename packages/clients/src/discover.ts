import {
  CONTRACT_VERSION,
  HOST,
  isCoCoPilotHealth,
  PORT_RANGE,
  type HealthPayload,
} from '@cocopilot/contract';

import { Deadline, PROBE_BUDGET_MS } from './deadline.js';

/**
 * Find the board, or conclude it is absent.
 *
 * Probing a range means knocking on ports owned by unrelated local software, so
 * the qualifying test is the *payload*, never the fact that something answered
 * (FR-008, SC-005). A client that treated any 200 as success would post an
 * agent's prompt text and file paths into whatever else held the port.
 *
 * Nothing is cached between calls. A remembered port is stale the moment the
 * board restarts on a different one, and five local connection attempts resolve
 * in single-digit milliseconds — the cache would buy nothing and cost
 * correctness.
 */

export type Discovery =
  | { ok: true; port: number; health: HealthPayload }
  | { ok: false; reason: 'absent' }
  | { ok: false; reason: 'version-mismatch'; port: number; boardContract: string };

export interface DiscoverOptions {
  ports?: readonly number[] | undefined;
  deadline: Deadline;
}

export async function discover(options: DiscoverOptions): Promise<Discovery> {
  const ports = options.ports ?? PORT_RANGE;

  for (const port of ports) {
    if (options.deadline.expired()) break;

    const health = await probe(port, options.deadline);
    if (health === null) continue;

    // Reached only by something that named itself. Anything else — a 200 with an
    // empty body, another program's health endpoint, a timeout — was skipped
    // above without a single byte of the report being offered to it.
    if (health.contract !== CONTRACT_VERSION) {
      return { ok: false, reason: 'version-mismatch', port, boardContract: health.contract };
    }
    return { ok: true, port, health };
  }

  return { ok: false, reason: 'absent' };
}

async function probe(port: number, deadline: Deadline): Promise<HealthPayload | null> {
  try {
    const response = await fetch(`http://${HOST}:${port}/v1/health`, {
      signal: deadline.signal(PROBE_BUDGET_MS),
    });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    return isCoCoPilotHealth(body) ? body : null;
  } catch {
    // Refused, timed out, or answered with something that is not JSON. All the
    // same thing from here: not the board, keep looking.
    return null;
  }
}
