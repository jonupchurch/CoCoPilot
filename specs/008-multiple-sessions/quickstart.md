# Quickstart: Multiple Sessions

**Feature**: [008-multiple-sessions](spec.md) | **Date**: 2026-08-06

## Prerequisites

Features 001–007 implemented.

## Run the checks

```bash
npm test --workspace=apps/board
npm run test:e2e
```

## Validation scenarios

### 1. One session shows nothing (US1) — **the absence test**

With exactly one session reported:

- No switcher, no pills, no session chrome of any kind.
- The window is **visually identical** to the single-session design (SC-001).
- Repeated reports do not make a switcher appear.
- Two sessions reduced to one by dismissal: the switcher disappears again.

### 2. Switching (US2)

Report from two repositories.

- A switcher appears listing both.
- Selecting one makes every tab show it and nothing from the other.
- A third session is added **without** disturbing existing order or selection.
- Switching away and back shows that session's current state.

### 3. Order never changes (SC-004)

With three sessions, have the *first-declared* one report repeatedly.

- Pills stay in declaration order throughout.
- Nothing moves under the cursor.

### 4. Attention on an unselected session (US3) — **the channel test**

With session A selected, have session B report `needs-you`.

- B's pill shows the attention state distinctly.
- The selection **does not change** and the board does not switch.
- Each pill shows its own elapsed time.
- B reporting an ordinary chip afterwards returns its pill to ordinary.
- No pill reorders as a result.

This is what proves the one channel an agent has for asking for a human is not
silently dropped for every session but the selected one.

### 5. Dismissal (US4)

- Dismissing removes the session from the board.
- **Zero** outbound requests result (SC-005); no agent behaviour changes.
- The dismissed session reporting again brings it back with new state.
- Dismissing the *selected* session selects another rather than showing nothing.
- Dismissing the last one returns the board to its waiting state.
- The control conveys that it clears the board's copy, not that it closes
  something.

### 6. Nothing expires (SC-008) — **the unbounded-idle test**

Report several sessions, then leave the board running with nothing reporting.

- After an extended idle period, **every** session is still listed.
- Elapsed times have grown; nothing else changed.
- No session was hidden, greyed out, collapsed or removed.

This catches expiry logic added later as a tidy-up.

### 7. Density and mixed kinds

- Six concurrent sessions: distinguishable and selectable at the minimum
  window width, no horizontal scrolling.
- Past two sessions, the branch drops from unselected pills.
- Two sessions in the same repository on the same branch remain individually
  selectable.
- An unattributed script session is listed and identifiable as not an agent.
- Long repository and branch names degrade legibly.

### 8. Restart

With several sessions held, restart the application: none are held, and the
waiting state is shown.

## Expected outcome

All pass. Scenarios 1, 4 and 6 are the load-bearing ones — respectively that the
feature costs the common case nothing, that it does not break the attention
channel, and that nothing disappears on a timer.

## Not validated here

- Torn-off windows, which remain undesigned.
