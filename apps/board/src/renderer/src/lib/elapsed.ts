/**
 * How long since the agent last said anything.
 *
 * A **measurement**, never a verdict. The board shows "4m" and nothing more —
 * no threshold, no colour shift, no "stalled" at any duration. A healthy agent
 * goes quiet for minutes during a typecheck, so any threshold would be a guess
 * about work the board cannot see. Elapsed time is a fact; "stuck" is a guess,
 * and the human does the guessing.
 *
 * Derived at render and never stored: `lastHeardAt` is a timestamp, and a
 * formatted string would be wrong a second after it was written.
 */

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How often the display needs to tick to stay honest at the finest band. */
export const TICK_MS = SECOND;

export function elapsed(since: number, now: number): string {
  const ms = Math.max(0, now - since);

  if (ms < MINUTE) return `${Math.floor(ms / SECOND)}s`;
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`;
  return `${Math.floor(ms / DAY)}d`;
}

/** The title bar's phrasing. Still a measurement. */
export function heardAgo(since: number, now: number): string {
  return `heard ${elapsed(since, now)} ago`;
}

/**
 * The focus tag: `now`, then `4m`, `2h`, `3d`.
 *
 * Coarser than the title bar on purpose. "How long since the agent said
 * anything at all" is worth watching second by second — it is the liveness
 * reading. "How long since it said which task it was on" is not: a report every
 * few seconds would make the tag flicker through a range nobody is reading,
 * and the design has never shown a seconds value here.
 *
 * Still a measurement, and still no threshold. `now` is a band, not a verdict
 * about freshness, and nothing about the tag's appearance changes when it ends.
 */
export function focusAge(since: number, now: number): string {
  return Math.max(0, now - since) < MINUTE ? 'now' : elapsed(since, now);
}
