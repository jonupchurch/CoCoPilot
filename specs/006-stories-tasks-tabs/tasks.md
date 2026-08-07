# Tasks: Stories and Tasks Tabs

**Input**: Design documents from `specs/006-stories-tasks-tabs/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [quickstart.md](quickstart.md)

Features 001–005 are merged. This feature adds the two remaining detail views
and replaces the placeholder `App.tsx` renders for the `stories` and `tasks`
tabs.

**Tests**: Included. The weight is different again from feature 005: that one
mostly tested that failure was contained, this one mostly tests that **the
developer is not moved**. Selection surviving a report, surviving a resize, and
falling back to something valid when what they were reading ceases to exist.

## Format: `[ID] [P?] [Story] Description`

---

## What is already built and must not be rebuilt

| Thing | Where | Use it for |
|---|---|---|
| Status vocabulary | `renderer/src/lib/vocabulary.ts` | `classify`, `isDone`, `isActive`. **Import; never restate.** Two definitions would show one status two colours on two tabs |
| Status rendering | `components/StatusLabel.tsx` | `StatusDisc`, `StatusLabel` — unrecognised gets no disc and keeps its text |
| Elapsed | `lib/elapsed.ts` | `elapsed`, `focusAge` — `focusAge` is the `now`/`4m` band the current-task marker wants |
| Summaries | `lib/summarise.ts` | `specSummary` and friends, and `MINUS` |
| Collapsible section | `components/Section.tsx` | Summary is **required** and typed so `null`/`undefined` do not satisfy it |
| Tabs | `app/App.tsx`, `app/TabStrip.tsx` | The strip, the availability rule and the fallback all exist |

---

## Four things the export draws that the contract cannot supply

Read [`resources/CoCoPilot Overview Panel.dc.html`](../../resources/CoCoPilot%20Overview%20Panel.dc.html)
before writing either view — it is canon for look and feel (decision 8). Four of
its bindings have no source in the payload, and each has to be *decided* rather
than discovered halfway through:

1. **`story.spec`**, a spec path in the story detail header. `Story` has no
   `specPath` — only `ReportedFeature` does. Either show the feature's, clearly
   as the feature's, or leave the slot out. Do not invent a per-story path.
2. **`task.updated`**, a per-task age. There is no per-task timestamp in the
   contract and decision 26 refuses the state that would create one. Feature 004
   already answered this: the age is the *report's*, and it is shown against the
   current task only. Follow that, do not diverge.
3. **`story.taskSummary`** (`2/4`) is derived. Allowed — deriving a summary of
   what was sent is not inventing content — but it is exactly the kind of value
   `only-reported.spec.ts` exists to catch, so it must be declared there.
4. **No unassigned scope anywhere in the export.** FR-018 requires every
   reported task to be reachable including one whose `storyId` matches nothing.
   That scope has to be designed, not copied.

## Three rules for this feature

**The developer is never moved.** Not by a report, not by a resize. FR-014 and
FR-012 are the same promise from two directions, and `useSelection` is the one
piece of logic in this feature worth unit tests.

**A selection that ceases to exist falls back; it never renders nothing.**
Reports replace wholesale (decision 26), so a story disappearing between two
reports is ordinary, not an edge case. A view that renders nothing reads as a
crash.

**There are no handlers to enforce read-only, because there are no controls.**
FR-020 and SC-008 are structural: no action component exists in this tree at
all. The test is zero outbound requests across a full exercise of both views.

## Path conventions

```text
apps/board/src/renderer/src/views/stories/
apps/board/src/renderer/src/views/tasks/
apps/board/src/renderer/src/state/useSelection.ts
apps/board/src/renderer/src/lib/breakpoint.ts
apps/board/tests/e2e/
```

---

## Phase 1: Foundational

**Purpose**: The projection, the selection model and the breakpoint — everything
both views need, none of it rendering anything.

- [x] T001 Widen `SessionView` in `apps/board/src/main/view.ts` with `stories`, listed explicitly rather than spread from `session.report`, and replace the comment that says stories are withheld until feature 006 with one saying what they are now for
- [x] T002 [P] Extend `apps/board/tests/unit/view.test.ts` — stories project exactly as reported, in reported order, and a session with no report projects `[]` rather than absent
- [x] T003 Create `apps/board/src/renderer/src/lib/breakpoint.ts` — the 640px breakpoint as **one** definition with a comment saying both views share the number and diverge in what they do with it, plus a `useIsNarrow()` hook over `matchMedia` so a resize does not require a re-render loop
- [x] T004 [P] Write `apps/board/src/renderer/src/lib/breakpoint.test.ts` — the boundary is inclusive at 640 per FR-010 ("at or above"), and the hook subscribes and unsubscribes rather than polling
- [x] T005 Create `apps/board/src/renderer/src/state/useSelection.ts` — holds `{ storyId, taskId }`, reconciles after every report, and exposes the resolved story and task rather than raw ids so no view repeats the lookup
- [x] T006 Write `apps/board/src/renderer/src/state/useSelection.test.ts` — **the test that matters most in this feature.** A selection that still exists survives a report; one that does not falls back to the first valid item; a task selection survives its story surviving; a task whose story disappears falls back with it; an empty report clears to nothing without throwing; and the fallback is *the first reported item*, not the nearest by index, because index-nearest silently moves the developer to an unrelated story
- [x] T007 Decide and document the unassigned scope in `useSelection.ts` — the scope that holds tasks whose `storyId` matches no reported story (FR-018), including the case of `storyId: null`. Name it, say why the export has no such thing, and make it a real selectable scope rather than a special case threaded through both views

**Checkpoint**: Selection reconciles correctly against a changing report, with
no UI involved.

---

## Phase 2: User Story 1 — Read a story in full (Priority: P1) 🎯 MVP

**Goal**: The full text of the story behind the current task, in at most two
actions from the Overview tab (SC-001).

**Covers**: FR-001, FR-002, FR-003, FR-016, FR-017, FR-019, FR-020; SC-001, SC-006

**Independent test**: Report several stories; one can be selected and read in
full, with narrative, criteria, tasks and touched files, and the list marks
which.

- [x] T008 [US1] Create `apps/board/src/renderer/src/views/stories/StoryList.tsx` and its CSS — the 268px column from the export: id, priority, status chip, title, task summary, and the `· now` marker on the story owning the current task
- [x] T009 [US1] Create `apps/board/src/renderer/src/views/stories/StoryDetail.tsx` and its CSS — the header row, the As a / I want / so that card, numbered acceptance criteria, the task list with per-row status, and Touches. Every absent field omitted rather than drawn empty (FR-017), since `asA`, `want`, `soThat`, `priority` and `status` are all nullable
- [x] T010 [US1] Create `apps/board/src/renderer/src/views/stories/StoriesView.tsx` — composes list and detail, wired to `useSelection`, and says so explicitly when no stories were reported
- [x] T011 [US1] Replace the `stories` placeholder in `apps/board/src/renderer/src/app/App.tsx`, threading `now` as the Overview tab already does
- [x] T012 [P] [US1] Write `apps/board/tests/e2e/stories.spec.ts` — stories list in reported order with all four fields; selecting one shows its full detail and marks it in the list; the narrative, criteria, tasks and files are exactly what was reported; a story with none of the optional fields renders without empty scaffolding
- [x] T013 [US1] Extend `apps/board/tests/e2e/only-reported.spec.ts` for this tab — the task summary and the current-task marker are derived, so declare them; anything else appearing is a finding

---

## Phase 3: User Story 3 — Read a status that means nothing to the board (Priority: P2)

**Goal**: The open-ended status vocabulary behaves identically on three tabs.

**Covers**: FR-007, FR-008, FR-009

**Independent test**: A mix of recognised statuses and arbitrary text; the
recognised ones carry their treatments, the rest render neutrally with text
intact.

*Sits before US2 because both detail views render statuses and doing this once,
first, is what stops the second view growing its own copy.*

- [x] T014 [US3] Render every status in both views through `StatusLabel`/`StatusDisc` from feature 004 — no local mapping, no second synonym table, no `status === 'done'` anywhere in this tree. **Enforced rather than inspected**: `tests/source-hygiene.test.ts` fails on a synonym literal or a `classify` call anywhere in the renderer outside `lib/vocabulary.ts` and `components/StatusLabel.tsx`, which is what stops the Tasks view growing its own copy in Phase 4 before it is written
- [x] T015 [P] [US3] Write `apps/board/tests/e2e/status-vocabulary.spec.ts` — the same status matrix read from every surface that draws one and compared, so a divergence fails rather than being noticed later. Includes `donee` staying neutral, `  DONE  ` being recognised without its text being canonicalised, and a 200-character status truncating with its full text on `title` (FR-009). **Three surfaces now** — Spec tasks, Plan steps and a story's tasks; the Tasks tab joins them in T020, which is the only place it can, since the view does not exist until Phase 4

---

## Phase 4: User Story 2 — Read one task in full (Priority: P2)

**Goal**: The finest grain — what this task is, what qualifies it as done, and
what it touches.

**Covers**: FR-004, FR-005, FR-006, FR-017, FR-018

**Independent test**: Select a story, then a task within it; its detail, checks
and files are shown, and changing the scoped story follows.

- [x] T016 [US2] ~~Create `views/tasks/StoryScopePicker.tsx`~~ — **deviation, deliberate.** The Stories tab's narrow-layout picker (T021) is the same control: same three fields, same dismissal-on-outside-click. Writing a second one would be the duplication T014 exists to forbid, one feature later and in a component instead of a table. Extracted to `components/ScopePicker.tsx` + `.css` instead, taking a `testId` so two instances stay separately addressable, and **present at every width here** because in this view it is the scope control rather than a fallback. `taskSummary` moved with it to `lib/summarise.ts`, where the other derived summaries live
- [x] T017 [US2] Create `apps/board/src/renderer/src/views/tasks/TaskList.tsx` and its CSS — the scoped story's tasks, each with disc, id, status and title, and the current one marked with the report's age
- [x] T018 [US2] Create `apps/board/src/renderer/src/views/tasks/TaskDetail.tsx` and its CSS — header, title, the current-task line, detail, Checks, Files, and From the story. A task with no checks or no files omits those blocks rather than drawing empty headings. The age is the **report's**, and its `title` says so outright rather than letting a bare `4m` beside a task be read as the task's own; `focus.note` appears against the named task only, since it is reported against the session
- [x] T019 [US2] Create `apps/board/src/renderer/src/views/tasks/TasksView.tsx` and replace the `tasks` placeholder in `App.tsx` — including the explicit "this story has no tasks" state (US2 scenario 5)
- [x] T020 [P] [US2] Write `apps/board/tests/e2e/tasks.spec.ts` — the scoped story's tasks list and one shows in full; changing scope follows in both list and detail; a story with no tasks says so; the current task is marked with its elapsed time; an orphan task is reachable through the unassigned scope and is *not* listed under a story it does not belong to. Also add the Tasks tab to `SURFACES` in `status-vocabulary.spec.ts`, which is the deferred half of T015

---

## Phase 5: User Story 4 — Use both views in a narrow panel (Priority: P3)

**Goal**: The views survive the product's actual habitat — a narrow strip beside
an editor.

**Covers**: FR-010, FR-011, FR-012, FR-013; SC-002, SC-004

**Independent test**: Below the breakpoint each view adopts its narrow
arrangement, all content reachable, nothing scrolling sideways, selection
intact across the boundary.

- [x] T021 [US4] Create the collapsed list for the narrow story view, showing id, title and task summary so items are distinguishable (US4 scenario 4) — now `components/ScopePicker.tsx`, shared with the Tasks tab per T016
- [x] T022 [US4] Wire both views to `useIsNarrow` — Stories swaps its list for the picker, Tasks stacks its list above the detail. **Both CSS files carry the comment explaining why they differ**, because without it this reads as an inconsistency someone will helpfully unify
- [x] T023 [P] [US4] Write `apps/board/tests/e2e/breakpoint.spec.ts` — each arrangement at each side of 640; a selection made wide survives narrow and back (SC-004); every item selectable from each picker; and **no horizontal scroll at the window minimum on either tab**, asserted the way feature 004 does it, on `scrollWidth` rather than by eye. The resize helper **asserts the width it actually got**: at a 1.5 display scale an odd content width rounds up (639 → 640) and the renderer sees a resize a beat late, so a spec that trusted its own argument was testing 642 and 452 rather than the boundary and the floor

---

## Phase 6: Polish

- [ ] T024 [P] Write `apps/board/tests/e2e/read-only.spec.ts` — SC-008 as an absence test. Activate every control in both views, then assert **zero** outbound requests from the window. Teeth-check it by temporarily adding a `fetch` and confirming it fails
- [ ] T025 [P] Extend `apps/board/tests/e2e/stories.spec.ts` and `tasks.spec.ts` for limits and hostile content — 200 stories and 500 tasks navigable with selection responding (SC-007), long titles/criteria/paths truncating with full text retrievable, and markup rendering as visible characters (SC-009)
- [ ] T026 Walk the `stacks/vite-react.md` checklist for both trees — stable keys, no colour literals outside `tokens.css`, no `useEffect` computing what could be derived, and no timer refreshing data
- [ ] T027 Run `npm run typecheck`, the full suite, the Playwright suite and a build, then walk the seven scenarios in [quickstart.md](quickstart.md), correcting the quickstart where it turns out to be wrong rather than leaving it agreeing with itself
- [ ] T028 [P] Update `CHANGELOG.md`, `STATUS.md` and the design-round-3 carried-forward list if this feature closes any of it
- [ ] T029 Read back the full diff, then merge

---

## Dependencies

Foundational → US1 → US3 → US2 → US4 → Polish.

US3 is second despite being P2 because both detail views render statuses, and
doing it once before the second view exists is what prevents a second copy of
the vocabulary. US4 is last because a layout cannot adapt before it exists.

T001 blocks everything — no view can render a story the projection does not
carry. T005 blocks T010 and T019. T007 blocks T016. Everything marked `[P]` is
genuinely independent.

## What is deliberately not here

Sorting, filtering, grouping or re-ordering — FR-016 forbids all four, and the
board never improves on the agent's order. Any control that would send something
to an agent: no approve, no retry, no mark-done, however reasonable one looks on
the most detailed screen in the product. Retaining selection across a restart,
which would be the only durable state in the system. Multiple sessions, which is
feature 008. Copying displayed text, which the spec names as a general window
affordance rather than something these views own.
