# Implementation Plan: Spec-Kit Tree

**Branch**: `011-speckit-tree` | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-speckit-tree/spec.md`

## Summary

A destination drawing stories and their tasks as one two-level tree with a detail
pane beside it, offered only to sessions that have reported stories, and standing
in place of the separate story and task views where it appears. One boolean joins
the store and the projection so that presence is a fact about a session rather
than about the report on screen; everything else is renderer-only. No contract
field, no endpoint, no new dependency.

The feature's substance is two rules — where a task is drawn, and which
destinations a session offers — plus a count and two pieces of derived view
state. Its difficulty is that a placement rule already exists, built to the
opposite conflict rule, serving the views this one displaces.

## Technical Context

Inherits the renderer conventions from features 003–008. The two views being
displaced are feature 006's.

**Primary Dependencies**: None new. No tree library, no virtualisation, no state
library, no dependency added to any package.

**Storage**: None. One boolean joins in-memory session state and dies with the
process, like everything else.

**Constraints**: Every destination legible at the 380px floor in every
combination this feature can produce; the story and task views must present
exactly what they presented before, for the sessions that still get them; nothing
derived but the counted progress; nothing retained across a restart.

**Scale/Scope**: `MAX_STORIES` and `MAX_TASKS` as already capped — the quickstart
exercises 50 stories and 500 tasks. Two levels, because the contract has two.

## Constitution Check

*GATE: passed before Phase 0, re-checked after Phase 1.*

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Six stories, no clarification markers. Six questions that would have changed the build were put to the owner and answered before the spec was written — three on placement and rollup, three on presence and the swap. The gate an earlier draft carried is closed rather than deferred |
| II. Validated trust boundaries | **Pass** | No new input and no new channel. Every value drawn is already validated at ingest by `packages/contract`; the one new stored field is computed from an already-validated array's length |
| III. Match existing conventions | **Pass, with a recorded divergence** | Reuses `Scope`, `UNASSIGNED`, `scopeKey`, `StoryDetail`, `TaskDetail`, `TaskRow`, `StatusLabel`, `Section`, `classify`, `useIsNarrow`, `elapsed`, and the hold-intent-derive-on-render pattern; the new store field mirrors how feature 010 held a ticket outside the report. **Diverges** by adding a second placement rule beside `buildScopes` — see Complexity Tracking |
| IV. Scope discipline | **Pass** | No contract change, no retirement of the displaced views, no setting to choose between them, no search, filter, reorder or drag, no history, no third level. Each named and declined |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md), twelve scenarios, with the display-scale caveat restated and the density scenario aimed at the widest combination rather than the ordinary one |
| VI. Narrate the reasoning | **Pass** | Design notes below; [research.md](research.md) carries seven decisions with alternatives and rejections |
| VII. Plan whole set first | **Pass** | The initial nine are built and 010 is planned. Ordinary feature work under the rule's own exception |
| VIII. Test at the right level | **Pass** | Unit for placement, presence, counting and tree state — all pure functions; integration for the store's one-way boolean; end-to-end for the no-withdrawal sequence, the untouched legacy views, and density at the floor |
| IX. Atomic commits, branch | **Pass** | On `011-speckit-tree`; spec and plan committed separately, both before any code |

**One violation recorded.** See Complexity Tracking.

## Complexity Tracking

| Violation | Why it is needed | Simpler alternative rejected because |
|---|---|---|
| **Two placement rules in the renderer** — this feature's `place` beside the existing `buildScopes`, differing on one question: what happens when a task and a story disagree about which owns the task | SC-003 requires the story and task views to present exactly what they presented before, for every session that still gets them, so the function underneath them cannot change. FR-010 and FR-011 require this view to place a task exactly once, which the union rule cannot do | *Parameterising `buildScopes`* makes both behaviours read as standing options at both call sites, when the content of the decision is that one supersedes the other. *Changing it* silently alters two shipped views. *Sharing the now-common parts* spreads one small rule across two files so that neither states it whole. Full argument: [research.md §1](research.md) |

**The divergence narrowed during specification and is worth recording as such.**
An earlier draft withheld tasks belonging to no story, which put the two rules at
odds twice over. Gathering them into an unassigned group instead — the same answer
`buildScopes` already reached, for the same reason — leaves exactly one difference
and restores feature 006's FR-018. What remains is the conflict rule, and the tree
needs exactly-once in a way the old scoped lists never did.

## Project Structure

### Documentation (this feature)

```text
specs/011-speckit-tree/
├── spec.md
├── plan.md                      # this file
├── research.md                  # seven decisions with alternatives
├── data-model.md                # what arrives, the one new field, what is derived
├── contracts/
│   ├── placement.md             # where a task is drawn
│   └── presence.md              # which destinations a session offers
├── quickstart.md
└── checklists/requirements.md
```

### Source

```text
packages/contract/               # UNCHANGED — no field, no cap, no endpoint

apps/board/src/main/
├── store.ts                     # + Session.everReportedStories, one OR in putReport
└── view.ts                      # + everReportedStories on SessionView

apps/board/src/renderer/src/
├── app/
│   ├── TabStrip.tsx             # + the "Spec-Kit" destination
│   └── App.tsx                  # + the presence rule; the tree tab case
├── lib/
│   ├── progress.ts              # NEW: counts over classify, never a word
│   └── progress.test.ts         # NEW
├── state/
│   ├── usePlacement.ts          # NEW: the rule, reusing Scope and UNASSIGNED
│   ├── usePlacement.test.ts     # NEW
│   ├── usePresence.ts           # NEW: the two one-way booleans
│   ├── usePresence.test.ts      # NEW
│   ├── useTreeState.ts          # NEW: selection intent + toggled expansion
│   ├── useTreeState.test.ts     # NEW
│   └── useSelection.ts          # UNCHANGED — + a comment naming the other rule
└── views/speckit/
    ├── SpecKitView.tsx          # NEW: tree and pane
    ├── StoryNode.tsx            # NEW: a story row and its counted progress
    ├── TaskNode.tsx             # NEW: wraps the existing TaskRow
    └── DetailPane.tsx           # NEW: dispatches to StoryDetail or TaskDetail
