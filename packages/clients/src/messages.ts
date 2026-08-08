/**
 * Everything a caller might read back, in one place.
 *
 * These are behavioural requirements, not copy. An agent that reads "continue
 * working, no need to retry" behaves differently from one that reads
 * `ECONNREFUSED` — it carries on instead of spending a turn investigating a
 * failure that is not its problem. Testing that means asserting on a constant,
 * not on a string literal scattered across call sites.
 */

/**
 * Has to say three things: the board is absent, this is not a failure of your
 * work, and retrying will not help.
 */
export const BOARD_ABSENT =
  'CoCoapilot board is not running — continue working, no need to retry.';

/** The CLI was run somewhere with no repository above it. */
export const NOT_A_REPOSITORY =
  'Not inside a git repository — CoCoapilot reports are per repository, so there is nothing to report against.';

/** Delivery succeeded. Deliberately says nothing the caller has to act on. */
export const DELIVERED = 'Reported to the CoCoapilot board.';

/**
 * Decision 27 accepts that a published client can drift from the installed app.
 * Accepting that is only reasonable if the drift is detectable, which is the
 * whole reason the health endpoint carries a version.
 */
export function versionMismatch(clientContract: string, boardContract: string): string {
  return (
    `CoCoapilot version mismatch: this client speaks contract ${clientContract}, ` +
    `the board speaks ${boardContract}. Nothing was sent. ` +
    'Update whichever is older — continue working, no need to retry.'
  );
}

/** A rejection from the service, passed through rather than flattened. */
export function rejected(field: string, message: string): string {
  return `CoCoapilot rejected this report: ${field} — ${message}`;
}
