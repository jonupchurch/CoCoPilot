# Contract: placement

**Feature**: 011 | **Date**: 2026-08-12

Where a reported task is drawn, and what happens to one that cannot be drawn.
This is the whole of the feature's new surface — there is no endpoint, no bridge
member and no client change — and it is written as a contract because it is the
rule the eventual replacement of the Stories and Tasks tabs must also honour.

**This rule is not the one already in the product.** `buildScopes` in
`state/useSelection.ts` places tasks by a different rule, for two views that go
on using it unchanged. Neither is a bug; one supersedes the other in one view.
[research.md §1](../research.md) is the argument, and both files must name the
other so a reader who finds one knows the other exists.

---

## The rule

```
place(stories, tasks) -> { scopes, withheld }
```

Given the reported stories in reported order and the reported tasks in reported
order, for each task in turn:

1. If the task's `storyId` names a **reported** story, it is placed under that
   story. This is authoritative and nothing overrides it.
2. Otherwise, if some reported story's `taskIds` names the task, it is placed
   under the **first** such story in reported order.
3. Otherwise it is **withheld** — drawn nowhere — and counted.

Within a story, tasks keep reported task order. Stories keep reported order. No
list is sorted, grouped or re-ordered by status, identifier or anything else.

### The three properties this rule has

- **Exactly once.** Every task is placed under one story or withheld. No task is
  drawn twice, which is what makes a count of drawn tasks plus withheld tasks
  equal the number reported.
- **Total.** Every reported task reaches one of the three outcomes. There is no
  fourth case and no silent drop — a withheld task is counted, and the count is
  shown (FR-007).
- **Order-stable.** The output depends only on the reported order and the two
  link fields, never on iteration order over a hash or on which story was
  examined first, so the same report always draws the same tree.

### Step 1 beats step 2, and that is the decision

When a task names story A while story B's `taskIds` names that task, the task is
drawn under A alone. The task is the closer authority on which story it serves,
and one task in one place keeps the tree countable.

The cost is that story B's `taskIds` entry is silently unhonoured. That is
accepted: B's claim is still visible in the payload, the task is still drawn
somewhere, and the alternative — drawing it under both — is what the existing
rule does and what this feature was specified to stop.

### Unreported stories are not created

A task naming a story that was never reported falls through step 1 as though it
named nothing, and gets step 2 and then step 3. The board does not invent a story
to hold it (FR-006). A `taskIds` entry naming a task that was never reported
produces nothing at all — what was reported is drawn, and absences are not
fabricated.

---

## Withholding

`withheld` is a count, and the view states it whenever it is greater than zero
(FR-007). It is a count and not a list: offering the titles of tasks the tree has
decided not to draw would be drawing them.

**The degenerate case is the one to get right.** An agent that reports tasks and
no stories withholds every task, and the tree is empty. Without the count that is
indistinguishable from a session that reported nothing, and reads as a broken
board. With it, the view says there are tasks it cannot place, which is true and
points at the report rather than at the product.

---

## What the rule does not do

| Not this | Why |
|---|---|
| Merge two tasks sharing an identifier | Both are drawn where each claims to belong. The board does not pick one or fabricate a merge |
| Sort tasks by status | Reported order is a fact; any other order is the board's opinion |
| Place a task under more than one story | The property that makes the tree countable, and the point of superseding the union rule |
| Infer a story from a task's title, files or identifier prefix | The board derives nothing but the count in FR-018 |
| Create an "unassigned" or "other" bucket | Specified against. It is the obvious answer if the gate below is ever resolved that way |

---

## The gate this contract carries

Retiring the Stories and Tasks tabs makes this rule the **only** placement in the
product, and a withheld task then becomes unreachable everywhere rather than
merely undrawn here. The spec makes retirement conditional on answering that, and
this contract carries the same condition: it is complete as the rule for an
additional view, and incomplete as the rule for the only view.

Nothing in this feature may be built in a way that assumes the answer.

## Verification this surface owes

- A task named by both fields in agreement, drawn once.
- A task named by both fields in disagreement, drawn under its own `storyId`
  only, and **not** under the story claiming it.
- A task with a null `storyId` named by a story's `taskIds`, drawn there.
- A task naming an unreported story and named by nobody, withheld and counted.
- A task named by two stories' `taskIds`, drawn under the first in reported order.
- Tasks reported with no stories at all: empty tree, count equal to the number of
  tasks reported.
- Drawn tasks plus withheld equals tasks reported, over a report built to hit
  every branch at once.
- The existing Stories and Tasks tabs, unchanged, over the same reports.
