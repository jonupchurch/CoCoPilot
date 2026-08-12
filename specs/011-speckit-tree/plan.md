# Implementation Plan: Spec-Kit Tree

**Branch**: `011-speckit-tree` | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-speckit-tree/spec.md`

## Summary

A sixth destination drawing stories and their tasks as one two-level tree with a
detail pane beside it. Renderer-only: no contract field, no endpoint, no store
branch, no projection change, no new dependency. The feature's whole substance is
a placement rule, a count, and two pieces of derived view state — and its whole
difficulty is that a placement rule already exists, built to the opposite rules,
shared by the two views this one duplicates.

## Technical Context

Inherits the renderer conventions from features 003–008. The two views being
duplicated are feature 006's.

**Primary Dependencies**: None new. No tree library, no virtualisation, no state
library, no dependency added to any package.

**Storage**: None, as ever.

**Constraints**: Six destinations legible at the 380px floor with no horizontal
scrolling; the two existing views must present exactly what they presented
before; nothing derived but the count FR-018 permits; nothing retained across a
restart.

**Scale/Scope**: `MAX_STORIES` and `MAX_TASKS` as already capped — the quickstart
exercises 50 stories and 500 tasks. Two levels, because the contract has two.

## Constitution Check

*GATE: passed before Phase 0, re-checked after Phase 1.*

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Five stories, no clarification markers. The three questions that decided the shape — orphan tasks, rollup, link conflict — were put to the owner and answered before the spec was written; the one question left open is named as open and gated |
| II. Validated trust boundaries | **Pass** | No new input. Every value drawn is already validated at ingest by `packages/contract`; the renderer adds no trust boundary because it gains no channel |
| III. Match existing conventions | **Pass, with a recorded divergence** | Reuses `Scope`, `StoryDetail`, `TaskDetail`, `TaskRow`, `StatusLabel`, `Section`, `classify`, `useIsNarrow`, `elapsed`, and the hold-intent-derive-on-render pattern. **Diverges** by adding a second placement rule beside `buildScopes` — see Complexity Tracking |
| IV. Scope discipline | **Pass** | No contract change, no retirement of the tabs this duplicates, no search, filter, reorder or drag, no history, no third level. Each named and declined |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md), ten scenarios, with the display-scale caveat restated and one scenario whose failure has a prescribed response rather than a fix |
| VI. Narrate the reasoning | **Pass** | Design notes below; [research.md](research.md) carries six decisions with their alternatives and rejections |
| VII. Plan whole set first | **Pass** | The initial nine are built and 010 is planned. Ordinary feature work under the rule's own exception |
| VIII. Test at the right level | **Pass** | Unit for placement, counting and tree state — all three are pure functions over reported data; end-to-end for stickiness, withholding, the untouched tabs, and density at the floor |
| IX. Atomic commits, branch | **Pass** | On `011-speckit-tree`; spec committed separately from plan, both before any code |

**One violation recorded.** See Complexity Tracking.

## Complexity Tracking

| Violation | Why it is needed | Simpler alternative rejected because |
|---|---|---|
| **Two placement rules in the renderer** — this feature's `place` beside the existing `buildScopes`, computing different answers from the same report | FR-028 and SC-008 require the Stories and Tasks tabs to present exactly what they presented before, so the function underneath them cannot change. FR-003 and FR-005 require this view to place differently. Both cannot hold with one rule | *Parameterising `buildScopes`* makes both behaviours read as standing options at both call sites, when the content of the decision is that one supersedes the other, and multiplies its test matrix to describe a state of the world meant to last one feature. *Changing `buildScopes`* silently alters two shipped views, including making a task vanish from the Tasks tab. Full argument: [research.md §1](research.md) |

**The mitigation is an end date, not a comment.** The duplication lasts exactly as
long as the duplicated views do; retiring them retires `buildScopes` and
`UNASSIGNED` with them, on the same trigger the spec already gates. Each file
names the other, and a test pins each rule to its own view so that "fixing"
either one fails loudly.

## Project Structure

### Documentation (this feature)

```text
specs/011-speckit-tree/
├── spec.md
├── plan.md                      # this file
├── research.md                  # six decisions with alternatives
├── data-model.md                # what arrives, what is derived, what is held
├── contracts/
│   └── placement.md             # the rule, its three properties, and its gate
├── quickstart.md
└── checklists/requirements.md
```

### Source

```text
apps/board/src/renderer/src/
├── app/
│   ├── TabStrip.tsx             # + the "Spec-Kit" destination, last
│   └── App.tsx                  # + the one case; availableTabs unchanged
├── lib/
│   ├── progress.ts              # NEW: counts over classify, never a word
│   └── progress.test.ts         # NEW
├── state/
│   ├── usePlacement.ts          # NEW: the rule, and the withheld count
│   ├── usePlacement.test.ts     # NEW
│   ├── useTreeState.ts          # NEW: selection intent + toggled expansion
│   ├── useTreeState.test.ts     # NEW
│   └── useSelection.ts          # UNCHANGED — + a comment naming the other rule
└── views/speckit/
    ├── SpecKitView.tsx          # NEW: tree, pane, withheld notice
    ├── StoryNode.tsx            # NEW: a story row and its counted progress
    ├── TaskNode.tsx             # NEW: wraps the existing TaskRow
    └── DetailPane.tsx           # NEW: dispatches to StoryDetail or TaskDetail
