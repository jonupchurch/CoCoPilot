# Implementation Plan: Transcript Reader

**Branch**: `005-transcript-reader` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-transcript-reader/spec.md`

## Summary

Reads the AI tool's own session transcript to feed three Overview sections that
no agent can honestly report: last prompt, prompt history, and files in context.

Approach: a reader in the Electron main process that resolves a transcript from
the reported repository path, tails it incrementally, classifies records
defensively, and publishes into the store beside — never into — agent-reported
state. Every failure degrades to "unavailable" for exactly three sections.

## Technical Context

Inherits [001/research.md](../001-push-contract-service/research.md). The
format is documented empirically in [research.md](research.md), verified against
a real 384 KB transcript.

**Primary Dependencies**: `node:fs` only. No parser library — JSONL is
line-splitting plus `JSON.parse`, and each line must fail independently anyway.

**Constraints**: Read-only; main process; never blocks the UI; 100 MB
transcripts stay responsive; failures never escape the three sections.

## Constitution Check

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Four stories, no clarification markers; graceful degradation is a P1 story |
| II. Validated trust boundaries | **Pass** | Every record treated as untrusted; unknown types skipped; text rendered inert |
| III. Match existing conventions | **Pass** | Follows the repo's own grounding method — verify against real files, record the traps |
| IV. Scope discipline | **Pass** | Reads one session's transcript, feeds three sections, reconciles nothing |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md), including corrupted and truncated inputs |
| VI. Narrate the reasoning | **Pass** | research.md records what was verified, what was inferred, and what is untested |
| VII. Plan whole set first | **Pass** | Plan 5 of 9 |
| VIII. Test at the right level | **Pass** | Unit against fixture transcripts including malformed ones — the risk is entirely in classification and failure handling |
| IX. Atomic commits, branch | **Deferred** | As 001 |

**No violations.**

## Project Structure

```text
apps/board/src/main/transcript/
├── locate.ts        # repo path → slug → directory → session file
├── reader.ts        # incremental tail; partial trailing lines buffered
├── classify.ts      # record → prompt | context | ignore. The trap lives here
├── availability.ts  # available | empty | unreadable, per section
└── index.ts

apps/board/tests/unit/transcript/
├── locate.test.ts
├── classify.test.ts          # the 37-vs-10 case, explicitly
├── reader.test.ts            # growth, partial lines, huge files
└── degradation.test.ts       # missing, corrupt, permission-denied, unknown types

apps/board/tests/fixtures/transcripts/
├── typical.jsonl             # trimmed from a real transcript
├── tool-results.jsonl        # mostly user records that are NOT prompts
├── truncated.jsonl           # ends mid-record
├── unknown-types.jsonl       # types this version has never seen
└── garbage.jsonl             # not JSONL at all
```

**Structure Decision**: `classify.ts` is deliberately its own module with its
own tests, because it holds the one finding most likely to be got wrong — that
`type: "user"` is not "a prompt". Isolating it means the trap is tested directly
rather than incidentally through a rendering test.

## Design notes

**A prompt is identified by content, never by record type.** The sample had 37
`user` records and about 10 real prompts; the rest were tool results. Counting
record types would present tool output to a developer as things they typed.
`classify.ts` inspects `message.content` blocks. `promptSource` was evaluated
and rejected — it does not separate the two.

**Subagent turns are filtered on `isSidechain`, and this is untested.** The
sample contained none because no subagents ran. Flagged in research.md as
requiring verification, because unfiltered it would show an agent's internal
delegation as the developer's own instructions.

**Unknown record types are skipped silently.** Eight types were observed and the
list will grow. A reader that errors on the unfamiliar breaks whenever someone
else ships a release.

**Availability is three-valued, and this is the point.** `available`, `empty`,
`unreadable` — never collapsing the third into the second. A section showing
zero files because it could not parse anything, rendered identically to one
showing zero because there are none, misleads silently. Feature 004's sections
consume this state, not a bare array.

**Incremental reads, never re-reading from the start.** A trailing partial line
is buffered and retried, treated as expected rather than as corruption — the
file is being written while we read it.

**`cwd` is present in the transcript and deliberately unused.** It would let us
cross-check the reported repository path, which is reconciliation, which
decision 16 declines. Recording that it was noticed and rejected, so it does not
get "discovered" later as an improvement.

**Nothing transcript-derived may touch reported state.** FR-015. The store keeps
it in a separate branch; a task's status can never be influenced by a transcript,
however tempting the extra signal.

## Post-design Constitution re-check

Still passing, and principle V is worth restating. Most features test that
something works; this one mostly tests that failure is contained. The fixture
set exists so that "the format changed" is a case with expected behaviour rather
than an incident — and `degradation.test.ts` is the test whose absence would let
a bad transcript take down a working board.
