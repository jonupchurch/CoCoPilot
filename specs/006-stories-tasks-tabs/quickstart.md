# Quickstart: Stories and Tasks Tabs

**Feature**: [006-stories-tasks-tabs](spec.md) | **Date**: 2026-08-06

## Prerequisites

Features 001–004 implemented.

## Run the checks

```bash
npm test --workspace=apps/board
npm run test:e2e
npm run typecheck
```

## Validation scenarios

### 1. Reading a story and a task (US1, US2)

- Stories list with identifier, title, priority and status, in reported order.
- Selecting one shows narrative, criteria, tasks and touched files; the
  selection is marked in the list.
- The task view scopes to a story, lists its tasks, shows one in full.
- Changing the scoped story updates both list and detail.
- The current task is marked wherever it appears, with elapsed time.
- A story with no tasks says so.

### 2. Status rendering (US3)

Same matrix as feature 004 — recognised values keep their treatments, `donee`
stays neutral, `waiting on CI` shows in full. Verify **both tabs agree**, since
the vocabulary is shared and a divergence here would show one status two ways.

### 3. The breakpoint (US4)

| Width | Stories | Tasks |
|---|---|---|
| ≥ 640px | List beside detail | List beside detail |
| < 640px | List collapses to a picker, detail full width | List stacks above detail |

- Every item selectable from the picker, with enough shown to tell them apart.
- No horizontal scrolling at any width.
- **Cross the breakpoint in both directions with a selection active**: the
  selection survives.

### 4. Selection reconciliation — **the one that will break**

With a story selected, send a new report that **does not contain it**.

- The view moves to a valid selection rather than showing nothing.
- With the story still present, selection and scroll position are preserved.
- Repeat for a selected task removed by a report.

Reports replace wholesale, so this is ordinary behaviour, not an edge case.

### 5. Orphan tasks (FR-018)

Report a task whose `storyId` matches no reported story.

- It remains reachable.
- It does not silently vanish because its parent is missing.

### 6. Read-only (SC-008)

Across a full exercise of both views, with every control activated:

- **Zero** outbound requests.
- No control exists that could alter reported content.

### 7. Limits and hostile content

- 200 stories, 500 tasks: navigable, selection responds without perceptible
  delay.
- Long titles, criteria and paths truncate legibly with full text retrievable.
- Markup renders as visible characters.

## Expected outcome

All pass. Scenario 4 is the one most likely to fail first — it is a consequence
of snapshot semantics that is easy to miss until a report happens to drop the
thing being looked at.

## Not validated here

- Multiple sessions — feature 008.