```

**Untouched, and a test says so**: `views/stories/`, `views/tasks/`,
`state/useSelection.ts`'s logic, everything in `apps/board/src/main/`, and every
package under `packages/`.

**Structure Decision**: the three pure functions — placement, counting, expansion
— live outside the view, in `state/` and `lib/`, because all three are decisions
about reported data rather than about drawing, and all three are the kind of thing
a unit test can pin exactly. That is the split features 006 and 007 already use:
`useSelection` and `useUnread` hold the rule, the view holds the markup.

The view is a directory of small components matching `views/overview/`,
`views/tasks/` and `views/notes/`.

## Design notes

**The plan's main decision is not to fix the code that already does this.**
`buildScopes` places tasks under stories today, by the union of both link fields,
with an `UNASSIGNED` scope for orphans. Its comments argue for both choices, and
the arguments are good — `UNASSIGNED` exists specifically to satisfy feature 006's
FR-018. This feature was specified to do the opposite in a new view while those
two views keep running unchanged, so the old rule is superseded rather than
corrected, and superseded rules do not get edited. [research.md §1](research.md).

**What is reused is the shape, not the rule.** `Scope` is `{ id, story, tasks }` —
a value type, not a policy — and `StoryDetail` and `TaskDetail` take one. This
feature's placement emits `Scope` values and hands them to those components
unchanged, inheriting the presentation without inheriting `buildScopes`. Two
narrowings hold here that do not hold there and code may rely on them:
`scope.story` is never null, and no task id appears twice.

**`resolve` is the one piece of `useSelection` that cannot be reused.** It falls
back to the first item and argues for it, correctly, for a two-pane list where
something must be shown. FR-027 requires the opposite here, and a tree has a third
option a list does not: nothing selected is legible when the whole tree is still
on screen. Reusing it would also silently expand whichever story holds the new
first task, which is FR-026's exact prohibition. [research.md §2](research.md).

**Counted progress is counts, never a derived word.** "3 of 7 done", plus a stated
number the vocabulary could not recognise. A single rolled-up status would need a
precedence among blocked, active and todo that the board cannot defend, and
whatever word emerged would be indistinguishable from one an agent reported —
exactly what FR-019 forbids. Counts are visibly arithmetic, so nothing has to be
styled into looking derived. `classify` already refuses to guess, and counting
inherits the refusal: an unrecognised status is counted as unrecognised and said
so, never folded into "not done". [research.md §3](research.md).

**Expansion holds the deviation, not the state.** `isOpen = defaultOpen XOR
toggled`, where the default is open for the story holding the current task. A set
of open ids cannot distinguish "the developer closed this" from "never opened",
so either the default stops working after the first report or a collapse is undone
by the next one — both FR-026 violations. Holding the deviation makes the default
and the preservation one expression, with no effect and nothing initialised from a
report. [research.md §4](research.md).

**Withholding is stated, and the degenerate case is why.** An agent reporting
tasks and no stories withholds every one of them; without the count that is
indistinguishable from a session that reported nothing, and reads as a broken
board. The count is the board's own arithmetic, so unlike feature 010's
`commentsOmitted` it does not depend on the agent to be honest.

**The sixth destination is the risk, and it is a measurement.** Feature 010 takes
the strip to five and had to shorten a label to do it. The spec holds the floor
(FR-029, SC-009). If six will not fit, the prescribed answer is to bring the
retirement of the two duplicated tabs forward — landing at four — and not to
relax the floor or add a second navigation idiom. That escalation is deliberately
not taken pre-emptively, because retirement depends on a question the spec gates
and does not answer, and forcing that answer to satisfy a layout constraint that
has not yet been measured to fail is how a product decision gets made for the
wrong reason. [research.md §5](research.md).

**The tab sits last.** The active destination falls back to the first available,
so anything placed earlier risks changing which view a session lands on — the trap
feature 010 identified. A tab duplicating two that already exist has the weakest
claim to prominence.

**`only-reported.spec.ts` gains a fifth subtraction block**, or a sixth if 010 has
landed. The counted progress is board text and so is the withheld notice, and each
has to be declared. The count is the first entry in that file that is *arithmetic*
rather than a label, which is worth a sentence where it is declared.

## Post-design Constitution re-check

Still passing, with the same single violation recorded above and no new ones.

Phase 1 tightened two things. Writing [contracts/placement.md](contracts/placement.md)
forced the three properties — exactly-once, total, order-stable — to be stated,
and the exactly-once property is what makes `drawn + withheld = reported` a single
assertion rather than a suite of cases; that assertion is now the first test the
quickstart asks for. And working through the detail pane surfaced that `Scope` is
a shape rather than a rule, which is what makes reuse safe and is the reason the
divergence in Complexity Tracking is one function rather than a parallel view
tree.

Phase 1 loosened nothing. The scope declined at the outset — no contract change,
no retirement, no third level, no search or filter — is the same scope declined
now.

**Ready for `/speckit-tasks`.** Three things a task list should keep hold of. The
placement rule and its `drawn + withheld = reported` assertion come first and
alone, because every other task depends on the tree being countable. The
regression test that the two existing tabs are unchanged is not polish and should
not drift to the end — it is the requirement that shaped the whole design, and it
should fail loudly from the first commit that touches anything shared. And the
density measurement should be run early rather than last, because its failure
changes the plan rather than the code.
