# Implementation Plan: Stories and Tasks Tabs

**Branch**: `006-stories-tasks-tabs` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-stories-tasks-tabs/spec.md`

## Summary

Two read-only master–detail views over reported stories and tasks, sharing a
selection model and the status vocabulary from feature 004, and diverging below
a 640px breakpoint.

## Technical Context

Inherits [001/research.md](../001-push-contract-service/research.md) and the
renderer conventions from features 003–004. Follows
[`stacks/vite-react.md`](../../stacks/vite-react.md).

**Primary Dependencies**: None beyond feature 003's.

**Constraints**: Usable to the window minimum; 200 stories and 500 tasks stay
responsive; selection survives both incoming reports and layout changes.

**Breakpoint**: 640px, from the design round, applied to both views though their
narrow arrangements differ.

## Constitution Check

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Four stories, no clarification markers |
| II. Validated trust boundaries | **Pass** | Reported content rendered as text nodes only |
| III. Match existing conventions | **Pass** | Reuses feature 004's vocabulary and section patterns rather than restating them |
| IV. Scope discipline | **Pass** | Read-only; no sort, filter, group, edit or approve |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md), including a zero-outbound-request check |
| VI. Narrate the reasoning | **Pass** | Design notes below |
| VII. Plan whole set first | **Pass** | Plan 6 of 9 |
| VIII. Test at the right level | **Pass** | Unit for selection reconciliation — the branching logic; E2E for the breakpoint |
| IX. Atomic commits, branch | **Deferred** | As 001 |

**No violations.**

## Project Structure

```text
renderer/src/
├── views/stories/
│   ├── StoriesView.tsx        # list ↔ picker below 640
│   ├── StoryList.tsx
│   ├── StoryPicker.tsx
│   └── StoryDetail.tsx
├── views/tasks/
│   ├── TasksView.tsx          # list stacks above detail below 640
│   ├── StoryScopePicker.tsx
│   ├── TaskList.tsx
│   └── TaskDetail.tsx
├── state/
│   └── useSelection.ts        # story + task; reconciled after every report
└── lib/
    └── breakpoint.ts          # one definition, both views
```

**Structure Decision**: The two views are separate components rather than one
parameterised master–detail, because their narrow behaviours genuinely differ.
Forcing them through one abstraction would mean a mode flag threaded through
every layer to express a difference that is only two layouts.

## Design notes

**Selection reconciliation is the real logic here.** Reports replace wholesale
(decision 26), so a selected story can simply cease to exist between one report
and the next. `useSelection` reconciles after every report: keep the selection
if the item still exists, otherwise move to a valid one. Without this the view
renders nothing and reads as a crash. It is the one piece of branching worth
unit tests, and it is where the bugs will be.

**The narrow layouts differ on purpose, and the reasoning must travel with the
code.** Stories collapses to a picker because its list is several multi-line
rows and would push detail far down a narrow panel; Tasks stacks because a
story's task list is a handful of single rows and stacks for nothing. Without a
comment saying so, this reads as an inconsistency someone will "fix".

**Tasks with no matching story must stay reachable** (FR-018). Nothing validates
that an agent reports a consistent graph, so the task view cannot assume every
`storyId` resolves. An orphan task appears under an explicit unassigned scope
rather than vanishing.

**Vocabulary and status rendering are imported from feature 004**, not
reimplemented. Two definitions would drift, and drift here means the same status
shown in two colours on two tabs.

**Read-only is enforced by having no handlers to enforce.** There are no action
components in this tree at all — the absence is structural rather than
conditional.

## Post-design Constitution re-check

Still passing. Principle IV carries the weight: these are the most detailed,
most interactive screens in the product, which makes them the most likely place
for an "approve", "retry" or "mark done" control to seem reasonable later. FR-020
and SC-008 make that a test failure — zero outbound requests — rather than a
review conversation.
