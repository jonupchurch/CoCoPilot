# Tasks: Notes

**Input**: Design documents from `specs/007-notes/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [quickstart.md](quickstart.md)

Features 001–006 are merged. This feature replaces the last placeholder
`App.tsx` renders — the `notes` tab — and adds the unread dot to a tab strip
that has been ready for it since feature 003.

**Tests**: Included. The weight is different again. Feature 005 tested that
failure was contained; 006 tested that the developer is not moved. This one
mostly tests that **the view does not lie**: it says notes are cleared when the
window closes, and every part of the tree has to agree with that sentence.

## Format: `[ID] [P?] [Story] Description`

---

## What is already built and must not be rebuilt

| Thing | Where | Use it for |
|---|---|---|
| The append endpoint | `main/store.ts` `appendNote` | Notes already accumulate, capped at `MAX_NOTES_PER_SESSION` (1,000). This feature is the surface, not the plumbing |
| The held note | `main/store.ts` `Note` | `{ text, source, receivedAt }` — all three, and there is no fourth |
| Elapsed | `lib/elapsed.ts` | `elapsed` for the gutter. **Not** `focusAge`: that one coarsens the first minute to `now`, which is right for a focus tag and wrong for a list where several notes may land inside a minute |
| Tabs and the strip | `app/TabStrip.tsx` | The strip, the availability rule, `data-testid={tab-*}`. It has no dot yet; that is T014 |
| Notes count | `main/view.ts` `noteCount` | Already projected. `notes` themselves are not — that is T001 |
| Inertness | The whole renderer | No `dangerouslySetInnerHTML` anywhere, asserted by `inert-and-layout.spec.ts` |

---

## Four things the export draws that the contract cannot supply

Read [`resources/CoCoPilot Overview Panel.dc.html`](../../resources/CoCoPilot%20Overview%20Panel.dc.html)
before writing the view — it is canon for look and feel (decision 8). Four of
its bindings have no source in the payload. This is the fourth feature running
where that has been true, so it is a step in the work rather than a surprise:
walk every binding against `packages/contract/src/schema.ts` first.

1. **A second meta value per note.** The export draws two mono values under each
   note — a phrase (`noticed while editing`) *and* a file path or identifier
   (`src/hooks/useSession.ts`, `US-002`, `T-011`). `NoteRequest` carries exactly
   one optional `source`. Show the one that exists; do not split `source` on a
   separator to manufacture the other.
2. **The gutter dot's colour.** The export draws it teal on the newest note and
   **ember on one row** (`worth knowing`). Ember is reserved for `needs-you`
   (decision 15): the chip is the sole channel by which an agent asks for a
   human, and a note that coloured itself ember would be a second one. Teal on
   the newest restates what the relative time beside it already says. Decide one
   treatment and say why in the component.
3. **`since 09:14`** in the header — a wall-clock time. Derivable from the oldest
   note's `receivedAt`, but nothing else on this board shows a clock: every time
   in the product is elapsed, because elapsed is true in any timezone and does
   not need to say which day it means. Prefer the product's convention.
4. **`12 notes` in the header, and `clears all twelve` in the footer.** The spec's
   Assumptions say notes are **not counted anywhere**, because "a count invites
   clearing, and there is nothing to clear". Read the reason, not just the rule:
   it is an argument against a *badge*. A section header stating what the list
   below it contains is the same derived summary every other header on this
   board carries, and the footer naming the number makes the impermanence
   concrete rather than abstract. **Recommendation: no count on the tab or the
   indicator (FR-012, and the assumption's actual target), a count in the view's
   own header and footer.** Decide it explicitly in T009 and record it.

## Three rules for this feature

**The view must not lie.** FR-006 through FR-009 are one requirement seen from
four sides: the footer says these notes are cleared when the window closes, and
a save, pin, star, archive or export control anywhere in the tree would falsify
it. No such control would break any code — it would make an honest sentence
dishonest, which is why the test is an absence test.

**An arriving note must not move the reader.** This is the one most likely to
fail. Notes arrive at the *top* of a list the developer may have scrolled, and
in an ordinary scroll container inserting above the viewport pushes everything
down by the height of the new row — the reading position visibly jumps. Chromium
anchors scrolling by default, which may make this work without effort; "may" is
not a test result.

**Notes are the only thing that accumulates.** Everything else on the board is
replaced wholesale (decision 26). That makes this the only view where order,
identity and stable keys across an update actually matter.

## Path conventions

```text
apps/board/src/renderer/src/views/notes/
apps/board/src/renderer/src/state/useUnread.ts
apps/board/tests/e2e/
```

---

## Phase 1: Foundational

**Purpose**: The projection and the unread rule — everything the view needs,
none of it rendering anything.

- [x] T001 Widen `SessionView` in `apps/board/src/main/view.ts` with `notes`, listed explicitly rather than spread, in the same block that argued for `stories` in feature 006 — and say in the comment that this is the one field whose contents accumulate rather than being replaced
- [x] T002 [P] Extend `apps/board/tests/unit/view.test.ts` — notes project exactly as held, in **arrival** order (the view reverses for display; the projection does not pre-sort), and a session with no notes projects `[]` rather than absent
- [x] T003 Create `apps/board/src/renderer/src/state/useUnread.ts` — `noteCount` is already projected, so the rule is "more notes than there were when the notes view was last on screen". Derived from the count plus one piece of state, **without** an effect watching for arrivals: the pattern feature 006 established is that reconciliation is derivation, and an effect here would be a second source of truth for something a comparison answers
- [x] T004 [P] Write `apps/board/src/renderer/src/state/useUnread.test.ts` — a note arriving while elsewhere sets it; arriving while the notes view is active does not; visiting clears it; **the count going *down* does not set it** (a session dismissed and returning, or a switch between sessions in feature 008, must not read as an arrival); and it never exposes a number, so no caller can render one

**Checkpoint**: The unread rule is right with no UI involved.

---

## Phase 2: User Story 1 — Read what the agent recorded (Priority: P1) 🎯 MVP

**Goal**: The notes the agent wrote this session, newest first, each with how
long ago and why.

**Covers**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-010, FR-017, FR-018

**Independent test**: Record several notes with and without a `source`; they list
newest first with relative times, sources where supplied and nothing where not.

- [x] T005 [US1] Create `apps/board/src/renderer/src/views/notes/NoteRow.tsx` and its CSS — the export's row: a 44px gutter carrying the relative time and the dot, and a body carrying the text and the source line. Flat, no card: three lines at 13px with no container, because forty boxes is unreadable and forty rows is a column. A note with no `source` omits the line rather than placeholding it (FR-004)
- [x] T006 [US1] Decide the dot in `NoteRow.tsx` per gap 2 above, and write the reason in the file — whatever is chosen, it must not be ember, and it must not claim a thing the row does not know
- [x] T007 [US1] Create `apps/board/src/renderer/src/views/notes/NotesView.tsx` and its CSS — newest first by **reversing arrival order**, not by sorting on `receivedAt` (equal timestamps are ordinary at this resolution, and a sort makes their order arbitrary where arrival order is a fact). Keys from arrival index, which is stable because notes only ever append. Explicit empty state (FR-010)
- [x] T008 [US1] Replace the `notes` placeholder in `apps/board/src/renderer/src/app/App.tsx`, threading `now` as the other three tabs do, and delete the placeholder branch entirely — with `notes` filled in there is no tab left for it to serve
- [x] T009 [US1] Decide the header per gap 4 above — `This session` plus what the list holds — and record the decision and its reasoning in `NotesView.tsx`, since it is a deliberate reading of an assumption rather than a transcription
- [x] T010 [P] [US1] Write `apps/board/tests/e2e/notes.spec.ts` — newest first; text exactly as written; a relative time per note; the source line present where supplied and **absent** where not; the empty state; and only the selected session's notes (FR-018)
- [x] T011 [US1] **The arrival test**, in the same spec — scroll a long list, send a note, and assert the reading position is unchanged and the new note is at the top. Assert on `scrollTop` against a measured anchor row, not by eye. If Chromium's scroll anchoring does not hold it, fix it in the view and say in the CSS what is holding it up

---

## Phase 3: User Story 2 — Understand that notes are not storage (Priority: P1)

**Goal**: A developer knows, without discovering it the hard way, that these
disappear.

**Covers**: FR-006, FR-007, FR-008, FR-009; SC-002, SC-003, SC-007

**Independent test**: The view states impermanence, offers no affordance
implying durability, and is empty after a restart.

- [x] T012 [US2] Create `apps/board/src/renderer/src/views/notes/ImpermanenceFooter.tsx` and its CSS — its own component, per the plan's structure decision, so it is a thing that must be *deliberately removed* rather than markup that can be lost in a refactor. Dashed top rule as the export draws it; both sentences (FR-006 and FR-007) in the agent-facing phrasing the export uses
- [x] T013 [P] [US2] Extend `notes.spec.ts` with the honesty test — the footer's two statements are present; **no** save, pin, star, archive, export, delete or compose control exists anywhere in the notes tree, asserted structurally over the source as well as over the rendered page; and notes are gone after a restart (SC-007). Teeth-check the absence half by adding a pin button and confirming it fails

---

## Phase 4: User Story 3 — Notice a note without watching for it (Priority: P2)

**Goal**: A note that arrived elsewhere is noticeable and nothing more.

**Covers**: FR-011, FR-012, FR-013, FR-014; SC-005

**Independent test**: With another view active, a note arrives; a muted countless
dot appears on the notes tab and clears when the view is opened.

- [x] T014 [US3] Add the dot to `apps/board/src/renderer/src/app/TabStrip.tsx` and its CSS — one optional boolean prop, muted, `aria-hidden` with the state carried in the tab's accessible name instead, and **no number anywhere in the markup** so there is nothing for a future change to start rendering
- [x] T015 [US3] Wire it in `App.tsx` from `useUnread` — the strip is told whether to draw it and knows nothing about notes
- [x] T016 [P] [US3] Write `apps/board/tests/e2e/unread.spec.ts` — appears when a note arrives while elsewhere; carries no count (asserted on the *text* of the tab, not just the absence of a badge element); clears on visiting; never appears when already on the tab; and **nothing steals focus or raises the window** (FR-014), asserted on the window's focus and always-on-top state before and after

---

## Phase 5: User Story 4 — Read forty notes without losing the thread (Priority: P3)

**Goal**: A long session's notes stay readable.

**Covers**: FR-015, FR-016; SC-006, SC-008

**Independent test**: 300 notes remain scrollable and individually legible at the
minimum width with no horizontal scrolling.

- [ ] T017 [P] [US4] Extend `notes.spec.ts` for scale and hostile content — 300 notes all reachable with the last one legible; a note at the 4,000-character cap displayed without truncation obscuring its point; a single-character note; markup as visible characters (SC-009); and no horizontal scroll at the 380px floor, using the content-size resize helper feature 006 wrote rather than a bare `setSize`

---

## Phase 6: Polish

- [ ] T018 [P] Extend `apps/board/tests/e2e/only-reported.spec.ts` with a notes-tab subtraction block — the relative times, the header summary and the footer are all board text, and each has to be declared. This is the fourth tab; the block is deliberately a fourth copy, for the reason the second one gives
- [ ] T019 Walk the `stacks/vite-react.md` checklist for the notes tree — stable keys, no colour literals outside `tokens.css` (now enforced by `tests/source-hygiene.test.ts`), no `useEffect` computing what could be derived, and no timer refreshing data
- [ ] T020 Run `npm run build --workspace @cocopilot/board`, `npm run typecheck`, `npm test` and `npm run test:e2e`, then walk the five scenarios in [quickstart.md](quickstart.md), correcting the quickstart where it turns out to be wrong rather than leaving it agreeing with itself — its prerequisites and its `npm test --workspace=apps/board` are both already stale
- [ ] T021 [P] Update `CHANGELOG.md` and `STATUS.md`, including the round-2 carried-forward item this feature closes: **Notes drawn at six entries rather than forty**
- [ ] T022 Read back the full diff, then merge

---

## Dependencies

Foundational → US1 → US2 → US3 → US4 → Polish.

T001 blocks everything: no view can render notes the projection does not carry.
T003 blocks T015 and T016. T005 blocks T007. Everything marked `[P]` is
genuinely independent.

US2 sits second despite sharing P1 with US1 because the footer is a claim about
the whole view, and the view has to exist for the claim to be about something.

## What is deliberately not here

Composing, editing or deleting a note — the developer never types on this board,
which is the reason a notes view exists in a product that takes no input.
Grouping, filtering and search, named as excluded in the spec and recorded as
the obvious future addition. Any control that would retain a note, which would
falsify the footer. Counting notes on the tab, which would read as an inbox.
Multiple sessions, which is feature 008 — this view follows the selected session
and there is currently one.
