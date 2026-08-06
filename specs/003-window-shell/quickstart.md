# Quickstart: Window Shell

**Feature**: [003-window-shell](spec.md) | **Date**: 2026-08-06

## Prerequisites

- Features 001 and 002 implemented — a service to hold state and a way to report
- `npm install`; `npm run dev --workspace=apps/board`

## Run the checks

```bash
npm test --workspace=apps/board       # Vitest unit
npm run test:e2e                      # Playwright against the built app
npm run typecheck
```

## Validation scenarios

### 1. Identity and liveness (US1)

Report a session, then look at the window.

- Repository and branch appear in the title bar.
- Elapsed time is shown and advances.
- The reported chip appears; `needs-you` is distinguishable at a glance.
- Wait five minutes without reporting: **only** the elapsed figure changes. No
  badge, no colour shift, no "stalled".

### 2. The waiting state (US2)

Launch with nothing reported.

- The window says it is waiting for an agent.
- It states that nothing needs configuring.
- The tab strip is **absent**, not present-and-empty.
- Report something: the window populates and tabs appear, with no restart.
- Close and reopen: waiting state again.

### 3. Size belongs to the user (US3)

- Set a width; switch tabs; the width is unchanged.
- Resize; content adapts, and the new size is respected on every tab.
- Try to size below the minimum: it is enforced.
- Report while a tab is active: the active tab and scroll position survive.

### 4. A short window stays usable (US4)

At the minimum height with content taller than the window:

- Everything is reachable by scrolling.
- The section being read stays identifiable, with its summary, while its
  contents pass.
- No horizontal scrolling at any supported size.

### 5. Nothing changes on a timer (SC-006) — **the absence test**

Launch, report once, then leave the window untouched for ten minutes with
nothing reporting.

- The **only** visual change is the elapsed counter advancing.
- No network request is issued in that period.
- No state change is recorded.

This is the test that catches a polling loop or a staleness badge added later as
an apparent improvement. It fails loudly if either appears.

### 6. Agent text cannot execute (SC-009)

Report a branch name, prose and a task title each containing `<script>` and
other markup.

- All render as visible characters.
- Nothing executes; no console error indicates attempted execution.
- Confirm no `dangerouslySetInnerHTML` exists anywhere in the renderer.

## Expected outcome

All scenarios pass, `typecheck` is clean, and the checklists in both stack packs
are satisfied — in particular: no `node:` import resolves in the renderer build,
and no timer fetches data.

## Not validated here

- Tab contents. Features 004 onward; this feature validates the frame only.
- Multiple sessions — feature 008.
- Torn-off windows, which remain undesigned.
