# Quickstart: Overview Tab

**Feature**: [004-overview-tab](spec.md) | **Date**: 2026-08-06

## Prerequisites

Features 001–003 implemented. `npm run dev --workspace=apps/board`.

## Run the checks

```bash
npm test --workspace=apps/board
npm run test:e2e
npm run typecheck
```

## Validation scenarios

### 1. Current work is obvious (US1)

Report a session with `focus.task` and prose.

- The task is marked as current, distinct from every other row.
- The prose appears as written.
- The tag reads `now`; after four minutes it reads `4m`, in the same slot,
  with no colour or weight change.
- Report a different current task: the marker moves.
- Report with no focus: the section says so, and no task is arbitrarily marked.

### 2. Feature and tasks (US2)

Report a feature with a mix of statuses.

- Identifier and title appear.
- Each task shows identifier, title and status.
- **Collapse the section**: the header still shows completion.

### 3. Status vocabulary (US2)

Report tasks with: `done`, `DONE`, ` in progress `, `wip`, `blocked`,
`waiting on CI`, `donee`.

| Status | Expect |
|---|---|
| `done`, `DONE` | Recognised — same treatment, case ignored |
| ` in progress `, `wip` | Recognised as active |
| `blocked` | Recognised, ember |
| `waiting on CI` | **Neutral**, text shown in full |
| `donee` | **Neutral** — a near miss is not a match |

The last row is the one that matters. If `donee` renders as done, matching is
too loose and the board is confidently wrong.

### 4. Plan and changed files (US3, US4)

- Plan steps appear in reported order, current step distinguished.
- Collapsed, the plan header still shows position.
- Changed files list with kinds; collapsed header shows an aggregate.
- **Edit a file in the repository by hand**: nothing in the view changes.

### 5. Collapse behaviour (US5)

- Collapse each section: content hides, sections below move up.
- Every collapsed header still shows its label and summary.
- Collapse all four: each question is still answered by headers alone.
- Report while collapsed: the arrangement and scroll position survive.

### 6. Only what was reported (SC-005) — **the comparison test**

Report a known payload, then compare the rendered view against it field by
field.

- Every value on screen traces to a field in the report.
- No count, status, ordering or label was computed that the agent did not send.

This is what catches helpfulness — a derived "3 of 9" that disagrees with the
list beside it, or tasks quietly sorted by status.

### 7. Limits and hostile content

- 500 tasks: the section stays navigable, the header summary stays correct.
- A 200-character status and a 500-character path: truncated legibly, full text
  retrievable.
- Prose containing `<script>`: rendered as visible characters.

## Expected outcome

All scenarios pass; the vocabulary unit tests cover every synonym and the
near-miss case; the view is usable at minimum width with no horizontal scroll.

## Not validated here

- Prompt, history and in-context sections — feature 005, same tab, different
  source.
- Story and task detail views — feature 006.
