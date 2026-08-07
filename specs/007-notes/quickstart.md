# Quickstart: Notes

**Feature**: [007-notes](spec.md) | **Date**: 2026-08-06

## Prerequisites

Features 001–006 implemented. 001 for the append endpoint, 003 for the tab
strip this feature adds a mark to, and 006 for the content-size resize helper
the narrow-width check borrows.

## Run the checks

```bash
# Playwright drives the built app in apps/board/out, not the source. Without
# this the suite tests the previous build and reports missing elements for
# components that are right there in the tree.
npm run build --workspace @cocopilot/board

npm test          # 421 unit + integration
npm run test:e2e  # 180 Playwright
npm run typecheck
```

`npm test --workspace=apps/board` — what this file said before — does not run:
`apps/board` has no `test` script, because the Vitest projects are defined at
the root.

## Validation scenarios

### 1. Reading notes (US1)

Record several notes with and without a `source`.

- Listed newest first, each with text as written and a relative time.
- The source line appears in the agent's phrasing where supplied, and is
  **absent** — not placeheld — where it is not. Note that the export draws
  *two* mono values per note and `NoteRequest` carries one `source`; the second
  has no source in the contract and is not invented.
- A note arriving while the view is open appears at the top without disturbing
  reading position.
- With no notes, the view says so rather than rendering an empty frame.

**The empty state cannot currently be reached, and that is not a defect.** A tab
whose view would be empty is not offered at all — feature 003's rule, because a
tab leading nowhere is a dead end — so `notes` appears only once a note exists,
and the active tab falls back if it stops being available. FR-010 is satisfied
by that rule rather than by this element; the element is a guard, kept because
`StoriesView` and `TasksView` carry the same one for the same reason. Do not
conclude it is dead code and delete it without also deciding what should happen
if the tab rule ever changes.

### 2. Impermanence is stated and true (US2) — **the honesty test**

- The view states that closing the window clears these notes.
- It states that anything worth keeping should be written into the repository.
- **No** save, pin, archive, export or star control exists anywhere in the tree.
- Nothing suggests notes are stored, synced or recoverable.
- Record notes, close the application, reopen: none remain.

The automated half of this asserts **interactivity**, not a list of words like
`pin` and `archive`. A word list was written first and was wrong twice over: it
matched the `export` keyword in every module and the prose in this very tree
explaining why a pin is absent, and it would have missed a control named
something nobody thought to list. A control needs a handler or an interactive
element, whatever it is called — so the test is "nothing operable exists here",
in the rendered view and in the source.

Then the comprehension check from SC-002: someone reading this view for the
first time, without documentation, correctly states that notes do not survive
closing. If they cannot, the view has failed its second job.

### 3. The unread dot (US3)

- With another view active, a note arrives → a muted dot appears on the notes
  tab.
- It carries **no** count.
- Opening the view clears it.
- A note arriving while already in the view produces no dot.
- No focus steal, no window raise, no sound — verify for every arrival.

### 4. A long session (US4)

With 300 notes:

- All reachable by scrolling, each individually legible.
- Relative times let recent be told from old at a glance.
- A note at the 4,000-character cap displays legibly without truncation
  obscuring its point.
- At the minimum window width: readable, no horizontal scrolling.

### 5. Session scoping and hostile content

- Notes for a session other than the selected one are not shown.
- A note arriving for a dismissed session brings the session back, note
  included.
- Note text containing markup renders as visible characters.

## Expected outcome

All pass, and scenario 2 in particular — a notes view that reads like storage is
worse than no notes view, because the failure is silent and costs the user
something they thought was kept.

Scenario 1's "without disturbing reading position" was the one expected to fail,
and it did not: Chromium's scroll anchoring absorbs an insertion above the
viewport. But it is doing real work rather than being a happy accident — with
`overflow-anchor: none` the reader is moved 45px by a single note and 447px by a
burst of ten, which is half a screen. That is why the property is asserted by
measuring a row's position across an arrival, and why the CSS says the default
is load-bearing.

One deliberate deviation from `stacks/vite-react.md`, recorded because the pack
says to say so out loud: the note list is keyed by **array index**, which the
pack forbids. The rule is there because these lists reorder when a report
replaces them, so position is not identity. Notes never reorder — they only
append — so the arrival index is fixed for the life of the window, and it is the
only stable identifier available: `receivedAt` is not one, because two notes can
share a millisecond.

## Not validated here

- The append endpoint itself — feature 001.
- Notes across multiple sessions — feature 008.
