# Data Model: Spec-Kit Tree

**Feature**: 011 | **Date**: 2026-08-12

**Nothing is added to the contract, the store, or the projection.** This feature
is renderer-only. Everything below is state the window derives from a payload it
already receives.

That is worth stating plainly because it is unusual here: features 004 through
010 each widened something. This one draws a relationship the board has been
receiving since feature 001 and has never shown.

---

## What already arrives, unchanged

From `packages/contract`, via `SessionView`:

| Field | Shape | Used for |
|---|---|---|
| `stories[]` | `Story` | The tree's top level, in reported order |
| `stories[].taskIds` | `Label[]`, default `[]` | Placement, **second** — only for a task that names no story |
| `stories[].status` | `Label \| null` | Shown as reported; its absence is what triggers counting |
| `stories[].asA / want / soThat / criteria / priority / files` | | The story detail pane |
| `tasks[]` | `Task` | The tree's second level |
| `tasks[].storyId` | `Label \| null` | Placement, **first** and authoritative |
| `tasks[].status` | `Label`, required | Its own display, and the counting |
| `tasks[].detail / checks / files` | | The task detail pane |
| `focus.task` | `Label \| null` | Which story opens by default |
| `reportedAt` | `number \| null` | The elapsed tag, as the existing views use it |

No new cap, no new field, no new endpoint, no new client tool. If the tree turns
out to need something the payload cannot supply, that is a finding that sends
this plan back rather than a licence to widen the contract.

---

## Placement

The feature's one rule, stated once and specified in full in
[contracts/placement.md](contracts/placement.md).

```
place(stories, tasks) -> { scopes: Scope[], withheld: number }
```

- A task is placed under the story its own `storyId` names, whenever that story
  was reported.
- A task whose `storyId` is null or names an unreported story is placed under the
  first reported story whose `taskIds` names it.
- A task placed by neither is **withheld** and counted. It appears nowhere.
- Every placed task appears exactly once.
- Order within a story is reported task order, never re-sorted.

`Scope` is the existing shape from `state/useSelection.ts` — `{ id, story, tasks }`
— reused as a **value type** so that `StoryDetail` and `TaskDetail` can be handed
one unchanged. It is not the existing `buildScopes` rule, which stays where it is
and goes on serving the two existing views. Full argument:
[research.md §1](research.md).

Two narrowings hold here that do not hold for `buildScopes`, and code may rely on
them: `scope.story` is **never null** in this feature, because there is no
unassigned scope; and no task id appears in two scopes.

---

## Held state

Three pieces, all in the renderer, all dying with the window.

```
selection: { kind: 'story' | 'task', id: string } | null   // intent, not resolution
toggled:   Set<string>                                     // story ids deviating from default
scroll:    (the browser's own, unmanaged)
```

**Intent, resolved on render.** Nothing here is synchronised with a report and
nothing is copied out of one. `useSelection` established the pattern and states
the reason: reconciliation is derivation, so a story ceasing to exist between one
report and the next is ordinary rather than exceptional.

### Resolving a selection

```
resolveSelection(scopes, selection) -> { story, task, missing }
```

- `missing` is true when an intent names something the current report no longer
  contains. The view says so and shows nothing selected (FR-027).
- **There is no fallback to the first item.** This is the deliberate divergence
  from `resolve` in `useSelection`, which does fall back and argues for it. See
  [research.md §2](research.md).

### Resolving expansion

```
isOpen(story) = defaultOpen(story) !== toggled.has(story.id)
defaultOpen(story) = story contains the task named by focus.task
```

Holding the *deviation* rather than the state is what lets the default follow the
agent's current task while a developer's collapse survives every later report.
[research.md §4](research.md) has the alternatives and why holding a set of open
ids breaks.

`scroll` is listed because FR-025 names it, not because anything manages it: the
tree is one scroll container and nothing re-mounts it, which is what keeps the
position. That is a property to be tested rather than code to be written.

---

## Counted progress

```
count(tasks) -> { done, active, blocked, todo, unrecognised, total }
```

Computed **only** for a story whose own `status` is null or blank, and only when
it has at least one task placed beneath it. Every task is classified through the
existing `classify` in `lib/vocabulary.ts` — this feature adds no status word and
no synonym.

| Case | Shown |
|---|---|
| Story reports a status | That status, as reported. No count |
| No status, has tasks | Counts, presented as the board's arithmetic |
| No status, has tasks the vocabulary does not recognise | Counts, **plus** how many were not recognised |
| No status, no tasks placed | Nothing |

`unrecognised` is never folded into any other bucket. That is FR-020, and it is
the same refusal `classify` already makes for colour: the board does not decide
that a status it cannot read means "not done".

---

## What is deliberately not modelled

- **A story's own rolled-up status word.** Counts only — [research.md §3](research.md).
- **Any comparison between a story's reported status and its tasks.** FR-022. The
  board holds both and states neither disagreement.
- **A parent above stories, or a level below tasks.** Two levels, because the
  contract has two.
- **Anything remembered across reports** — a previous shape, a diff, a history.
  The tree draws the current report.
- **`hasChildren`, `depth`, `path` or any other flattened-tree bookkeeping.** The
  structure is two levels and is recomputed from the report; a materialised tree
  would be a second copy to keep in step.
- **Anything in the store, the projection, or `SessionSummary`.** Pills draw
  identity, chip and elapsed time, and this feature does not touch them.
