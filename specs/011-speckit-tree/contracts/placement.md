# Contract: placement

**Feature**: 011 | **Date**: 2026-08-12

Where a reported task is drawn. This is one of the feature's two new surfaces —
the other is [presence.md](presence.md) — and it is written as a contract because
it is the rule the eventual retirement of the separate story and task views must
also honour.

**This rule is not the one already in the product.** `buildScopes` in
`state/useSelection.ts` places tasks by a different rule for the views that still
use it. The two now agree about almost everything; they differ on one question.
[research.md §1](../research.md) is the argument, and both files must name the
other so a reader who finds one knows the other exists.

---

## The rule

```
place(stories, tasks) -> Scope[]
```

Given the reported stories in reported order and the reported tasks in reported
order, for each task in turn:

1. If the task's `storyId` names a **reported** story, it is placed under that
   story. This is authoritative and nothing overrides it.
2. Otherwise, if some reported story's `taskIds` names the task, it is placed
   under the **first** such story in reported order.
3. Otherwise it is placed in the **unassigned scope**, which is appended last and
   exists only when at least one task lands in it.

Within a story, tasks keep reported task order. Stories keep reported order. No
list is sorted, grouped or re-ordered by status, identifier or anything else.

### The three properties this rule has

- **Exactly once.** Every task is placed under exactly one scope. This is the
  property the tree needs and the old scoped lists did not: in a tree, one task
  drawn under two parents reads as two tasks.
- **Total.** Every reported task reaches a scope. Nothing is dropped, nothing is
  withheld, and feature 006's FR-018 — every reported task reachable, including
  one belonging to no reported story — holds.
- **Order-stable.** The output depends only on reported order and the two link
  fields, never on iteration order over a hash, so the same report always draws
  the same tree.

Together the first two give one countable assertion: **the number of tasks drawn
equals the number reported.** That is the first test to write.

### Step 1 beats step 2, and that is the decision

When a task names story A while story B's `taskIds` names that task, the task is
drawn under A alone. The task is the closer authority on which story it serves,
and one task in one place is what keeps the tree countable.

The cost is that B's `taskIds` entry is silently unhonoured. Accepted: B's claim is
still in the payload, the task is still drawn, and the alternative — drawing it
under both — is what `buildScopes` does and what this feature was specified to
stop.

### Unreported stories are not created

A task naming a story that was never reported falls through step 1 as though it
named nothing, and gets steps 2 and then 3. The board does not invent a story to
hold it (FR-014). A `taskIds` entry naming a task that was never reported produces
nothing at all — what was reported is drawn, and absences are not fabricated.

### The unassigned scope

Appended after every reported story, never before or among them, and **absent
entirely when empty** (FR-013). It has no story behind it, so it has no narrative,
no criteria and no counted progress — there is no reported status for a count to
stand in for, and counting a group the agent never declared would be inventing a
subject.

`UNASSIGNED` and `scopeKey` are reused from `state/useSelection.ts` rather than
redefined. A second sentinel meaning the same thing is a second thing to keep in
step, and the NUL trick that makes it uncollidable with a reported `Label` is
worth inheriting rather than reinventing.

---

## What the rule does not do

| Not this | Why |
|---|---|
| Merge two tasks sharing an identifier | Both are drawn where each claims to belong. The board does not pick one or fabricate a merge |
| Sort tasks by status | Reported order is a fact; any other order is the board's opinion |
| Place a task under more than one story | The property that makes the tree countable, and the point of superseding the union rule |
| Withhold a task it cannot place | An earlier draft did. It was abandoned when the tree began to displace the task view: a task reachable nowhere is a different proposition from one reachable in the other tab |
| Infer a story from a task's title, files or identifier prefix | The board derives nothing but the counted progress |
| Count a task as done because its story says done | Placement and status are separate; see FR-029 |

---

## Verification this surface owes

- A task named by both fields in agreement, drawn once.
- A task named by both fields in disagreement, drawn under its own `storyId` only,
  and **not** under the story claiming it.
- A task with a null `storyId` named by a story's `taskIds`, drawn there.
- A task naming an unreported story and named by nobody, drawn in the unassigned
  scope.
- A task named by two stories' `taskIds`, drawn under the first in reported order.
- Tasks reported with no stories at all — every one in the unassigned scope. (This
  session is not offered the tree at all, per [presence.md](presence.md), so this
  is a unit-level case rather than an end-to-end one.)
- No unassigned scope present when every task is placed.
- **Tasks drawn equals tasks reported**, over a report built to hit every branch at
  once.
- The existing story and task views, unchanged, over the same reports — including
  the case where `buildScopes` draws a task twice and this rule draws it once.
