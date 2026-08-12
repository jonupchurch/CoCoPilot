# Quickstart: Ticket Tab and Openable Links

**Feature**: [010-ticket-tab-links](spec.md) | **Date**: 2026-08-12

## Prerequisites

Features 001–008 implemented, and decision 36 (every tab offered from the first
report) in place — this feature's tab is the one exception to it, so the rule has
to exist before the exception means anything.

## Run the checks

```bash
# Playwright drives the built app in apps/board/out, not the source.
npm run build --workspace @cocoapilot/board

npm test          # unit + integration
npm run test:e2e  # Playwright
npm run typecheck
```

Six end-to-end tests currently fail on a machine whose display scale is not 100%
— `setContentSize(380, …)` never reaches `innerWidth === 380`. They fail
identically without this feature. **Scenario 6 below depends on that same
mechanism**, so confirm the baseline before reading its result as a regression.

## Validation scenarios

### 1. The tab is absent, then appears (US1) — **the absence test**

Report normally, with no ticket.

- No ticket destination is offered.
- Every other destination is offered, per decision 36. This is the comparison
  that matters: four tabs present with empty views, and the fifth *absent*
  entirely (SC-002).

Then report a ticket for the same session.

- The destination appears and shows it.
- Overview is still the landing view — the new destination did not become the
  default (see [research.md §4](research.md)).

### 2. Everything reported is shown, and nothing else (US1)

Report a ticket carrying every field, then one carrying only `key` and `title`.

- The full one shows every field.
- The sparse one shows **no** empty rows, no "unknown", no invented values
  (FR-008).
- Elapsed time since the ticket was reported is shown, with no assessment of
  whether it is still current (FR-011).
- A `state` of `Done` takes the same colour as a task's `done`; a state of
  `Ready for QA` falls back to neutral and shows as written (FR-014).

That last check is not cosmetic. `tests/source-hygiene.test.ts` fails the build
if any file outside `vocabulary.ts` and `StatusLabel.tsx` classifies a status, so
a ticket state going through those components is enforced rather than reviewed.

### 3. Stickiness (US1, FR-003) — **the load-bearing test**

Report a ticket, then send **ten** ordinary reports that say nothing about it.

- The destination is still offered after all ten.
- It still shows the ticket (SC-009).

Then report a *different* ticket: the destination shows the new one, not both.

This is the scenario that fails if the ticket is ever folded into the report
snapshot. It is here rather than buried in a unit test because the failure it
catches — a tab withdrawn from under a reader — is the exact one that superseded
FR-009, and it deserves to be visible in the suite.

### 4. Links (US2) — **the safety test**

Report a ticket whose `url` is an ordinary `https` address.

- Activating it opens the **system browser** at that address.
- The application's own window navigates nowhere; no additional application
  window opens (FR-023).
- **Zero** outbound requests from the application, and nothing to any agent
  (SC-005, FR-024). No title fetch, no redirect resolution, no preview.
- The address is visible on screen before activation (FR-025).
- A ticket with a parent carrying an address opens it the same way.

Then report tickets whose `url` is, at minimum:

| Address | Expected |
|---|---|
| `file:///C:/Windows/System32/calc.exe` | Not openable; shown as text |
| `javascript:alert(1)` | Not openable; shown as text |
| `ms-msdt:/id` (a registered handler) | Not openable; shown as text |
| `httpx://example.com` | Not openable — this is the one a `startsWith` check would pass |
| `javascript:void(0)//https://example.com` | Not openable — the one an `includes` check would pass |
| `www.example.com` (no protocol) | Not openable, and **not promoted** to `https` (FR-022) |

Each is a 200 on the endpoint — a ticket with an unopenable address is still a
valid ticket (SC-004, and see [data-model.md](data-model.md)).

Confirm `read-only.spec.ts` passes with its bridge count raised to three writes,
and that it still fails if a fourth member is added.

### 5. Comments (US3)

- Comments listed oldest first with their authors (FR-015).
- A ticket reporting `commentsOmitted: 150` says 150 were not included, rather
  than showing 50 as though they were all (FR-016).
- A ticket with no comments **says so**; the section is present (FR-017).
- Markup in a comment appears as characters (SC-012).

### 6. Density at the floor (SC-008) — **the measured one**

With a ticket held, drive the window to 380px.

- Five destinations, every label legible, every one operable.
- **No horizontal scrolling** anywhere.
- "Stories" is the shortened label; the view's own heading already said Stories,
  so nothing reads as inconsistent.

Verified by measurement rather than by eye, the way feature 008 verified six
pills at the same floor. See the display-scale caveat above.

### 7. An unknown tracker (US4)

Report a ticket whose only recognised fields are `key` and `title`, with
everything else in `fields`.

- Every unmodelled field displays as a labelled value, **in the order reported**
  (SC-010).
- A ticket naming `system: "Azure DevOps"` says so; one naming nothing names
  nothing and guesses nothing (FR-013).

This is the scenario that proves a second tracker costs no board change. If it
passes with an entirely unmodelled ticket, the escape hatch works.

### 8. Limits (FR-026, FR-027)

- A description at 20,000 characters is accepted and readable.
- At 20,001 the request is **refused**, naming the field and the limit — and no
  shortened description appears on the board (SC-007).
- 50 comments accepted; 51 refused the same way.
- A ticket at every cap at once may be refused by the **body** ceiling with a 413
  naming it. That is correct and expected — the per-field caps have never bounded
  a request on their own (decision 29), and the arithmetic is in
  [research.md §3](research.md).

### 9. Sessions and lifetime

- With two sessions, one ticket-driven and one not, the destination is offered
  for the first and not the second, and switching between them shows only the
  selected session's ticket (FR-005).
- Pills carry **no** ticket information.
- Dismissing a ticket-driven session takes its ticket with it; the session
  reporting again brings it back.
- After a restart, no ticket is held (SC-011).

### 10. Markup, everywhere (SC-012)

Report a ticket with `<script>`, `<img src=x onerror=…>` and an ADF fragment in
the description, every criterion, every label, every comment and every extra
field.

- All of it visible as characters. No element created, no handler run.
- Line breaks in the description are **preserved** — `pre-wrap`, per the
  precedent `LastPromptSection.css` set for the other long externally-authored
  text on the board.

## Expected outcome

All pass. Scenarios 3, 4 and 7 are the load-bearing ones — respectively that a
report cannot take the tab away, that only ordinary web addresses ever open, and
that the feature outlives its first tracker.

Scenario 4 deserves the most care of anything in this feature. It is the first
time this product hands anything to the operating system, and the addresses it
hands over were composed by an agent on a board any local process may report to.
The two rows in its table that a naive check would let through are there because
those are the two mistakes that get made.

## Not validated here

- The agent-side adapters that read Jira or Azure DevOps. They are out of scope
  and cannot be validated against a contract that does not exist yet — which is
  what this feature creates.
- Keeping any record of past tickets.
- Opening addresses from anywhere other than the ticket and its parent.
