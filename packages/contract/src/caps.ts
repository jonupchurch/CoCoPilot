/**
 * Every length and item limit in the contract, defined once.
 *
 * These are shared by the service and by every client so a client can reject an
 * oversized note before a round trip while the service still enforces
 * independently — a client is not a trust boundary (decision 18).
 *
 * The numbers are round, well above realistic use, and well below anything that
 * threatens memory. They exist to be enforceable, not to be precise, and the
 * spec's Assumptions section says so explicitly.
 */

/** Free text an agent writes for a human to read: a note, prose, a criterion. */
export const MAX_TEXT = 4_000;

/** A title, identifier, status, priority, or other short label. */
export const MAX_LABEL = 200;

/** A filesystem path. */
export const MAX_PATH = 500;

/** Stories in one report. */
export const MAX_STORIES = 200;

/** Tasks in one report. */
export const MAX_TASKS = 500;

/** Steps in one report's plan. */
export const MAX_PLAN_STEPS = 100;

/** Changed files in one report. */
export const MAX_CHANGED_FILES = 200;

/** Acceptance criteria on one story. */
export const MAX_CRITERIA = 50;

/** Checks on one task. */
export const MAX_CHECKS = 50;

/** Task ids referenced by one story. */
export const MAX_TASK_IDS = 500;

/** Files listed on one story or one task. */
export const MAX_FILES = 100;

/**
 * A ticket description, and nothing else in the contract.
 *
 * The one field whose content **somebody else wrote** — a product owner in a
 * tracker, not the agent — so it is the one field the agent cannot shorten
 * without changing what the developer is being measured against. Five times
 * `MAX_TEXT`, which is not raised to meet it: 20,000 characters of agent prose
 * in a focus note would be a regression in every other view.
 */
export const MAX_RICH_TEXT = 20_000;

/** A ticket or parent address. Well past any address a tracker actually mints. */
export const MAX_URL = 2_000;

/** Comments carried on one ticket. Beyond this the agent says how many it left. */
export const MAX_COMMENTS = 50;

/** Labels on one ticket. */
export const MAX_TICKET_LABELS = 30;

/** Fields on one ticket that the board does not model — FR-012's escape hatch. */
export const MAX_EXTRA_FIELDS = 30;

/** Notes accumulated by one session before it stops accepting more. */
export const MAX_NOTES_PER_SESSION = 1_000;

/** Sessions held at once before a new one is refused. */
export const MAX_SESSIONS = 100;

/**
 * Bytes accepted in one request body, enforced before parsing.
 *
 * The per-field and per-collection caps above do not bound a request on their
 * own: 500 tasks each carrying 50 checks of 4,000 characters is legal by every
 * individual cap and still roughly 127 MB. This ceiling is what actually makes
 * the spec's "a report cannot be enormous while every field is legal" true.
 *
 * 1 MiB is around ten times a realistic full report (500 tasks of ordinary
 * length is closer to 100 KB) and small enough that a runaway client cannot
 * exhaust memory before being refused.
 */
export const MAX_BODY_BYTES = 1_048_576;
