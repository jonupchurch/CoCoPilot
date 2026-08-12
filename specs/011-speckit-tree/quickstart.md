# Quickstart: Spec-Kit Tree

**Feature**: [011-speckit-tree](spec.md) | **Date**: 2026-08-12

## Prerequisites

Features 001–008 implemented. Feature 010 is **not** required for the tree, but it
is for scenario 9: the widest strip this feature can produce includes 010's ticket
destination, and measuring without it does not answer the question.

## Run the checks

```bash
# Playwright drives the built app in apps/board/out, not the source.
npm run build --workspace @cocoapilot/board

npm test          # unit + integration
npm run test:e2e  # Playwright
npm run typecheck
```

Six end-to-end tests currently fail on a machine whose display scale is not 100%
— `setContentSize(380, …)` never reaches `innerWidth === 380`. They fail
identically without this feature. **Scenario 9 depends on that same mechanism**,
so confirm the baseline before reading its result as a regression.

## Validation scenarios

### 1. Not every project is a Spec-Kit project (US3) — **the absence test**

Report tasks and **no stories**.

- No Spec-Kit destination is offered.
- The story and task views are offered and behave exactly as they did before this
  feature (SC-003).
- The strip has the same membership it had before this feature.

This is the comparison the feature turns on, and it comes first because it is the
case most easily broken by the code that serves every other scenario.

### 2. Becoming Spec-Kit shaped (US3)

Start the same session, then report stories.

- The Spec-Kit destination appears.
- The story and task destinations **go**, because neither was opened (SC-004).
- One arrived and two left: the strip is shorter than before.
- Overview is still the landing view.

Then report again with **no stories**.

- The Spec-Kit destination is still offered (FR-003). A report cannot withdraw it.

### 3. Once used, always offered (US3, US5) — **the no-withdrawal test**

Same setup, but **open the task view first**, then report stories.

- The Spec-Kit destination appears and the story and task destinations **remain**,
  for the rest of the session (FR-005).
- Nothing the developer was reading was taken away.

Then, across every sequence in [contracts/presence.md](contracts/presence.md),
assert the property that stands in for FR-007: **no destination ever disappears
from a developer who had opened it.** Assert it over the sequence, not at one
moment — this is the requirement decision 36 was raised about.

### 4. Placement, one case per rule (US1) — **the countable one**

Build one report that hits every branch of
[contracts/placement.md](contracts/placement.md) at once:

| Case | Expected |
|---|---|
| Task names story A; A's `taskIds` names it | Drawn once under A |
| Task names story A; **B**'s `taskIds` names it | Drawn under A only, and **not** under B |
| Task `storyId` null; A's `taskIds` names it | Drawn under A |
| Task `storyId` null; named by two stories | Drawn under the first in reported order |
| Task names an unreported story; named by nobody | Drawn in the unassigned group |
| Task names nothing; named by nobody | Drawn in the unassigned group |
| Story's `taskIds` names a task never reported | Nothing drawn, nothing invented |
| Two tasks sharing an identifier | Both drawn where each claims |

Then assert the arithmetic: **tasks drawn = tasks reported**. That single
assertion is what makes the tree countable, and it is the one to write first.

The second row is the one a plausible implementation gets wrong, because
`buildScopes` deliberately draws it in both places — and the two views are on
screen together in scenario 3, where the same task legitimately appears once in
one and twice in the other.

### 5. The unassigned group (US1)

- With one unplaceable task, the group is present and holds it.
- With none, the group is **absent entirely** — not empty, not a heading with
  nothing under it (FR-013).
- The group carries no counted progress and no status, because it has no story.

### 6. The detail pane (US2)

- Selecting a story shows its narrative, criteria, priority and status; a story
  reported with only `id` and `title` shows no empty rows and no invented values.
- Selecting a task shows its detail, checks, files and status, on the same terms.
- It is evident which kind is being shown.
- Nothing selected says so rather than drawing an empty frame.
- Collapsing the story above a selected task leaves the pane showing that task.

