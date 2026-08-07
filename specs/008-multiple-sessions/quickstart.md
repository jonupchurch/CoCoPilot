# Quickstart: Multiple Sessions

**Feature**: [008-multiple-sessions](spec.md) | **Date**: 2026-08-06

## Prerequisites

Features 001–007 implemented.

## Run the checks

```bash
# Playwright drives the built app in apps/board/out, not the source.
npm run build --workspace @cocopilot/board

npm test          # 429 unit + integration
npm run test:e2e  # 209 Playwright
npm run typecheck
```

`npm test --workspace=apps/board` — what this file said before — does not run:
`apps/board` has no `test` script, because the Vitest projects live at the root.

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

**By hand this is unbounded; automated it cannot be**, so it is verified in two
halves and neither is a long wait. A real four-second wait asserts both sessions
survive *and that their ages advanced*, so the assertion is about something; and
a source assertion names the only timer in the main process — the transcript
reader's debounce — so a second one has to be argued for rather than merely
added. Four seconds proves nothing about a thirty-minute expiry, but a scheduled
call that does not exist cannot fire at any duration.

Faking the clock was tried first and does not work here: `page.clock.install()`
cannot patch timers the page created before it ran, so the elapsed values simply
stayed at `0s` and the test passed for the wrong reason.

### 7. Density and mixed kinds

- Six concurrent sessions: distinguishable and selectable at the minimum
  window width, no horizontal scrolling.
- Past three sessions the branch drops — **except where a repository name is
  shared**, where it stays however crowded the row is.
- Two sessions in the same repository on the same branch remain individually
  selectable.

The density rule needed correcting during implementation, and the correction is
the interesting part of this scenario. The plan said the branch drops from
unselected pills past two sessions. That breaks **FR-005** — every entry must be
distinguishable — for the case the spec names in its own edge cases: two
sessions in the same repository on different branches. Four sessions, two of
them in `api`, and the density rule alone draws two identical pills.

So the branch survives wherever a repository name is not unique. Density is a
preference; being able to tell which agent you are about to switch to is the
requirement, and where they disagree the requirement wins.
- An unattributed script session is listed and identifiable as not an agent.
- Long repository and branch names degrade legibly.

### 8. Restart

With several sessions held, restart the application: none are held, and the
waiting state is shown.

## Expected outcome

All pass. Scenarios 1, 4 and 6 are the load-bearing ones — respectively that the
feature costs the common case nothing, that it does not break the attention
channel, and that nothing disappears on a timer.

Scenario 1's automated form had to be rewritten before it meant anything: the
first version compared a single-session window against *itself*, which cannot
fail. SC-001's claim is that no space is reserved for the switcher, so the
comparison has to be against the two-session case — the tab strip sits at one
height with one session, lower when the row genuinely appears, and back again
when it goes.

Scenario 5's "no agent behaviour changes" is now worth being precise about,
because this feature gave the renderer its **first write**. `select` and
`dismiss` change what the window shows and what the board holds. Neither leaves
the process. The property `read-only.spec.ts` protects was restated rather than
loosened: the window may change what it is showing, and still send nothing to
any agent.

## Not validated here

- Torn-off windows, which remain undesigned.
