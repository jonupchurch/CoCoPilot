import { z } from 'zod';

/** What the board calls itself. A client matches on exactly this. */
export const APP_NAME = 'cocopilot';

/** The board's own version, reported so a client can detect drift (decision 27). */
export const APP_VERSION = '0.1.0';

/** The wire contract version, matching the `/v1` path prefix. */
export const CONTRACT_VERSION = 'v1';

/** The body of `GET /v1/health`. */
export const HealthPayload = z.object({
  app: z.literal(APP_NAME),
  version: z.string().min(1),
  contract: z.string().min(1),
});

export type HealthPayload = z.output<typeof HealthPayload>;

/**
 * Whether a health response actually came from CoCoPilot.
 *
 * Port discovery knocks on ports owned by unrelated local software, so a client
 * that treated any 200 as success would POST prompt text and file paths into
 * some other program. Match on the payload, never on the connection succeeding
 * (decision 22).
 */
export function isCoCoPilotHealth(value: unknown): value is HealthPayload {
  return HealthPayload.safeParse(value).success;
}

/** The health body this build serves. */
export function healthPayload(): HealthPayload {
  return { app: APP_NAME, version: APP_VERSION, contract: CONTRACT_VERSION };
}
