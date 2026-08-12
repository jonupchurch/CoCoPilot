# Quickstart: Spec-Kit Tree

**Feature**: [011-speckit-tree](spec.md) | **Date**: 2026-08-12

## Prerequisites

Features 001–008 implemented. Feature 010 is **not** a prerequisite for the tree
itself, but it is for scenario 7: the density question is about six destinations,
and the fifth is 010's. If 010 has not landed, scenario 7 measures five and the
result does not answer the question this feature has to answer.

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
identically without this feature. **Scenario 7 depends on that same mechanism**,
so confirm the baseline before reading its result as a regression.

## Validation scenarios

### 1. The tree draws the relationship (US1)

Report three stories and tasks naming them.

- Stories list in reported order.
- Expanding one reveals its tasks, in reported order.
- Collapsing hides them and leaves the story.
- A story with no tasks says so when expanded, rather than showing an empty frame.

### 2. Placement, one case per rule (US1) — **the countable one**

Build one report that hits every branch of
[contracts/placement.md](contracts/placement.md) at once:

| Case | Expected |
|---|---|
| Task names story A; A's `taskIds` names it | Drawn once under A |
| Task names story A; **B**'s `taskIds` names it | Drawn under A only, and **not** under B |
| Task `storyId` null; A's `taskIds` names it | Drawn under A |
| Task `storyId` null; named by two stories | Drawn under the first in reported order |
| Task names an unreported story; named by nobody | Withheld, counted |
| Task names nothing; named by nobody | Withheld, counted |
| Story's `taskIds` names a task never reported | Nothing drawn, nothing invented |
| Two tasks sharing an identifier | Both drawn where each claims |

Then assert the arithmetic: **drawn + withheld = reported**. That single
assertion is what makes the tree countable, and it is the one to write first.

The second row is the one a plausible implementation gets wrong, because the
existing `buildScopes` deliberately draws it in both places.

### 3. Withholding is stated (US1, FR-007) — **the honesty test**

- With one unplaceable task, the view says one task is not shown.
- With none, it says nothing at all — no zero, no empty notice.
- **Report tasks and no stories whatsoever.** The tree is empty *and* the count
  states every task. This is the degenerate case: without the count it reads as a
  broken board, and it is the reason FR-007 exists.

### 4. The detail pane (US2)

- Selecting a story shows its narrative, criteria, priority and status; a story
  reported with only `id` and `title` shows no empty rows and no invented values.
- Selecting a task shows its detail, checks, files and status, on the same terms.
- It is evident which kind is being shown.
- Nothing selected says so rather than drawing an empty frame.
- Collapsing the story above a selected task leaves the pane showing that task.

### 5. Counted progress (US3)

- A story reporting no status, with tasks in mixed states, shows counts.
- The counts are distinguishable from a reported status **by inspection alone**.
- A story reporting its own status shows that status and **no** count.
- A story reporting `done` whose tasks are all `todo` shows `done` and **no**
  contradiction anywhere (FR-022). Assert on the absence.
- Tasks whose statuses are `donee`, `almost` and `WIP-ish` are counted as
  unrecognised and stated, **not** as done and not as todo.
- A story with no reported status and no tasks shows neither status nor count.

### 6. Nothing moves under the reader (US4) — **the load-bearing test**

Expand a story, select a task, scroll, then send **ten** reports.

- Expansion, selection and scroll position all unchanged (SC-004).
- A report that adds a story or a task moves nothing already on screen.
- A report that drops the selected task makes the view **say** the selection is
  gone — it does not select the next task, which is what the existing `resolve`
  would do and what FR-027 forbids.
- A report that drops an expanded story collapses or expands no other story.

Assert scroll on `scrollTop` against a measured anchor row, not by eye — the
technique feature 007 used for arriving notes.

### 7. Six destinations at the floor (US5, SC-009) — **the measured one**

With feature 010 landed and a ticket held, drive the window to 380px.

- Six destinations, every label legible, every one operable.
- **No horizontal scrolling** anywhere.

Measured, the way feature 008 verified six pills at the same floor. See the
display-scale caveat above.

**If this fails, it is not a licence to relax the floor.** The answer per
[research.md §5](research.md) is to bring forward the retirement of the Stories
and Tasks tabs — which returns the strip to four — and that requires answering the
gate in [contracts/placement.md](contracts/placement.md) first. Record the
measurement and stop; do not improvise a navigation idiom.

### 8. The narrow arrangement (US5)

At the minimum width, with a full tree and a selection:

- Tree and detail are both reachable and neither is truncated into uselessness.
- A very long story title or task title degrades legibly with its full value
  retrievable.
- Nothing scrolls horizontally at any supported width.

### 9. The two existing tabs are untouched (SC-008) — **the regression test**

Over the same reports used in scenario 2:

- The Stories tab presents what it presented before this feature.
- The Tasks tab presents what it presented before, **including the unassigned
  scope holding the tasks this feature withholds**. That contrast is the point:
  the same report draws differently in the two places, on purpose, and the older
  view is still the one that reaches everything.
- `buildScopes` and its tests are unmodified — assert over the source, not only
  the rendered page.

### 10. Scale, markup and inertness

- 50 stories and 500 tasks: scrollable, legible, and the tree is not the only way
  to find anything.
- Markup in every field the tree and pane draw — story title, narrative,
  criteria, task title, detail, checks — appears as characters. No element
  created, no handler run.
- No control anywhere on the tab alters reported content or sends anything to an
  agent (SC-012), asserted structurally over the source as well as the page.
- After a restart, no tree state is held (FR-033).

## Expected outcome

All pass. Scenarios 2, 3 and 6 are the load-bearing ones — respectively that
every task lands in exactly one place, that the board says what it is not
showing, and that a report never moves the reader.

Scenario 7 is the one that can legitimately fail. It is a measurement of a
constraint this feature tightens rather than a bug in it, and its failure has a
prescribed response that is not "make the tab strip smaller".

## Not validated here

- Retiring the Stories and Tasks tabs, and what becomes of a withheld task when
  they go. Gated, and named as gated, in the spec and in
  [contracts/placement.md](contracts/placement.md).
- Any change to the contract, the store or the projection — this feature makes
  none, and a test asserting one would be testing that nothing happened.
- Agent-side behaviour that would make links more consistent. The board draws
  what it is told.