### 7. Counted progress (US4)

- A story reporting no status, with tasks in mixed states, shows counts.
- The counts are distinguishable from a reported status **by inspection alone**.
- A story reporting its own status shows that status and **no** count.
- A story reporting `done` whose tasks are all `todo` shows `done` and **no**
  contradiction anywhere (FR-029). Assert on the absence.
- Tasks whose statuses are `donee`, `almost` and `WIP-ish` are counted as
  unrecognised and stated — **not** as done and not as todo.
- A story with no reported status and no tasks shows neither status nor count.

### 8. Nothing moves under the reader (US5) — **the load-bearing test**

Expand a story, select a task, scroll, then send **ten** reports.

- Expansion, selection and scroll position all unchanged (SC-006).
- A report that adds a story or a task moves nothing already on screen.
- A report that drops the selected task makes the view **say** the selection is
  gone — it does not select the next task, which is what the existing `resolve`
  would do and what FR-034 forbids.
- A report that drops an expanded story collapses or expands no other story.

Assert scroll on `scrollTop` against a measured anchor row, not by eye — the
technique feature 007 used for arriving notes.

### 9. The widest strip, at the floor (US6, SC-010) — **the measured one**

The case to measure is **not** the ordinary one. Set up a session that is
Spec-Kit shaped, with a ticket held (feature 010), **and** whose developer has
opened the task view — so that Overview, Ticket, Spec-Kit, Stories, Tasks and
Notes are all offered at once. Drive the window to 380px.

- Every destination legible, every one operable.
- **No horizontal scrolling** anywhere.

Also measure the ordinary Spec-Kit case, which should be *shorter* than today's
strip, and confirm it is.

Measured, the way feature 008 verified six pills at the same floor. See the
display-scale caveat above.

### 10. The narrow arrangement (US6)

At the minimum width, with a full tree and a selection:

- Tree and detail are both reachable and neither is truncated into uselessness.
- A very long story or task title degrades legibly with its full value
  retrievable.
- Nothing scrolls horizontally at any supported width.

### 11. Sessions and lifetime

- Two sessions, one Spec-Kit shaped and one not: each offers its own destinations,
  and switching between them does not leak either way (FR-006).
- Opening the task view in one session does not keep it offered in the other.
- Dismissing a Spec-Kit session and having it report again starts it over.
- Pills carry no information about which shape a session is.
- After a restart, nothing is remembered: no expansion, no selection, and no
  record of which views were used (FR-039).

### 12. Scale, markup and inertness

- 50 stories and 500 tasks: scrollable, legible, and the tree is not the only way
  to find anything.
- Markup in every field the tree and pane draw — story title, narrative, criteria,
  task title, detail, checks — appears as characters. No element created, no
  handler run.
- No control anywhere on the tab alters reported content or sends anything to an
  agent (SC-013), asserted structurally over the source as well as the page.

## Expected outcome

All pass. Scenarios 1, 3 and 4 are the load-bearing ones — respectively that a
non-Spec-Kit project is untouched, that no destination is ever taken from a
reader, and that every task lands in exactly one place.

Scenario 3 deserves the most care. It is the one that keeps this feature from
re-creating the fault decision 36 was raised to fix, and its assertion is over a
*sequence* of reports and navigations rather than over one screen.

Scenario 9 is the one that can legitimately fail, and it now measures a rarer case
than it would have: the ordinary Spec-Kit session's strip is shorter than today's,
and only a developer who deliberately opened a legacy view produces the widest
one.

## Not validated here

- Retiring the separate story and task views entirely. Out of scope, and smaller
  than it was: the tree now reaches every reported task, so what remains is
  whether a developer who prefers those views should keep the choice.
- Any change to the contract — this feature makes none, and a test asserting one
  would be testing that nothing happened.
- Agent-side behaviour that would make links more consistent. The board draws what
  it is told.
