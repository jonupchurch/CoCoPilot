# Implementation Plan: Overview Tab

**Branch**: `004-overview-tab` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-overview-tab/spec.md`

## Summary

The default view: the agent-reported sections — Focus, Spec, Plan, Changed
files — each a collapsible section whose header carries its own summary.

Approach: one `Section` component owning the collapse behaviour and the header
summary contract, with each section supplying its own summary as a derived
value. The status vocabulary lives here, in the renderer, because it is a
rendering concern.

## Technical Context

Inherits [001/research.md](../001-push-contract-service/research.md) and the
renderer conventions established in feature 003. Follows
[`stacks/vite-react.md`](../../stacks/vite-react.md).

**Primary Dependencies**: None beyond feature 003's.

**Constraints**: Usable at the minimum window width; renders 500 tasks without
perceptible delay; displays only what was reported.

## Constitution Check

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Five prioritised stories, no clarification markers |
| II. Validated trust boundaries | **Pass** | All content agent-composed; rendered as text nodes only |
| III. Match existing conventions | **Pass** | Design tokens and layout from the round 1–3 exports (canon); renderer patterns from 003 |
| IV. Scope discipline | **Pass** | No sorting, filtering, grouping or derived counts the agent did not send |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md), including a field-by-field comparison against the report |
| VI. Narrate the reasoning | **Pass** | Design notes below |
| VII. Plan whole set first | **Pass** | Plan 4 of 9 |
| VIII. Test at the right level | **Pass** | Unit for the vocabulary mapping and summary derivation — branching logic where a wrong colour is a real defect; E2E for collapse and reflow |
| IX. Atomic commits, branch | **Deferred** | As 001 |

**No violations.**

## Project Structure

```text
renderer/src/
├── views/overview/
│   ├── OverviewView.tsx
│   ├── FocusSection.tsx      # current task, elapsed tag, agent prose
│   ├── SpecSection.tsx       # feature + tasks
│   ├── PlanSection.tsx
│   └── ChangedFilesSection.tsx
├── components/
│   ├── Section.tsx           # collapse + the header-summary contract
│   ├── TaskRow.tsx
│   └── StatusLabel.tsx       # vocabulary mapping lives behind this
└── lib/
    ├── vocabulary.ts         # recognised statuses → tokens; else neutral
    └── summarise.ts          # per-section header summaries
```

**Structure Decision**: `Section` owns collapse and *requires* a summary from
every caller. Making the summary a required prop rather than an optional
courtesy is what enforces SC-002 structurally — a new section physically cannot
be added without one.

## Design notes

**The vocabulary lives in the renderer, not the contract.** Feature 001 types
`status` as a free string deliberately; mapping `done`/`active`/`blocked`/`todo`
and their synonyms to tokens is a display decision. Putting it in the contract
would make an unrecognised status a validation failure instead of a display
case, inverting decision 25.

**Matching normalises case and surrounding whitespace, and nothing else.** No
fuzzy matching, no prefix matching, no stemming. A near miss renders neutral,
which is harmless; a wrong match paints a signal colour on something the board
does not understand, which actively misleads.

**Every section header summary is derived at render** from held state. Never
stored, never sent by the agent. An agent-supplied "3 of 9 done" could disagree
with the task list it accompanies.

**The focus marker states elapsed time and never changes appearance.** `now`
becomes `4m`, `2h`, in the same slot, with tabular figures so it does not
reflow. No fade, no threshold — the design round proposed a ten-minute mute and
it was rejected for the same reason every other threshold was.

**Section arrangement is component state, not persisted.** It survives reports
because the components do not remount; it does not survive a restart, which is
consistent with everything else.

**Changed files is built last.** It is explicitly the lowest-priority section
and the one whose data is most likely to be stale, since it changes only when an
agent reports.

## Post-design Constitution re-check

Still passing. Principle IV deserves a note: this view is where "the board could
just work this out" is most tempting — counting completed tasks the agent did
not count, inferring a current task from a plan step, sorting tasks by status.
FR-016 and SC-005 forbid all of it, verified by field-by-field comparison rather
than by intent.
