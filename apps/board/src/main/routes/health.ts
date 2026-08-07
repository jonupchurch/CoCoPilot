import { healthPayload } from '@cocoapilot/contract';

import type { HttpResult } from '../server.js';

/**
 * `GET /v1/health` — say who we are.
 *
 * A client probing the port range knocks on ports owned by unrelated local
 * software. Answering 200 is not the point; naming the application is. A client
 * that treated any 200 as success would POST an agent's prompt text and file
 * paths into whatever else happened to be listening (decision 22).
 */
export function handleHealth(): HttpResult {
  return { status: 200, body: healthPayload() };
}
