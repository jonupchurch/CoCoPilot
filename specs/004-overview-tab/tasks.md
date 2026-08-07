# Tasks: Overview Tab

**Input**: Design documents from `specs/004-overview-tab/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md),
[quickstart.md](quickstart.md), and
[`stacks/vite-react.md`](../../stacks/vite-react.md), which governs every file
in this feature.

Features 001–003 are merged. `packages/contract` exports the payload types,
`apps/board/src/main/view.ts` projects held state for the renderer, and the
shell — `App`, `TitleBar`, `TabStrip`, `Chip`, `WaitingState`, `lib/elapsed.ts`,
`state/useBoardState.ts`, `state/useNow.ts` — is in place. `App.css` already
carries the sticky `.section__header` rule, placed there by 003 for this
feature.

**No setup phase.** The toolchain, the tsconfigs and both test runners exist;
this feature adds files to a structure that is already standing.

**Tests**: Included. Two of this feature's guarantees are stated as absences —
the board displays nothing it was not sent (SC-005) and the repository on disk
changes nothing (SC-006) — and a happy-path test catches neither. The status
vocabulary is branching logic where a wrong branch paints a signal colour on
something the board does not understand, which is exactly the case rule 8 says
to unit test.

## Format: `[ID] [P?] [Story] Description`

---

## What the export settles

`resources/CoCoPilot Overview Panel.dc.html` is canon for look and feel
(decision 8). Read out of it, so these are transcriptions rather than
inventions:

| Element | Treatment |
|---|---|
| Section header | Sticky. `▼`/`▶` in `--muted` at 9px, uppercase mono label at `--text-label` with `.16em` tracking, summary pushed right |
| Section divider | `border-top: 1px solid var(--line)` on the section, not a separate rule |
| Feature card | `--surface` fill, `--line` border, `--radius-card`; id in teal mono bold, priority in muted mono, status pill right-aligned, title at 13.5px/700, spec path in muted mono |
| Task — done | `--teal-tint` disc with a teal `✓`; id and title in `--muted` |
| Task — active | Blue outline disc with a blue dot; title in `--ink`, weight 600; status text in `--blue` |
| Task — todo | `--line` outline disc, empty; title in `--muted` |
| Focus marker | `border-left: 2px solid var(--teal)` with a `-8px` negative margin, and a teal elapsed tag right-aligned with tabular figures |
| Plan | A 3px `--line` rail with a `--blue` fill, then steps using the same three discs at 16px |
| Plan summary | A `--blue-tint` pill with a blue dot — `Step 2 of 4` |
| Changed file | Change letter in mono bold (teal add / blue modify), path in `--ink` mono, `+N` teal and `−N` ember right-aligned |
| Flagged file | Row fill `--raised`, `!` and its text in `--ember` |

The disc geometry is 14px in task rows, 16px in plan steps. Rows are 5–6px
vertical padding; section bodies are `0 14px 14px`.

## Two conflicts with the export, resolved

**1. Every task row shows its status as text.** The export encodes status as the
disc glyph alone and prints status text only on the focused row. A glyph cannot
carry a status the board does not recognise, and FR-006 requires identifier,
title *and* status on every row. So the status text is always present, coloured
by the vocabulary and `--muted` when unrecognised. Decision 8 makes the exports
canon for look and feel and this repository's docs authoritative on content;
this is content.

**2. There is a Focus section, which the export does not have.** In the export,
focus is only a marker *on* a task row — the teal left rule and the elapsed tag.
That cannot satisfy FR-004, because the agent's prose has nowhere to go, and it
cannot satisfy the spec's first edge case, because a `focus.task` naming
something absent from the task list would have no row to mark. So focus is both:
a section at the top of the reported stack, built in the idiom of the export's
own "Last prompt" block (uppercase mono label, meta right, a `--surface` card
beneath), *and* the row marker, unchanged, wherever the named task appears.

## Three rules this feature settles

**The focus tag counts from the report, not from when the task became current.**
FR-002 asks for how long ago it was *reported*, so the tag is elapsed since
`report.receivedAt`. Not `lastHeardAt` — a note arriving must not reset it. And
deliberately not "when this task first became the focus", which would mean
carrying state across snapshots and is the merge path decision 26 refuses.

Its first band is `now`, not `0s`: the export shows only `now` and `12m`, and
quickstart scenario 1 states it outright. The title bar keeps counting seconds
because liveness is watched second by second; which task is being worked on is
not, and an agent reporting every few seconds would make this tag flicker.

**A changed file carrying a `note` is the flagged one.** `note` has a cap in the
data model and no stated meaning; this feature gives it one — *why this file
wants your eye* — and renders it in ember in place of the counts. That is
reading a field the agent chose to fill, not inferring attention from the data.
T024 writes the meaning back into the contract docs.

**An unrecognised status gets no glyph at all.** Not the todo disc: an outline
circle says "not started", which is a claim about a string the board does not
understand. The slot keeps its width so rows stay aligned, and the status text
carries the whole meaning.

## Path conventions

```text
apps/board/src/renderer/src/
├── views/overview/     # OverviewView + the four sections
├── components/         # Section, TaskRow, StatusLabel — shared, presentational
└── lib/                # vocabulary.ts, summarise.ts — pure, co-located tests
```

---

## Phase 1: Foundational

**Purpose**: The bridge has to carry the report before anything can render it,
and the three pure modules every section depends on.

- [x] T001 Widen the projection in `apps/board/src/main/view.ts` — add `feature`, `tasks`, `plan`, `focus`, `changedFiles` and `reportedAt` to `SessionView`, each named explicitly rather than spreading `session.report`, so the projection stays the deliberate boundary its comment claims it is
- [x] T002 [P] Write `apps/board/tests/unit/view.test.ts` — the projection carries exactly what was reported and nothing else; `reportedAt` is the report's receipt time and a subsequent note does **not** move it; a session that has only received notes projects an absent report rather than an empty one
- [x] T003 Create `apps/board/src/renderer/src/lib/vocabulary.ts` — trim and lowercase, then match the documented synonym table exactly; anything else is `unrecognised`. No prefix, fuzzy or stem matching, at any point, for any reason
- [x] T004 [P] Write `apps/board/src/renderer/src/lib/vocabulary.test.ts` — every synonym in the table; `DONE` and ` in progress ` recognised; `waiting on CI`, `donee`, `''` and `'  '` unrecognised. The near miss is the test that matters: if `donee` resolves to done, matching is too loose and the board is confidently wrong
- [x] T005 Create `apps/board/src/renderer/src/lib/summarise.ts` — the four header summaries, each a pure function of held state (depends on T003 for the done count)
- [x] T006 [P] Write `apps/board/src/renderer/src/lib/summarise.test.ts` — no tasks, one task, all done, a plan with no active step, changed files with null `added`/`removed`, and 500 tasks. Each summary must stay true to the list beside it in every case
- [x] T007 Create `apps/board/src/renderer/src/components/Section.tsx` and `Section.css` — the disclosure header (`.section__header`, already sticky via `App.css`), a `summary` prop that is **required** rather than optional, keyboard-operable, `aria-expanded` on the control and the body genuinely unmounted when collapsed

**Checkpoint**: The report reaches the renderer; a section can be built.

---

## Phase 2: User Story 1 — See what the agent is doing right now (Priority: P1) 🎯 MVP

**Goal**: Which task, in the agent's own words, with a measurement of how long
ago it said so.

**Covers**: FR-002, FR-003, FR-004, FR-017; SC-001

**Independent test**: Report a session naming a current task with prose; both
appear, marked as current. Report a different task; the marker moves. Report no
focus; the section says so and marks nothing.

- [x] T008 [US1] Create `apps/board/src/renderer/src/views/overview/OverviewView.tsx` and `OverviewView.css` — the section stack, and mount it from `App.tsx` in place of `app__placeholder`
- [x] T009 [US1] Create `apps/board/src/renderer/src/views/overview/FocusSection.tsx` and `FocusSection.css` — the named task, the prose card, and the elapsed tag from `reportedAt` with tabular figures so it does not reflow. The tag never changes colour or weight at any duration, and is never removed because time has passed
- [x] T010 [US1] Say so when there is no focus, in `FocusSection.tsx` — a report naming no current task must produce a stated absence, never an arbitrarily chosen task
- [x] T011 [P] [US1] Write `apps/board/tests/e2e/overview.spec.ts` — focus with prose renders both; a second report moves the marker; a report with no focus states the absence; the tag reads `0s` then advances without changing treatment

**Checkpoint**: The most valuable thing on the board works on its own.

---

## Phase 3: User Story 2 — The feature and its tasks (Priority: P2)

**Goal**: Which feature, which tasks, what state each is in — and a completion
count in the header that survives collapsing.

**Covers**: FR-001, FR-005, FR-006, FR-007, FR-008, FR-009; SC-003, SC-009

**Independent test**: Report a feature with a mix of statuses; the header
summarises completion, the body lists every task with identifier, title and
status, and the vocabulary table in [quickstart.md](quickstart.md) scenario 3
holds row for row.

- [x] T012 [P] [US2] Create `apps/board/src/renderer/src/components/StatusLabel.tsx` and `StatusLabel.css` — the vocabulary's four treatments plus neutral; the reported text is always what is displayed, never a canonical form substituted for it
- [x] T013 [US2] Create `apps/board/src/renderer/src/components/TaskRow.tsx` and `TaskRow.css` — disc, identifier, title, status, and the focus marker (teal left rule, elapsed tag) when `focus.task` names this row. Keyed by task id, never by index
- [x] T014 [US2] Create `apps/board/src/renderer/src/views/overview/SpecSection.tsx` and `SpecSection.css` — the feature card and the task list, in the agent's order, with the completion summary in the header
- [x] T015 [US2] Truncate long titles, statuses and paths with the full text on `title`, in `TaskRow.css` and `SpecSection.css` — retrievable, per FR-009
- [x] T016 [P] [US2] Extend `apps/board/tests/e2e/overview.spec.ts` — the quickstart scenario 3 table asserted row by row, `waiting on CI` and `donee` both neutral with their text intact; a `focus.task` naming a task absent from the list still appears in the Focus section

**Checkpoint**: "The agent is five tasks into a nine-task feature" is readable.

---

## Phase 4: User Story 3 — The plan (Priority: P3)

**Goal**: The ordered sequence and where in it the agent is.

**Covers**: FR-010

**Independent test**: Report a plan with one step active; the steps appear in
the reported order, the active one is distinguishable, and the header states
position.

- [x] T017 [US3] Create `apps/board/src/renderer/src/views/overview/PlanSection.tsx` and `PlanSection.css` — the rail, the steps in reported order with the same three discs, step detail beneath an active step, and `Step N of M` in the header when a step is active, `N of M done` when none is
- [x] T018 [P] [US3] Extend `apps/board/tests/e2e/overview.spec.ts` — reported order preserved exactly; the active step distinguishable from done and upcoming; an unreported plan produces no section rather than an empty frame

---

## Phase 5: User Story 4 — What has changed (Priority: P4)

**Goal**: Which files the agent says it touched, and roughly how much.

**Covers**: FR-011

**Independent test**: Report changed files with kinds and counts; each is listed
and the collapsed header carries the aggregate. One with a `note` is visibly
distinct.

- [x] T019 [US4] Create `apps/board/src/renderer/src/views/overview/ChangedFilesSection.tsx` and `ChangedFilesSection.css` — path, change, `+N`/`−N`, the flagged treatment for a file carrying a `note`, and the aggregate in the header summing only the counts that were sent
- [x] T020 [P] [US4] Extend `apps/board/tests/e2e/overview.spec.ts` — files listed with kind; a flagged file distinct from ordinary ones; the aggregate matches the rows; editing a file in the repository by hand changes nothing on screen

---

## Phase 6: User Story 5 — Collapse what is not needed (Priority: P5)

**Goal**: Four sections that close independently, each still answering its
question from the header alone.

**Covers**: FR-012, FR-013, FR-014, FR-015; SC-002, SC-004

**Independent test**: Collapse and expand each section; content hides and
reveals, the sections below move up, every collapsed header keeps its label and
summary, and a report arriving changes neither the arrangement nor the scroll
position.

- [x] T021 [US5] Hold each section's open state in `OverviewView.tsx` as component state — not persisted, because nothing here is; it survives reports because the components do not remount
- [x] T022 [P] [US5] Write `apps/board/tests/e2e/sections.spec.ts` — each section collapses and expands independently and the ones below reflow; all four collapsed, every question is still answered by headers alone; a report arriving mid-read leaves both the arrangement and the scroll offset untouched

---

## Phase 7: Polish & the two absences

- [x] T023 [P] Write `apps/board/tests/e2e/only-reported.spec.ts` — the comparison test (SC-005): push a known payload, walk the rendered view field by field, and assert every value on screen traces to a field in the report. Then 500 tasks stay navigable with an accurate header summary (SC-009), a 200-character status and a 500-character path truncate legibly with the full text retrievable, and prose containing `<script>` renders as visible characters (SC-008)
- [x] T024 [P] Document the status vocabulary and the `note`-flags-a-file rule in `docs/design/push-schema.md`, `specs/001-push-contract-service/data-model.md` and `specs/002-mcp-server-cli/contracts/client-surface.md` — an agent cannot flag a file it has not been told how to flag
- [ ] T025 Walk the `stacks/vite-react.md` checklist — no colour literal outside `tokens.css`, no `node:` import in the renderer, no timer that fetches, stable keys, nothing derived that was stored
- [ ] T026 Run `npm run typecheck`, the full suite, the Playwright suite and a packaged build, then walk the seven scenarios in [quickstart.md](quickstart.md)
- [ ] T027 [P] Update `CHANGELOG.md` and `STATUS.md`
- [ ] T028 Read back the full diff, then merge

---

## Dependencies

Foundational → US1 → US2 → US3 → US4 → US5 → Polish.

Within Foundational, T003 blocks T005 (the spec summary counts done tasks
through the vocabulary); everything else marked `[P]` is genuinely independent.

The four section phases each add a file to `OverviewView.tsx`, so they serialise
on that one file even though their components and tests do not. US5 is last
because collapse is a property of sections that exist — but `Section` is built
in Foundational, so every section is collapsible from the moment it lands and
US5 is wiring and proof rather than retrofit.

## What is deliberately not here

Sorting, filtering or grouping tasks. A derived percentage. A "stale" badge, a
fade, or any treatment keyed to elapsed time. Prompt, history and in-context —
same tab, different source, feature 005. Story and task detail views —
feature 006. Persisting the section arrangement across restarts, which would be
the first durable state in a product that has none.

This view is where "the board could just work this out" is most tempting.
FR-016 forbids all of it and T023 is what actually holds the line, by comparing
the rendered view against the payload field by field rather than trusting that
nobody was helpful.
