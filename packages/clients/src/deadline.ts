/**
 * One budget for a whole call — discovery and delivery together.
 *
 * SC-003 bounds every call at two seconds *including* the case where nothing is
 * listening. A per-request timeout does not give that: five ports that black-hole
 * rather than refusing would each burn their own timeout and the total would be
 * whatever five of them add up to. So the budget is allocated once and every
 * step spends from it.
 *
 * Lives in its own file rather than in `transport.ts` only because `discover.ts`
 * needs it too, and the other direction would be a cycle.
 */
export class Deadline {
  readonly endsAt: number;

  constructor(budgetMs: number) {
    this.endsAt = Date.now() + budgetMs;
  }

  remaining(): number {
    return Math.max(0, this.endsAt - Date.now());
  }

  expired(): boolean {
    return this.remaining() <= 0;
  }

  /** An abort signal firing at whichever comes first: the cap or the budget. */
  signal(capMs: number): AbortSignal {
    return AbortSignal.timeout(Math.max(1, Math.min(capMs, this.remaining())));
  }
}

/** The whole call. Under SC-003's two seconds with room to spare. */
export const CALL_BUDGET_MS = 1_900;

/**
 * One health probe. Five of these plus a delivery still fit the budget, and a
 * local port that is simply closed refuses in microseconds — this cap only ever
 * matters for one that accepts and then says nothing.
 */
export const PROBE_BUDGET_MS = 250;
