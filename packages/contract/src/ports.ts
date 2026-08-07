/**
 * Where the board listens, and where a client looks for it.
 *
 * A fixed base port with a short documented fallback range, resolved by a health
 * check rather than by a discovery file — nothing is written to disk, which is
 * what keeps port discovery consistent with decision 21.
 *
 * The server and the client walk this same list in this same order. That is the
 * whole mechanism: there is no registry and no handshake.
 */

/** The board's preferred port. In the IANA dynamic range. */
export const PORT_BASE = 41_847;

/** How many consecutive ports the board will try, and a client will probe. */
export const PORT_COUNT = 5;

/**
 * 41847–41851, in the order both sides use.
 *
 * Five is enough to survive ordinary collisions and short enough that an absent
 * board is concluded quickly — five failed local connections resolve in
 * milliseconds, which matters because "the board is not running" is a normal
 * state a client must handle without delaying the work it is monitoring.
 */
export const PORT_RANGE: readonly number[] = Object.freeze(
  Array.from({ length: PORT_COUNT }, (_, index) => PORT_BASE + index),
);

/** The only address the service binds. Not a header check — a bind address. */
export const HOST = '127.0.0.1';
