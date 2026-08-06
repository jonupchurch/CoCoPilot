# Quickstart: Transcript Reader

**Feature**: [005-transcript-reader](spec.md) | **Date**: 2026-08-06

## Prerequisites

Features 001–004 implemented. Fixture transcripts under
`apps/board/tests/fixtures/transcripts/`.

## Run the checks

```bash
npm test --workspace=apps/board
npm run test:e2e
```

## Validation scenarios

### 1. Prompts are prompts (US1, US2) — **the trap test**

Point the reader at `tool-results.jsonl`, which contains many `user` records of
which only a few are human prompts.

- The count shown matches the number of **human prompts**, not `user` records.
- No tool output appears in the history list.
- Against the real reference transcript: ~10 prompts from 37 `user` records.

If this shows 37, classification is reading record types instead of content, and
the board is presenting tool output as things the developer typed.

### 2. Reading and copying (US1, US2)

- The most recent prompt is shown as written.
- Earlier prompts list newest first with relative times.
- Expanding one shows its full untruncated text.
- Copying puts **exactly** that text on the clipboard, character for character.
- The total count is stated when more exist than are listed.
- Close and reopen the board: history is still there — the only thing that
  survives a restart.

### 3. Context (US3)

- Files the transcript shows in context are listed.
- One being actively read is distinguishable.
- Collapsed, the header still summarises.

### 4. Degradation (US4) — **the containment tests**

For each fixture, confirm the three sections report **unavailable** and the rest
of the board is fully functional:

| Fixture / condition | Expect |
|---|---|
| No transcript file | Unavailable, no error |
| `garbage.jsonl` | Unavailable, nothing garbled rendered, no crash |
| `truncated.jsonl` | What parses is shown; the partial tail is skipped |
| `unknown-types.jsonl` | Unknown types skipped; known ones still shown |
| Permission denied | Unavailable, not an exception |
| Deleted while open | Becomes unavailable; nothing else changes |

In every case verify explicitly: task list, plan, focus, notes and the title bar
all still work. That is the property the whole dependency rests on.

### 5. Unreadable is not empty (SC-006)

Compare a section with an unreadable source against one with a genuinely empty
source.

- They are **visibly different**.
- Neither presents as the other.

### 6. Read-only and bounded (SC-004, SC-005)

With `node:fs` spied for a full session:

- **Zero** write calls against the transcript location.
- **Zero** reads of any file outside the transcript for the session being shown.
- No other session's transcript is opened.

### 7. Size and responsiveness (SC-007)

With a 100 MB transcript:

- The window stays responsive throughout.
- Appending to the file does not trigger a full re-read.

### 8. Hostile content (SC-009)

A transcript with prompts containing `<script>` and other markup:

- Rendered as visible characters, never executed.

## Expected outcome

All scenarios pass. Scenario 1 and scenario 4 are the two that matter most —
one catches the classification trap, the other proves the blast radius really is
three sections.

## Not validated here

- The slug rule on macOS and Linux — **verify before shipping those platforms**,
  per research.md.
- `isSidechain` filtering with real subagent activity — the reference transcript
  had none. Flagged as untested.
