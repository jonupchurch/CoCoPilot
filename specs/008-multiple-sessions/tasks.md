# Tasks: Multiple Sessions

**Input**: Design documents from `specs/008-multiple-sessions/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [quickstart.md](quickstart.md)

Features 001–007 are merged. Every view currently shows `sessions[0]`, so a
developer's second agent is invisible. This feature is the switcher, the
selection, and the dismiss control.

**Tests**: Included. The weight is different again. 006 tested that the
developer is not moved by a report; 007 that the view does not lie. This one
tests that **the board never acts on its own** — it does not switch, does not
reorder, does not expire, and does not promote one agent over another. Most of
these are absences, and the P1 story is itself an absence: with one session the
window must be indistinguishable from what it is today.

## Format: `[ID] [P?] [Story] Description`

---

## What is already built and must not be rebuilt

| Thing | Where | Use it for |
|---|---|---|
| Dismissal | `main/store.ts` `dismiss()` | Already implemented, already announces. **Do not write a second one** — this feature is the control, not the removal |
| Declaration order | `main/store.ts` `listSessions()` | Already insertion-ordered, and `declaredAt` is never updated. FR-004 is already true; the task is to not break it |
| Session identity | `main/store.ts` `sessionKey()` | `repoPath` + NUL + `sessionId`. The NUL is a security property, not an accident |
| Chip and elapsed | `components/Chip`, `lib/elapsed.ts` | A pill shows the same chip and the same elapsed formatting the title bar does |
| Session cap | `MAX_SESSIONS` (100) | The service's guard. The switcher degrades legibly rather than refusing |

---

## Two decisions this feature has to make first

Neither is in the plan, and both change the shape of everything after them.

### 1. The renderer gets its first write, and the bridge stops being read-only

The preload bridge has been exactly `getState` and `subscribe` since feature
001, and `tests/e2e/read-only.spec.ts` asserts that list **by name**, saying a
third member "should fail here and be argued for, whatever it is called". This
is that argument.

FR-012 requires a dismiss control in the window, and the store lives in main.
There is no version of this feature without a write. So the bridge gains
`select` and `dismiss`, `read-only.spec.ts` is updated deliberately rather than
loosened, and the property it actually protects is restated: **the renderer may
change what the board is showing, and may still send nothing to any agent.**
SC-005 is about the network, and IPC is not the network.

### 2. Main resolves the selection, not the renderer

Feature 006 established that selection is derivation rather than
synchronisation, held in the renderer. **That does not transfer here**, and the
reason is worth writing down: in 006 the renderer already held every story and
task, so it could resolve locally. Here it holds one session's content and
cannot see the others.

The alternative — pushing every held session's full projection so the renderer
can pick — is what makes this a real decision rather than a preference:
`MAX_SESSIONS` is 100 and each session may hold 200 stories, 500 tasks and 1,000
notes. Serialising all of that over IPC on every change, to display one of them,
is untenable at the cap even though it would be fine at three.

So: main holds the selected key as **window state** — no more durable than the
window's size, gone on restart (FR-020) — and pushes a lightweight summary per
session plus the full projection of the selected one. The fallback in FR-016
lives in the projection, where it cannot be forgotten by a view.

## Three rules for this feature

**The board never switches itself.** FR-009, and the most tempting "helpful"
behaviour in the whole product: an unselected session reaching `needs-you` shows
on its pill and does not seize the view. Auto-switching would move the board out
from under a reader *and* let one agent take the view from another.

**Nothing reorders and nothing expires.** FR-004 and FR-017. Pills are glanced
at rather than read, so position is something a developer learns — and recency
sorting moves the pill they are reaching for, because the one that moved is the
one they want.

**With one session, nothing changes at all.** The P1 story is an absence, and
SC-001 asks for it to be verified by comparison rather than assumed. The natural
failure is reserving permanent chrome for a switcher that usually has nothing to
show.

## Path conventions

```text
apps/board/src/renderer/src/app/SessionSwitcher.tsx
apps/board/src/renderer/src/app/SessionPill.tsx
apps/board/src/main/view.ts
apps/board/src/preload/index.ts
apps/board/tests/e2e/
```

---

## Phase 1: Foundational

**Purpose**: The projection, the bridge and the selection — none of it drawing
anything.

- [x] T001 Widen `BoardState` in `apps/board/src/main/view.ts` — `sessions: SessionSummary[]` in declaration order, plus the existing `session` now meaning *the selected one*. A summary carries only what a pill draws: key, repo, repoName, branch, chip, lastHeardAt, attributed. **Not** the reported body, for the reason in decision 2 above; say so in the comment
- [x] T002 Resolve the selection in `toBoardState(store, selected)` — the named key if it is still held, otherwise the first in declaration order, otherwise null. FR-016 lives here so no view can forget it. Replace the `sessions[0]` comment that says feature 008 will do this
- [x] T003 [P] Extend `apps/board/tests/unit/view.test.ts` — summaries in declaration order and never in recency order; a summary carries no reported body; the selected session projects in full; an unknown or dismissed key falls back to the first; an empty store gives `null` and `[]`
- [x] T004 Add `select` and `dismiss` to `apps/board/src/preload/index.ts` and the matching `ipcMain` handlers in `apps/board/src/main/app.ts`, holding the selected key in the main process as window state. **Both take a session key and neither returns board data** — the change arrives by the existing subscription, so there is one path by which the window learns anything
- [x] T005 [P] Extend `apps/board/tests/integration/` with a dismissal test — dismissing removes the board's copy, announces, and **sends nothing to any agent**; a dismissed session that pushes again returns with its new state (FR-014); dismissing the selected session falls the selection back (FR-016); dismissing the last leaves the waiting state

**Checkpoint**: Selection and dismissal are correct with no UI involved.

---

## Phase 2: User Story 1 — Nothing changes when there is only one session (Priority: P1) 🎯 MVP

**Goal**: The ordinary case pays nothing for the occasional one.

**Covers**: FR-001, FR-002; SC-001

**Independent test**: With one session, no switcher exists; with two, it
appears; back to one, it is gone again.

- [x] T006 [US1] Create `apps/board/src/renderer/src/app/SessionSwitcher.tsx` and its CSS returning `null` below two sessions — the threshold in **one** place, so no caller can draw a switcher for a single session by forgetting to check
- [x] T007 [US1] Render it in `App.tsx` between the title bar and the tab strip, and thread the selected session through as today
- [x] T008 [P] [US1] Write `apps/board/tests/e2e/sessions.spec.ts` covering US1 — no switcher at zero or one session, however many times that session reports; it appears at two; it is gone again when the count falls back to one (FR-002). **Assert the single-session window is unchanged by comparison** (SC-001), not by eye

---

## Phase 3: User Story 2 — See and switch between concurrent sessions (Priority: P2)

**Goal**: A second agent is reachable, and the whole board follows the choice.

**Covers**: FR-003, FR-004, FR-005, FR-010, FR-011; SC-003, SC-004, SC-009

**Independent test**: Two sessions; selecting each in turn makes every view show
that session and nothing of the other.

- [x] T009 [US2] Create `apps/board/src/renderer/src/app/SessionPill.tsx` and its CSS — identity (repo, and branch while there is room), chip, elapsed, and the dismiss control. Density degrades by **dropping** information rather than shrinking it, per the plan
- [x] T010 [US2] Identify an unattributed script session as such (FR-011) — `attributed` is already projected, and a script that pushes is not an agent
- [x] T011 [P] [US2] Extend `sessions.spec.ts` for US2 — both listed in declaration order; selecting one makes every tab show it and nothing of the other; a report on the *unselected* session does not move the selection (FR-009); a third session is appended without disturbing order or selection; switching away and back shows current state
- [x] T012 [P] [US2] Two sessions in the same repository on different branches, and **two on the same branch**, are both listed and remain individually selectable — the edge case that a naive key by repository alone would silently merge

---

## Phase 4: User Story 3 — Notice an unselected agent asking for attention (Priority: P2)

**Goal**: The one attention channel keeps working when the developer is looking
elsewhere.

**Covers**: FR-006, FR-007, FR-008, FR-009, FR-019; SC-002

**Independent test**: The unselected session reports `needs-you`; its pill shows
it, and nothing else moves.

- [x] T013 [US3] Draw chip and elapsed on every pill, with the attention state visibly distinct (FR-008) — this is what stops the board's only way of asking for a human being silently dropped for every session but one
- [x] T014 [P] [US3] Extend `sessions.spec.ts` for US3 — an unselected `needs-you` shows on its pill, does **not** switch the board, does not reorder the pills, and does not move the window (FR-019, asserted on bounds, focus and always-on-top as `unread.spec.ts` does); a later ordinary report returns the pill to ordinary; several sessions needing attention at once each show their own state with none promoted

---

## Phase 5: User Story 4 — Clear a session the developer is done with (Priority: P3)

**Goal**: Finished sessions leave, and nothing is told about it.

**Covers**: FR-012, FR-013, FR-014, FR-015, FR-016; SC-005, SC-006

**Independent test**: Dismiss a session; it leaves, the agent is unaffected, and
it returns if it reports again.

- [x] T015 [US4] Wire the pill's dismiss control to the bridge, and word it so it conveys **clearing this board's copy** rather than closing or ending anything (FR-015) — the plan calls this thin cover rather than solved, so the wording is the whole mitigation
- [x] T016 [P] [US4] Extend `sessions.spec.ts` for US4 — dismissal removes the pill and the session; **zero outbound requests across the whole exercise** (SC-005), teeth-checked; a dismissed session that reports again returns (SC-006); dismissing the selected one falls back rather than showing nothing; dismissing the last returns the waiting state

---

## Phase 6: Polish

- [x] T017 [P] Six sessions at the 380px floor — distinguishable, every one selectable, no horizontal scrolling (SC-007, FR-018), using the content-size resize helper from feature 006. Plus hostile and very long repository and branch names in a pill (the edge case list)
- [x] T018 [P] Assert nothing expires — sessions left idle across a long simulated elapsed time are all still listed (FR-017, SC-008). The board has no timer that removes anything and this is what keeps it that way
- [x] T019 Update `tests/e2e/read-only.spec.ts` deliberately for the widened bridge — the assertion becomes four named members, and the *property* it protects is restated: the window may change what it shows and still send nothing to any agent. Do not loosen it to a count
- [x] T020 Walk the `stacks/vite-react.md` checklist for the switcher tree, and extend `only-reported.spec.ts` if a pill draws anything derived
- [x] T021 Run the build, typecheck, both suites, then walk [quickstart.md](quickstart.md), correcting it where it turns out to be wrong
- [x] T022 [P] Update `CHANGELOG.md` and `STATUS.md`
- [x] T023 Read back the full diff, then merge

---

## Dependencies

Foundational → US1 → US2 → US3 → US4 → Polish.

T001 and T002 block everything. T004 blocks T015. T009 blocks T013 and T015.
Everything marked `[P]` is genuinely independent.

US1 is first and is an absence: the switcher must not exist before it is needed.

## What is deliberately not here

Auto-switching to a session that needs attention, however helpful it sounds —
FR-009, and it would let one agent take the view from another. Reordering by
recency or by attention. Any timed expiry, hiding or collapsing of a session.
A merged view across sessions, which the spec rules out because two repositories
interleaved in one task list would be unreadable. Naming or renaming a session,
which would be board-owned state about an agent's work. Retaining the selection
across a restart.
