# Implementation Plan: Multiple Sessions

**Branch**: `008-multiple-sessions` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-multiple-sessions/spec.md`

## Summary

A session switcher that does not exist below two sessions, holds a pill per
session in declaration order carrying its own chip and elapsed time, and offers
a dismiss control that clears only the board's copy.

## Technical Context

Inherits [001/research.md](../001-push-contract-service/research.md) and the
renderer conventions from features 003–004. Session removal is served by the
store (feature 001 FR-017); this feature is the control and the switcher.

**Primary Dependencies**: None beyond feature 003's.

**Constraints**: Six concurrent sessions distinguishable at the window minimum;
no reordering ever; no timed removal of anything.

## Constitution Check

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Four stories, no clarification markers; the P1 story is that nothing appears |
| II. Validated trust boundaries | **Pass** | Repository and branch are agent-reported; rendered as text nodes only |
| III. Match existing conventions | **Pass** | Reuses the chip and elapsed formatting from feature 003 |
| IV. Scope discipline | **Pass** | No auto-switch, no reorder, no expiry, no merged view, no session naming |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md), including an unbounded-idle test that nothing disappears |
| VI. Narrate the reasoning | **Pass** | Design notes below |
| VII. Plan whole set first | **Pass** | Plan 8 of 9 |
| VIII. Test at the right level | **Pass** | Unit for selection-on-removal and visibility threshold; E2E for the switcher's appearance |
| IX. Atomic commits, branch | **Deferred** | As 001 |

**No violations.**

## Project Structure

```text
renderer/src/
├── app/
│   ├── SessionSwitcher.tsx    # absent below two sessions
│   └── SessionPill.tsx        # identity, chip, elapsed, dismiss
├── state/
│   ├── useSessions.ts         # ordering, visibility threshold
│   └── useActiveSession.ts    # every view reads from this
└── app/App.tsx                # gains the switcher row
```

**Structure Decision**: `useActiveSession` becomes the single point every view
resolves its session through. Introducing it here rather than earlier is
deliberate — features 004 through 007 were built against one implicit session,
and this feature makes that resolution explicit in one place rather than
threading a session identifier through every view.

## Design notes

**Declaration order, never recency.** Pills carry live state and are glanced at
rather than read, so a stable position is something a developer learns over a
session. Recency sorting would move the pill they are reaching for — and the one
that moves is exactly the one they want. `declaredAt` exists in the store for
this and is never updated.

**The board never switches itself** (FR-009). An unselected session reaching
`needs-you` shows on its pill; it does not seize the view. Auto-switching is the
most tempting "helpful" behaviour here and would both move the board out from
under someone mid-read and let one agent take the view from another.

**Pills carry chip and elapsed because the alternative silently breaks the one
attention channel.** The chip is the only way an agent can ask for a human
(decision 15), and the board shows one session at a time — so without state on
unselected pills, a `needs-you` on the session you are not watching is an ask
that never arrives.

**Density degrades by dropping information, not by shrinking it.** Past two
sessions the branch drops from unselected pills; the state label shows only when
selected or attention-seeking. Space is spent where it carries information.

**Dismissal is not muting** (FR-014). It clears the board's copy; a dismissed
session that reports again returns. That follows from the AI deciding what is on
the board, and the control's wording must convey "clears this board's copy"
rather than "close" — acknowledged in the spec as thin cover rather than solved.

**Nothing is ever removed on a timer** (FR-017). Sessions leave on dismissal or
restart. Any expiry would be the same timed judgement the product refuses
everywhere else.

## Post-design Constitution re-check

Still passing. Worth noting that the P1 story here is an *absence* — with one
session the window must be indistinguishable from the single-session design.
That is verified by comparison rather than assumed, because the natural
temptation is to reserve permanent chrome for a switcher that usually has
nothing to show.
