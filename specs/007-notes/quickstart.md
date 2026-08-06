# Quickstart: Notes

**Feature**: [007-notes](spec.md) | **Date**: 2026-08-06

## Prerequisites

Features 001–003 implemented.

## Run the checks

```bash
npm test --workspace=apps/board
npm run test:e2e
```

## Validation scenarios

### 1. Reading notes (US1)

Record several notes with and without a `source`.

- Listed newest first, each with text as written and a relative time.
- The source line appears in the agent's phrasing where supplied, and is
  **absent** — not placeheld — where it is not.
- A note arriving while the view is open appears at the top without disturbing
  reading position.
- With no notes, the view says so rather than rendering an empty frame.

### 2. Impermanence is stated and true (US2) — **the honesty test**

- The view states that closing the window clears these notes.
- It states that anything worth keeping should be written into the repository.
- **No** save, pin, archive, export or star control exists anywhere in the tree.
- Nothing suggests notes are stored, synced or recoverable.
- Record notes, close the application, reopen: none remain.

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

## Not validated here

- The append endpoint itself — feature 001.
- Notes across multiple sessions — feature 008.
