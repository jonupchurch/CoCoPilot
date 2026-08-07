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
- Against the real reference transcript: **57 prompts from 1,134 `user`
  records** — re-measured on an 11 MB session. The first pass's "~10 from 37"
  came from a short one and understated the ratio by a factor of three.

If this shows 1,134, classification is reading record types instead of content,
and the board is presenting tool output as things the developer typed. If it
shows 74, it stopped at "the content is text" and is presenting skill payloads
and interrupt markers the same way.

### 2. Reading and copying (US1, US2)

- The most recent prompt is shown as written.
- Earlier prompts list newest first with relative times.
- Expanding one shows its full untruncated text.
- Copying puts **exactly** that text on the clipboard, character for character —
  with one platform exception found while building this: **on Windows every
  newline comes back as CRLF.** The clipboard's text format there is
  `CF_UNICODETEXT`, whose convention is CRLF, and Chromium converts on the way
  out; no API can put a bare LF on it. Strip `\r` and the result is the original
  exactly, which is what the end-to-end test asserts. Nothing else changes — not
  the tabs, the doubled spaces, or the trailing space a `trim()` would eat.
- The total count is stated when more exist than are listed, and **"Show all N"
  expands the list in place**. Design round 2 flagged that the export's
  "Show all 18" had no destination; there is no separate history view to send
  anyone to, and inventing one would be a second place to read the same thing.
  The list shows 4 until asked, as the export draws it.
- Close and reopen the board: history is still there — the only thing that
  survives a restart.

### 3. Context (US3)

- Files the transcript shows in context are listed.
- One being actively read is distinguishable.
- Collapsed, the header still summarises.

### 4. Degradation (US4) — **the containment tests**

For each fixture, confirm the transcript sections degrade to a defined state and
the rest of the board is fully functional.

**Two failure states, not one** — this table said "unavailable" for all six
before the tests were written, and that is one state too few. `unreadable` means
the source could not be read; `empty` means it was read fine and holds nothing.
Collapsing them would make SC-006 unsatisfiable, so the distinction is the thing
under test rather than a detail:

| Fixture / condition | State | Expect |
|---|---|---|
| No transcript file | `unreadable` | Says unavailable, no error |
| Rejected transcript id (`../…`) | `unreadable` | Refused, never opened |
| Directory where the file should be | `unreadable` | Says unavailable, no error |
| Permission denied | `unreadable` | A value, not an exception |
| Deleted while open | `unreadable` | Becomes unavailable; nothing else changes |
| `garbage.jsonl` | `empty` | Every line skipped, nothing garbled on screen |
| Only wrappers / only tool results | `empty` | Nothing presented as a prompt |
| `truncated.jsonl` | `available` | What parses is shown; the partial tail waits |
| `unknown-types.jsonl` | `available` | Unknown types skipped; known ones still shown |
| `string-content.jsonl` | `available` | String content is a prompt, not a dropped one |

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

SC-007 sets the bar at 100 MB. The suite runs **20 MB**, which crosses the
reader's 256 KiB chunk eighty times and keeps the suite quick; the property being
proved is that the cost is linear and bounded, not that any particular size is
the limit.

- The window stays responsive throughout.
- Appending one line costs one line's work, not the file's — asserted directly,
  by reading a 20 MB file, appending a row, and requiring the second read to
  finish inside half a second.

### 8. Hostile content (SC-009)

A transcript with prompts containing `<script>` and other markup:

- Rendered as visible characters, never executed.

## Expected outcome

All scenarios pass. Scenario 1 and scenario 4 are the two that matter most —
one catches the classification trap, the other proves the blast radius really is
three sections.

## Not validated here

- The slug rule on macOS and Linux — **verify before shipping those platforms**,
  per research.md. The corrected rule has no platform-specific clause left to
  get wrong, which lowers the risk without removing it.
- `isSidechain` filtering with real subagent activity. Now known to be
  *unreachable* rather than merely untested: subagent transcripts are written to
  `<sessionId>/subagents/agent-*.jsonl`, a directory this reader never opens, so
  the field is `false` on every record that reaches the filter. It stays as
  cheap insurance and is documented as inert.
- A same-size in-place rewrite of the transcript inside the filesystem's
  timestamp resolution. Measured here: 118 of 200 back-to-back rewrites share an
  mtime and 116 share `mtimeNs`, so no timestamp closes it and the only fix
  would be re-reading the file on every poll. Transcripts are append-only in
  practice; recorded in `reader.ts` rather than papered over.
