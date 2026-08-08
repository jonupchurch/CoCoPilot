# Quickstart: Stories and Tasks Tabs

**Feature**: [006-stories-tasks-tabs](spec.md) | **Date**: 2026-08-06

## Prerequisites

Features 001–005 implemented. 005 matters as well as 004: this feature widens
the same `SessionView` projection that the transcript reader added to.

## Run the checks

```bash
# Playwright drives the built app in apps/board/out, not the source. Without
# this the suite tests the previous build and reports missing elements for
# components that are right there in the tree.
npm run build --workspace @cocoapilot/board

npm test          # 410 unit + integration
npm run test:e2e  # 154 Playwright
npm run typecheck
```

`npm test --workspace=apps/board` — what this file said before — does not run:
`apps/board` has no `test` script, because the Vitest projects are defined at
the root.

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
stays neutral, `waiting on CI` shows in full. Verify **every surface agrees**,
since the vocabulary is shared and a divergence would show one status two ways.

There are four surfaces, not two: Spec tasks and Plan steps on Overview, a
story's tasks on Stories, and the task list on Tasks.
`tests/e2e/status-vocabulary.spec.ts` reads the same matrix from each and
compares them, so the check is a comparison rather than four copies of an
expectation; `tests/source-hygiene.test.ts` separately forbids a second
mapping from being written at all.

### 3. The breakpoint (US4)

| Width | Stories | Tasks |
|---|---|---|
| ≥ 640px | List beside detail | Scope picker above a list beside a detail |
| < 640px | List collapses to a picker, detail full width | Scope picker above a list stacked over a detail |

The Tasks tab's picker is present at **every** width. It is not the narrow
substitute for a list, the way the Stories tab's is — it is the control that
says which story's tasks are on screen, and one that vanished as the window
grew would leave the view unable to change scope at all.

- Every item selectable from the picker, with enough shown to tell them apart.
- No horizontal scrolling at any width.
- **Cross the breakpoint in both directions with a selection active**: the
  selection survives.

Checking the boundary by hand is harder than it looks, and the spec that does
it records why: at a 1.5 display scale an odd content width rounds up, so a
window asked for 639 is 640 and is not narrow. Set the **content** size, then
read back what was applied.

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

All pass.

Scenario 4 was called out as the one most likely to fail first. It did not, and
the reason is worth keeping: `useSelection` holds the *intent* — an id someone
clicked — and resolves it against the current report on every render. There is
no effect watching for reports and no copy of a story to go stale, so "keep it
if it still exists" and "move somewhere valid if it does not" are the same two
lines rather than a lifecycle to get right. Scroll position survives for the
same reason: the list is the same DOM element before and after.

What actually failed first was the *tests*, twice, in the same way — passing
while measuring something other than what they named. A resize to 380px that
silently landed at 452, and a teeth-check whose sabotage never applied. Both
are now asserted rather than assumed.

## Not validated here

- Multiple sessions — feature 008.
