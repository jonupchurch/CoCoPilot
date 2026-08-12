# Data Model: Spec-Kit Tree

**Feature**: 011 | **Date**: 2026-08-12

**Nothing is added to the contract.** No new field, cap, endpoint or client tool.
The links this tree draws have been reported since feature 001.

One boolean is added to held state and to the projection, and the reason is
FR-003. Everything else is derived in the renderer from a payload it already
receives.

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

---

## Held state (`apps/board/src/main/store.ts`)

```
Session {
  ...existing
  everReportedStories: boolean   // one-way: set true, never set false
}
```

Set by `putReport` when the incoming report carries at least one story. **Never
cleared**, and cleared only by the session going — dismissal or restart.

**Why this is in the store and not the renderer.** Reports replace wholesale
(decision 26), so `stories` being empty in the report on screen says nothing about
whether this session ever had them. FR-001 offers the tree to a session that *has
reported* stories and FR-003 keeps offering it when a later report carries none,
so something has to remember. This is a fact about a session's history, which is
what the main process holds — the same reason feature 010 held a ticket outside
the report. [research.md §2](research.md) has the rejected alternatives, chiefly a
renderer `Set`, which needs an observer watching for report arrivals.

This is a one-line change to one write path. `putReport` gains an OR; nothing else
in the store is touched, and there is no merge.

## Projection (`apps/board/src/main/view.ts`)

```
SessionView {
  ...existing
  everReportedStories: boolean
}
```

Listed field by field like every other, not spread. `SessionSummary` is
**unchanged** — a pill draws identity, chip and elapsed time, and which
destinations a session offers is not a pill's business.

---

## Placement (renderer)

The feature's one rule, specified in full in
[contracts/placement.md](contracts/placement.md).

```
place(stories, tasks) -> Scope[]
```

- A task is placed under the story its own `storyId` names, whenever that story
  was reported.
- A task whose `storyId` is null or names an unreported story is placed under the
  first reported story whose `taskIds` names it.
- A task placed by neither goes into a final unassigned scope, which is **present
  only when it holds something** (FR-012, FR-013).
- Every task appears exactly **once**.
- Order within a story is reported task order, never re-sorted.

`Scope` — `{ id, story, tasks }` — and the `UNASSIGNED` sentinel and its
`scopeKey` helper are reused from `state/useSelection.ts` as **values**, so that
`StoryDetail` and `TaskDetail` can be handed one unchanged and so that a second
sentinel meaning the same thing does not exist. What is *not* reused is
`buildScopes`, which unions the two link directions and can therefore place a task
twice; it stays where it is, serving the views that still use it.
[research.md §1](research.md).

One narrowing holds here that does not hold for `buildScopes`, and code may rely
on it: **no task id appears in two scopes.**

---

## Renderer state

Four pieces, all dying with the window.

```
selection:    { kind: 'story' | 'task', id: string } | null   // intent, not resolution
toggled:      Set<string>                                     // story ids deviating from default
usedOldViews: Set<string>                                     // session ids where a legacy view was opened
scroll:       (the browser's own, unmanaged)
```

**Intent, resolved on render.** Nothing here is synchronised with a report and
nothing is copied out of one. `useSelection` established the pattern and states
the reason: reconciliation is derivation, so a story ceasing to exist between one
report and the next is ordinary rather than exceptional.

`usedOldViews` is keyed by session id because FR-006 requires the decision to be
per session. It is the one piece of state here recording something the *developer*
did rather than something an agent reported, which is precisely why it is in the
renderer and not the store — no other window would agree about it.
[research.md §3](research.md).

### Resolving a selection

```
resolveSelection(scopes, selection) -> { story, task, missing }
```

`missing` is true when an intent names something the current report no longer
contains; the view says so and shows nothing selected (FR-034). **There is no
fallback to the first item** — the deliberate divergence from `resolve` in
`useSelection`, which does fall back and argues for it.

### Resolving expansion

```
isOpen(story) = defaultOpen(story) !== toggled.has(story.id)
defaultOpen(story) = story contains the task named by focus.task
```

Holding the *deviation* rather than the state is what lets the default follow the
agent's current task while a developer's collapse survives every later report.

### Resolving which destinations a session offers

```
tree      = session.everReportedStories
oldViews  = !tree || usedOldViews.has(session.key)
```

Two booleans, both derived, no third state. `tree` is one-way because the store's
field is; `oldViews` is one-way because a session id is only ever added to
`usedOldViews`. That is what makes FR-007 structural: neither can go from offered
to not-offered while the session lives.

`scroll` is listed because FR-032 names it, not because anything manages it: the
tree is one scroll container and nothing re-mounts it, which is what keeps the
position. A property to be tested rather than code to be written.

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

`unrecognised` is never folded into any other bucket. That is FR-027, and it is
the same refusal `classify` already makes for colour.

The unassigned scope has no story and therefore no counted progress — there is no
reported status for it to stand in for, and counting a group the agent never
declared would be inventing a subject.

---

## What is deliberately not modelled

- **A story's own rolled-up status word.** Counts only — [research.md §4](research.md).
- **Any comparison between a story's reported status and its tasks.** FR-029.
- **A parent above stories, or a level below tasks.** Two levels, because the
  contract has two.
- **A count of tasks not shown.** Nothing is withheld any more; every task is in
  the tree, so there is nothing to count. This replaces a `withheld` number an
  earlier draft carried.
- **`hasTree` or any second field meaning what `everReportedStories` means.** The
  renderer decides from the one boolean, and two fields meaning one thing are two
  things to keep in step.
- **Anything remembered across reports beyond that boolean** — a previous shape, a
  diff, a history.
- **Anything in `SessionSummary`.** Pills are untouched.