```

**Untouched, and a test says so**: `views/stories/`, `views/tasks/`,
`state/useSelection.ts`'s logic, and every package under `packages/`.

**Structure Decision**: the four pure functions — placement, presence, counting,
expansion — live outside the view, in `state/` and `lib/`, because all four are
decisions about data rather than about drawing, and all four are the kind of thing
a unit test pins exactly. That is the split features 006 and 007 already use:
`useSelection` and `useUnread` hold the rule, the view holds the markup.

The view is a directory of small components matching `views/overview/`,
`views/tasks/` and `views/notes/`.

## Design notes

**Presence is a fact about a session, so it goes in the store.** FR-001 offers the
tree to a session that *has reported* stories and FR-003 keeps offering it when a
later report carries none — and reports replace wholesale, so the report on screen
cannot answer the question. One boolean on `Session`, set by an OR in `putReport`,
never cleared. That is the same move feature 010 made when it held a ticket
outside the report, and it is why this feature is not renderer-only. The
alternative — a renderer `Set` accumulated as reports arrive — needs an observer
watching for arrivals, which is the pattern this codebase has twice argued
against. [research.md §2](research.md).

**"Once used" is renderer state, and the split is deliberate.** Which views a
developer has opened is not a fact about the work: no agent reported it and no
other window would agree about it. History lives in the store, behaviour lives in
the renderer. [research.md §3](research.md).

**Both booleans are one-way, and that is the entire safety argument.** Neither can
go from true to false while a session lives, so no destination can go from offered
to not-offered — except the legacy views at the single moment the tree first
appears, and at that moment "once used" decides. A developer who never opened a
view cannot be reading it. FR-007 is therefore structural rather than careful:
there is no timing to get right and no transition to animate, and decision 36's
complaint — a tab withdrawn mid-read, the fallback moving the developer to
Overview — has no way to recur. [contracts/presence.md](contracts/presence.md).

**The plan's main decision is still not to fix the code that already does this.**
`buildScopes` places tasks under stories today and will go on serving every
non-Spec-Kit session and every session whose developer kept the old views. Its
conflict rule is argued in the file and the argument is good for a pair of scoped
lists; it is wrong for a tree, where one task under two parents reads as two
tasks. Superseded in a new view, not corrected. [research.md §1](research.md).

**What is reused is the shape, not the rule.** `Scope` is a value type, so this
feature's placement emits `Scope` values and hands them to the existing
`StoryDetail` and `TaskDetail` unchanged. `UNASSIGNED` and `scopeKey` are reused
outright now that this feature also has an unassigned group — a second sentinel
meaning the same thing would be a second thing to keep in step.

**Counted progress is counts, never a derived word.** "3 of 7 done", plus a stated
number the vocabulary could not recognise. A single rolled-up status would need a
precedence among blocked, active and todo that the board cannot defend, and
whatever word emerged would be indistinguishable from one an agent reported —
exactly what FR-026 forbids. `classify` already refuses to guess, and counting
inherits the refusal. [research.md §4](research.md).

**Expansion holds the deviation, not the state.** `isOpen = defaultOpen XOR
toggled`. A set of open ids cannot distinguish "the developer closed this" from
"never opened", so either the default stops working after the first report or a
collapse is undone by the next one — both FR-033 violations.
[research.md §5](research.md).

**The navigation shrinks in the ordinary case.** One destination arrives and two
leave, so a Spec-Kit session whose developer never opened the legacy views has a
*shorter* strip than today's. The widest case — Overview, Ticket, Spec-Kit,
Stories, Tasks, Notes — needs a Spec-Kit session, feature 010's ticket, and a
developer who deliberately opened a legacy view. It is real, it is transient, and
it is the case the quickstart measures, because measuring the easy one proves
nothing. [research.md §7](research.md).

**`only-reported.spec.ts` gains a subtraction block** for the tree. The counted
progress is board text, and it is the first entry in that file that is
*arithmetic* rather than a label — worth a sentence where it is declared.

## Post-design Constitution re-check

Still passing, with the same single violation and no new ones. Phase 1 tightened
three things and loosened none.

Writing [contracts/placement.md](contracts/placement.md) forced the three
properties — exactly-once, total, order-stable — to be stated, and the first two
collapse into one assertion, `tasks drawn = tasks reported`, which is now the
first test the quickstart asks for.

Writing [contracts/presence.md](contracts/presence.md) turned "do not take a view
away from a reader" from a rule someone has to honour into a property of two
one-way booleans. That is the difference between a requirement and an invariant,
and it is why FR-007 needs no code of its own.

Working through the detail pane confirmed that `Scope` is a shape rather than a
rule, which is what keeps the recorded divergence to one function instead of a
parallel view tree.

**Ready for `/speckit-tasks`.** Four things a task list should keep hold of. The
store's boolean comes first and alone, because every presence decision depends on
it and it is the feature's only change outside the renderer. The placement rule
and its `tasks drawn = tasks reported` assertion come next, because every view
task depends on the tree being countable. The no-withdrawal test is not polish and
must not drift to the end — it is the requirement that shaped the design, and it
asserts over a *sequence* rather than a screen. And the density measurement must
target the widest combination, not the ordinary one, or it will pass without
having tested anything.
