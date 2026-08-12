# Tasks: Spec-Kit Tree

**Input**: Design documents from `specs/011-speckit-tree/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [quickstart.md](quickstart.md), [data-model.md](data-model.md), [contracts/](contracts/)

Features 001–009 are merged. **Feature 010 is built and merged before this one**,
which is settled rather than assumed: T037 measures a strip that includes 010's
ticket destination, T042's decision numbers follow 010's, and both features edit
`TabStrip.tsx`, `App.tsx`, `store.ts` and `view.ts`. Rebase this branch onto
`main` once 010 has landed, before starting T001.

**Tests**: Included, and the centre of gravity has moved again. Feature 007 tested
that the view does not lie; 010 tested that the board refuses what it is told.
This one mostly tests **sequences rather than screens**. Its two hardest
requirements — that no destination is taken from a reader, and that a report never
moves one — are false or true only across a series of reports and navigations, and
a test that looks at one rendered page cannot see either.

There is no Setup phase: this feature adds no dependency to any package.

## Format: `[ID] [P?] [Story] Description`

---

## What is already built and must not be rebuilt

| Thing | Where | Use it for |
|---|---|---|
| **The other placement rule** | `state/useSelection.ts` `buildScopes` | **Read it, do not edit it.** It unions the two link directions and can place one task under two stories. It keeps serving every session this feature does not take over. T014 is the only change to that file, and it is a comment |
| `Scope`, `UNASSIGNED`, `scopeKey` | `state/useSelection.ts` | Reused as **values**. `Scope` is `{ id, story, tasks }` — a shape, not a policy — which is what lets the existing detail components be handed one. A second sentinel for the unassigned group must not be invented |
| The two detail components | `views/stories/StoryDetail.tsx`, `views/tasks/TaskDetail.tsx` | Both take a `Scope`. The pane dispatches to them rather than re-implementing either |
| The task row | `components/TaskRow.tsx` | `{ task, focused, elapsedTag }`. The tree's leaf wraps it |
| The status vocabulary | `lib/vocabulary.ts`, `components/StatusLabel.tsx` | `classify` returns `todo \| active \| blocked \| done \| unrecognised` and refuses to guess. `tests/source-hygiene.test.ts` **fails the build** if any other file classifies a status |
| Collapsible sections | `components/Section.tsx` | The detail pane's sections, as every other view uses them |
| The narrow arrangement | `lib/breakpoint.ts` | `BREAKPOINT` is 640 and `useIsNarrow` uses `matchMedia`, not a resize listener. The number lives there so CSS and component agree by construction |
| Elapsed time | `lib/elapsed.ts` | `focusAge` for the current-task tag, as `TasksView` already uses it |
| One-way session facts | `main/store.ts` `putTicket` (feature 010) | The pattern for holding something a report cannot disturb. Here it is one boolean and an OR, not a new method |
| The counting tests | `tests/e2e/read-only.spec.ts`, `only-reported.spec.ts` | Both count or subtract. Both are edited on purpose, never relaxed |
| The content-size resize helper | feature 006's e2e helper | The floor is measured with this, not with a bare `setSize` |

---

## Four rules for this feature

**The other placement rule is not a bug.** `buildScopes` unions `task.storyId` and
`story.taskIds`, and argues for it in its own comment: *"showing it in both places
is more honest than silently picking a winner."* That is right for two scoped
lists and wrong for a tree, where one task under two parents reads as two tasks.
This feature supersedes it **in a new view** while the old one goes on serving
every non-Spec-Kit session and every session whose developer kept the old views.
Superseded rules do not get edited. If a task finds itself changing `buildScopes`,
it has misread the plan.

**Both presence booleans are one-way, and that is the whole safety argument.**
`everReportedStories` is only ever set true; a session id is only ever added to
`usedOldViews`. Therefore no destination can go from offered to not-offered while
a session lives — except the legacy views at the single moment the tree first
appears, where "once used" decides, and a developer who never opened a view cannot
be reading it. **Any code that can clear either boolean re-opens the exact fault
decision 36 was raised about.** There is no timing to get right here; there is an
invariant to not break.

**Counting is the only thing the board derives.** Counts over `classify`, never a
rolled-up status word, never a percentage, never a bar — and an unrecognised
status is counted as unrecognised and said so, never folded into "not done". A
reported status always wins, and the board never shows that a story's status and
its tasks disagree.

**Exactly-once is the assertion, not a nice property.** Every task lands in
exactly one scope, so `tasks drawn = tasks reported` is a single check that
catches most of what placement can get wrong. Write it before the cases.

## Path conventions

```text
apps/board/src/main/
apps/board/src/renderer/src/state/
apps/board/src/renderer/src/lib/
apps/board/src/renderer/src/views/speckit/
apps/board/tests/e2e/
```

---

## Phase 1: Foundational

**Purpose**: The one fact the store has to hold, and the four rules — placement,
presence, counting, tree state — as pure functions with nothing drawing anything.
No user story can begin until a session can be *known* to be Spec-Kit shaped.

- [ ] T001 Add `everReportedStories: boolean` to `Session` in `apps/board/src/main/store.ts`, set by an OR in `putReport` when the incoming report carries at least one story. **Never cleared** — no reset, no else branch, no timer. Say in the comment that reports replace wholesale, so the report on screen cannot answer "has this session ever had stories", which is why the fact is held rather than derived
- [ ] T002 **Argue the decision 26 exception in `putReport`'s own comment**, because this is the first thing in that method that survives a replace and the next feature to want one will cite it. The comment must name what it costs — a dropped story-carrying push leaves the flag unset with nothing to correct it — and why it is accepted anyway: this is a derived boolean rather than reported content; it is monotonic, so there is one wrong state rather than progressive drift, and any later push carrying stories heals it; and the failure is benign, since the developer keeps the views they already had. Do **not** paraphrase this from [research.md §2](research.md) — a reader of `store.ts` must be able to answer a second proposal without leaving the file
- [ ] T003 [P] Extend `apps/board/tests/unit/store.test.ts` — a report with stories sets it; **ten subsequent reports carrying none leave it set**, which is FR-003 as a unit fact; a session that has never reported stories has it false; dismissal takes it with the session. The middle assertion is the one that matters, and it is the same shape as feature 010's stickiness test. Also assert the monotonicity directly — there is **no** sequence of reports that returns it to false — since that is the property the decision 26 argument rests on
- [ ] T004 Add `everReportedStories` to `SessionView` in `apps/board/src/main/view.ts`, listed field by field rather than spread. Leave `SessionSummary` **unchanged** — which destinations a session offers is not a pill's business
- [ ] T005 [P] Extend `apps/board/tests/unit/view.test.ts` — the boolean projects as held, and `SessionSummary` still carries nothing about it
- [ ] T006 Create `apps/board/src/renderer/src/state/usePlacement.ts` — the rule in [contracts/placement.md](contracts/placement.md), importing `Scope`, `UNASSIGNED` and `scopeKey` from `state/useSelection.ts` as values. `storyId` first and authoritative, `taskIds` only for a task naming no story, everything else into a final unassigned scope that is **absent when empty**. Name `buildScopes` in the comment and say what differs and why
- [ ] T007 [P] Write `apps/board/src/renderer/src/state/usePlacement.test.ts` — **`tasks drawn = tasks reported` first**, over a report built to hit every branch at once. Then one case per row of [quickstart.md §4](quickstart.md)'s table. The disagreement row is the one a plausible implementation gets wrong, because `buildScopes` deliberately draws it twice. Teeth-check by switching the rule to a union and confirming the count assertion fails
- [ ] T008 Create `apps/board/src/renderer/src/state/usePresence.ts` — the two one-way booleans of [contracts/presence.md](contracts/presence.md): `tree` from `everReportedStories`, `oldViews` from `!tree || usedOldViews.has(sessionKey)`. `usedOldViews` is a `Set` of session ids held here, added to and **never removed from**. Write the one-way property in the file as the reason FR-007 needs no code of its own
- [ ] T009 [P] Write `apps/board/src/renderer/src/state/usePresence.test.ts` — every sequence in [contracts/presence.md](contracts/presence.md), and then the property that stands in for FR-007: over any sequence of reports and view-openings, **no destination that was offered becomes un-offered**. Assert it as a property over a sequence, not as a state at one moment
- [ ] T010 [P] Create `apps/board/src/renderer/src/lib/progress.ts` — counts over `classify`, returning each recognised bucket, `unrecognised`, and `total`. It returns numbers and never a word: no rolled-up status, no percentage. Computed only for a story with no reported status of its own
- [ ] T011 [P] Write `apps/board/src/renderer/src/lib/progress.test.ts` — mixed states counted correctly; `donee`, `almost` and `WIP-ish` counted as unrecognised and **not** as todo or done; a story with no tasks yields nothing to show; no synonym is added to the vocabulary by this file
- [ ] T012 Create `apps/board/src/renderer/src/state/useTreeState.ts` — selection as `{ kind, id }` intent resolved on render with **no fallback to the first item** (FR-034, and the deliberate divergence from `resolve`), plus expansion as `defaultOpen XOR toggled`, where the default is open for the story holding `focus.task`. No effect, nothing initialised from a report
- [ ] T013 [P] Write `apps/board/src/renderer/src/state/useTreeState.test.ts` — selection survives a report that still contains it; a report that drops it reports `missing` rather than resolving to something else; a collapse does not deselect; the focus story opens by default; **a developer's collapse of the focus story survives the next report**, which is the case a set-of-open-ids design gets wrong
- [ ] T014 Add a comment to `apps/board/src/renderer/src/state/useSelection.ts` naming `usePlacement` and stating that a second rule exists, which view uses it, and why this one is unchanged. **No logic change in this file** — a diff here that is not a comment is a mistake

**Checkpoint**: a session can be known Spec-Kit shaped, a tree can be built and counted, and progress and tree state are right — with nothing rendered.

---

## Phase 2: User Story 1 — See the shape of the work (Priority: P1) 🎯 MVP

**Goal**: Stories at the top level, their tasks beneath, drawn as the tree the
report always described.

**Covers**: FR-008 – FR-016; SC-001, SC-002

**Independent test**: Report stories and tasks with the links between them and
confirm each task appears beneath the story it names, once, in reported order.

- [ ] T015 [US1] Create `apps/board/src/renderer/src/views/speckit/SpecKitView.tsx` and its CSS — the tree beside the pane, one scroll container for the tree so that nothing re-mounts it and the scroll position survives by construction (FR-032)
- [ ] T016 [P] [US1] Create `apps/board/src/renderer/src/views/speckit/StoryNode.tsx` and its CSS — identifier, title, the expand control, and the reported status through `StatusLabel`, never classified locally. Counted progress is T029; leave the slot
- [ ] T017 [P] [US1] Create `apps/board/src/renderer/src/views/speckit/TaskNode.tsx` — wraps the existing `TaskRow` rather than restating a row, passing `focused` from `focus.task` and the elapsed tag as `TasksView` does
- [ ] T018 [US1] Render the unassigned scope last in `SpecKitView.tsx`, **absent entirely when empty** (FR-013) — not an empty heading, not a zero. It carries no counted progress and no status, because it has no story for either to be about
- [ ] T019 [P] [US1] Write `apps/board/tests/e2e/speckit.spec.ts` — stories in reported order, expansion revealing tasks in reported order, collapse hiding them, and a story with no tasks **saying so**. Then the placement table end-to-end, with `tasks drawn = tasks reported` asserted on the rendered tree as well as in T007's unit test
- [ ] T020 [US1] Extend `speckit.spec.ts` for the unassigned group — present and holding the task when one cannot be placed, and **wholly absent** when every task is placed

---

## Phase 3: User Story 2 — Read one thing in full (Priority: P1)

**Goal**: The selected story or task, in full, beside the tree.

**Covers**: FR-017 – FR-022; SC-007

**Independent test**: Select a story, then a task, and confirm each shows every
field reported for it and nothing that was not.

- [ ] T021 [US2] Create `apps/board/src/renderer/src/views/speckit/DetailPane.tsx` and its CSS — dispatches to the existing `StoryDetail` or `TaskDetail`, handing each a `Scope` built by `usePlacement`. It must be evident which kind is shown (FR-020). Do not re-implement either component; if one needs a prop it does not have, add the prop rather than a parallel component
- [ ] T022 [US2] Add the two empty states to `DetailPane.tsx` — nothing selected says so (FR-021), and a selection the report no longer contains says **that**, distinctly, rather than reading as an empty pane (FR-034)
- [ ] T023 [P] [US2] Extend `speckit.spec.ts` — a fully reported story and a story with only `id` and `title` (no empty rows, no "unknown", no invented values); the same for a task; the two empty states; and a selected task still shown after its story is collapsed

---

## Phase 4: User Story 3 — Work on a project that is not Spec-Kit shaped (Priority: P1)

**Goal**: A project with no stories never sees a tree that would be empty, and a
project with them stops carrying two views of one thing.

**Covers**: FR-001 – FR-007; SC-003, SC-004, SC-005

**Independent test**: Report tasks and no stories, and confirm the tree is not
offered and the story and task views are exactly as they were.

- [ ] T024 [US3] Add the "Spec-Kit" destination to `apps/board/src/renderer/src/app/TabStrip.tsx` and wire `usePresence` into `availableTabs` in `App.tsx` — the tree where the story view sat, and the story and task destinations withdrawn per the rule. Say in the comment that this is the second and third conditional destination after feature 010's, and that both gate on whether the session has the *concept* rather than on a count of content
- [ ] T025 [US3] Record a session id into `usedOldViews` when the developer opens the story or task view, in `App.tsx` — on the navigation itself, not on a render of either view, so that a view rendered for any other reason cannot mark it used
- [ ] T026 [P] [US3] Write `apps/board/tests/e2e/speckit-presence.spec.ts` — **the absence test first**: a session reporting tasks and no stories offers no Spec-Kit destination, offers the story and task views, and presents the same strip it presented before this feature (SC-003)
- [ ] T027 [US3] Extend `speckit-presence.spec.ts` with the swap — reporting stories makes the destination appear and, for a developer who opened neither legacy view, makes those two go (SC-004); Overview is still the landing view; and a later report carrying **no** stories leaves the tree offered (FR-003)
- [ ] T028 [US3] **The no-withdrawal test**, in the same spec — open the task view, *then* report stories, and confirm both legacy destinations remain for the rest of the session (FR-005). Then assert the property over every sequence in [contracts/presence.md](contracts/presence.md): **no destination ever disappears from a developer who had opened it.** Assert over the sequence rather than at one moment. This is the requirement decision 36 was raised about and the reason this feature is shaped as it is

---

## Phase 5: User Story 4 — See how a story is going without opening it (Priority: P2)

**Goal**: A collapsed story says how much of it is done, and says who counted.

**Covers**: FR-023 – FR-029; SC-008, SC-009

**Independent test**: Report a story with no status and tasks in mixed states;
confirm the counted progress matches and is presented as the board's own.

- [ ] T029 [US4] Show counted progress in `StoryNode.tsx` from `lib/progress.ts` — only where the story reported no status, and rendered so it is distinguishable from a `StatusLabel` **by inspection alone** (FR-026). It is arithmetic, so it should look like arithmetic; nothing needs styling into looking derived
- [ ] T030 [P] [US4] Extend `speckit.spec.ts` — counts for a story with no reported status; a reported status shown with **no** count beside it; a story reporting `done` whose tasks are all `todo` showing no contradiction anywhere, asserted on the absence (FR-029); unrecognised statuses stated separately and counted as neither done nor todo; and a story with no status and no tasks showing neither

---

## Phase 6: User Story 5 — Keep your place while the agent works (Priority: P2)

**Goal**: Expansion, selection and scroll survive whatever the agent does.

**Covers**: FR-030 – FR-034; SC-006

**Independent test**: Expand, select and scroll, then send ten reports and confirm
all three are unchanged.

- [ ] T031 [P] [US5] Write `apps/board/tests/e2e/speckit-stability.spec.ts` — expand, select, scroll, then **ten** reports: expansion, selection and scroll position all unchanged. Assert scroll on `scrollTop` against a measured anchor row rather than by eye, the technique feature 007 used for arriving notes
- [ ] T032 [US5] Extend `speckit-stability.spec.ts` with the disappearance cases — a report dropping the selected task makes the view **say** the selection is gone rather than selecting the next one; a report dropping an expanded story collapses or expands no other; and a report adding a story or task moves nothing already on screen

---

## Phase 7: User Story 6 — Use the tree in a narrow panel (Priority: P3)

**Goal**: Tree and detail both usable at the minimum width, in every combination
of destinations this feature can produce.

**Covers**: FR-035; SC-010, SC-011

**Independent test**: Drive the window to the minimum supported width with a full
tree and a selection, and confirm both remain usable with no horizontal scroll.

- [ ] T033 [US6] Give `SpecKitView.tsx` its narrow arrangement using `useIsNarrow` from `lib/breakpoint.ts` — tree and detail both reachable, neither truncated into uselessness, nothing scrolling sideways at any supported width
- [ ] T034 [US6] **The measured one**, in `speckit-presence.spec.ts` — set up the **widest** strip this feature can produce: a Spec-Kit session, a ticket held (feature 010), and a developer who has opened the task view, so Overview, Ticket, Spec-Kit, Stories, Tasks and Notes are all offered. Drive to 380px with the content-size helper and require every destination legible and operable with no horizontal scroll. Also measure the ordinary Spec-Kit case and confirm it is **shorter** than today's strip. Confirm the six known display-scale failures on the parent commit first, so a baseline failure is not read as a regression

---

## Phase 8: Polish

- [ ] T035 [P] Extend `apps/board/tests/e2e/only-reported.spec.ts` with a Spec-Kit subtraction block — the counted progress, the unassigned group's heading and both empty states are board text and each has to be declared. The counted progress is the first entry in that file that is **arithmetic** rather than a label; say so where it is declared
- [ ] T036 [P] The markup test in `speckit.spec.ts` (SC-012) — `<script>`, `<img src=x onerror=…>` and an ADF fragment in every field the tree and pane draw: story title, narrative, criteria, task title, detail, checks. All visible as characters, no element created, no handler run
- [ ] T037 Extend `speckit-presence.spec.ts` for sessions and lifetime — two sessions of different shapes each offering their own destinations with no leak between them (FR-006); opening the task view in one not keeping it offered in the other; a dismissed session starting over; pills carrying nothing about shape; and **after a restart, nothing remembered on either boolean** (FR-039)
- [ ] T038 [P] Extend `speckit.spec.ts` for scale — 50 stories and 500 tasks scrollable and legible at the minimum width, with the tree not the only way to find anything (SC-011)
- [ ] T039 Walk the `stacks/vite-react.md` checklist over `views/speckit/` and the three new hooks — stable keys, no colour literals outside `tokens.css`, no `useEffect` computing what could be derived, and no timer refreshing data. The third is the one this feature is most exposed to, having four derived rules
- [ ] T040 Record the design revision owed in `docs/design/` — the exports draw four fixed destinations and are canon for look and feel (decision 8). A tree, a detail pane, and a strip whose membership varies by session are all revisions this feature owes
- [ ] T041 Run `npm run build --workspace @cocoapilot/board`, `npm run typecheck`, `npm test` and `npm run test:e2e`, then walk the twelve scenarios in [quickstart.md](quickstart.md), correcting the quickstart where it turns out to be wrong rather than leaving it agreeing with itself
- [ ] T042 [P] Update `CHANGELOG.md` and `STATUS.md` — **feature 010 lands first and takes decisions 37 and 38**, so this feature takes **39, 40 and 41**: **the tree is offered only to a session that has reported stories, and displaces the two views it duplicates**; **a destination a developer has opened is never withdrawn, which makes decision 36's fault structurally impossible**; and **counting a story's progress is the one thing the board derives**. Record that this reverses feature 006's FR-016, that FR-018 is upheld, and that `putReport` now carries one accumulation with its argument in the method. Also flip `specs/011-speckit-tree/spec.md`'s `Status` from `Draft`. If 010 has **not** merged when this does, stop and renumber rather than guessing
- [ ] T043 Read back the full diff, then merge

---

## Dependencies

Foundational → US1 → US2 → US3 → US4 → US5 → US6 → Polish.

T001 blocks T004, which blocks T008 and every presence task — a session cannot be
known Spec-Kit shaped until the store holds it and the projection carries it.
T006 blocks T015, T018 and T021: no view can draw a tree the placement rule has
not built. T008 blocks T024 and T025. T012 blocks T015 and T022. T010 blocks T029.
T015 blocks T016, T017, T018 and T021. Everything marked `[P]` is genuinely
independent.

**Two orderings are deliberate.** T028, the no-withdrawal test, sits in the middle
rather than in Polish, because it is the requirement that shaped the design and it
should fail loudly from the first commit that touches the strip. And T034's
measurement depends only on T024, so it can be run as soon as the strip changes —
worth doing early, because a failure there changes the plan rather than the code.

US3 sits third despite sharing P1 with US1 and US2 because it decides *whether*
the tree is offered, and the tree has to exist before its absence means anything.

## What is deliberately not here

Editing `buildScopes`, which serves the views this feature does not take over.
Retiring the story and task views, which is out of scope and now a smaller
question than it was — the tree reaches every reported task, so what remains is
whether a developer who prefers those views should keep the choice. A setting to
choose between them. Searching, filtering, reordering or dragging the tree. A
third level, or grouping by anything other than story. The plan and changed files
in this tree. Any change to the contract, to what agents report, or to
`SessionSummary`. And any record of a previous shape — the tree draws the report
in front of it.
