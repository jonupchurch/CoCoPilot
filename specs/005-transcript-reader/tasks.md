# Tasks: Transcript Reader

**Input**: Design documents from `specs/005-transcript-reader/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md),
[**research.md**](research.md) — read that one first, and read it in full.

Features 001–004 are merged. The store, the projection in
`apps/board/src/main/view.ts`, the `Section` component and the Overview tab all
exist; this feature adds a fourth source and three more sections above the ones
feature 004 built.

**Tests**: Included, and weighted differently from every other feature. Most
features test that something works. This one mostly tests that **failure is
contained** — the fixture set exists so that "the format changed" is a case with
expected behaviour rather than an incident.

## Format: `[ID] [P?] [Story] Description`

---

## What re-verification changed

`research.md` was re-checked against an 11 MB / 3,757-record transcript and all
16 project slugs on this machine before any code was written. **Four of its
claims were wrong**, and each one would have produced a plausible, quiet defect:

| Claim | Reality | What it would have cost |
|---|---|---|
| Slug = drive colon + separators replaced | Every non-alphanumeric character → `-` (`D&D`→`D-D`, `t@nk.r`→`t-nk-r`) | Unavailability for any repo with punctuation in its name |
| `message.content` is always an array | 10 of 1,129 `user` records carry a plain string | Silently dropped prompts |
| Text blocks identify a prompt | 17 of 74 text-only records are still not prompts | Skill payloads and interrupt markers shown as things the developer typed |
| Subagent turns land in the same file, filter `isSidechain` | Never `true`; subagent transcripts live in `<sessionId>/subagents/` | A guard everyone believes is working, doing nothing |

Two further findings, both load-bearing:

- **`last-prompt` is not one-per-prompt** — 217 records against 57 prompts. The
  first sample's 10-for-10 was a short-session coincidence. Using it as the
  shortcut for FR-003 would have overstated history nearly fourfold.
- **A ninth record type (`system`) appeared between two samples a day apart.**
  That is the argument for skipping unknown types, in a single observation.

## The one contract change, named rather than folded in

The board's `sessionId` is a `randomUUID()` from the MCP client process. A
transcript's filename is **Claude Code's** session id. They are unrelated — so
the board cannot identify "the transcript for the session being shown" from what
it currently holds, and FR-016 cannot be honestly met.

`CLAUDE_CODE_SESSION_ID` is exported into launched processes and matches the
filename exactly. So `packages/contract` gains **one optional envelope field**
and `packages/clients` populates it from that variable — derived, never
model-composed, exactly like `repo` and `branch`.

This reaches into features 001 and 002. It is in scope because FR-016 depends on
it, and it is small; it is called out here so it is a decision rather than a
surprise in the diff.

## Three rules for this feature

**A prompt is text-only content that is also none of four wrapper shapes.**
Block inspection alone leaves skill instruction payloads, local-command echoes,
interrupt markers and command invocations in the list. Each gets its own named
test case, because each was found in real data rather than imagined.

**Unreadable is never rendered as empty.** Three-valued availability, all the way
from `reader.ts` to the section. A section showing nothing because it could not
parse, drawn identically to one showing nothing because there is nothing,
misleads silently — and SC-006 exists to forbid exactly that.

**Nothing transcript-derived may touch reported state.** FR-015. It lives in its
own branch of the store and its own branch of the projection, and no task
status, chip or count may ever be influenced by it.

## Path conventions

```text
apps/board/src/main/transcript/     # locate, read, classify, availability
apps/board/tests/fixtures/transcripts/
apps/board/tests/unit/transcript/
apps/board/src/renderer/src/views/overview/   # three more sections
```

---

## Phase 1: Foundational

**Purpose**: The reader, end to end, before any of it is rendered. Every module
here is pure or filesystem-only and testable without a window.

- [x] T001 Add an optional `transcriptId` to `Envelope` in `packages/contract/src/schema.ts`, capped as a `Label` and defaulting to null, with a comment stating it is derived from `CLAUDE_CODE_SESSION_ID` and never model-composed
- [x] T002 Populate it in `packages/clients/src/identity.ts` from `process.env.CLAUDE_CODE_SESSION_ID`, returning null when absent, and send it from both surfaces in `packages/clients/src/client.ts`
- [x] T003 [P] Extend `packages/clients/tests/` to cover the field present, absent and empty — an agent that is not Claude Code must still report successfully
- [x] T004 Create `apps/board/src/main/transcript/locate.ts` — the slug rule (**every non-alphanumeric character becomes `-`**, case preserved), the projects directory, exact selection by `transcriptId`, and newest-`.jsonl` fallback. Regular files ending `.jsonl` at the top level only: the `<sessionId>/` directory beside them holds subagent transcripts and FR-016 forbids reading them
- [x] T005 [P] Write `apps/board/tests/unit/transcript/locate.test.ts` — the four awkward real paths from research (`D&D`, `fitt.d`, `t@nk.r`, `playm8z`), a POSIX-shaped path, a directory that would be chosen if entries were not filtered to files, and a missing directory resolving to unavailable rather than throwing
- [x] T006 Create `apps/board/src/main/transcript/availability.ts` — `available | empty | unreadable` as a discriminated union carrying the value only in the first case, so a caller cannot read a list out of an unreadable section by accident
- [x] T007 Create `apps/board/src/main/transcript/classify.ts` — record to `prompt | context | ignore`. Accepts `message.content` as **string or array**; requires text-only content; then rejects the four wrapper shapes. Filters `isSidechain === true` with a comment recording that it is currently inert and why it stays
- [x] T008 [P] Build the fixture set in `apps/board/tests/fixtures/transcripts/` — `typical.jsonl`, `tool-results.jsonl`, `wrappers.jsonl` (one record per wrapper shape), `string-content.jsonl`, `truncated.jsonl`, `unknown-types.jsonl`, `garbage.jsonl`. Trimmed from real records, with any absolute paths rewritten
- [x] T009 [P] Write `apps/board/tests/unit/transcript/classify.test.ts` — the counting trap stated as a number, and each wrapper shape named individually: a skill instruction payload, a `<local-command-caveat>`, a `[Request interrupted` marker and a `<command-name>` block are each **not** a prompt, while a string-content record **is**
- [x] T010 Create `apps/board/src/main/transcript/reader.ts` — read once, then read only the appended region on growth. A trailing partial line is buffered and retried, never reported as corruption. Every failure returns `unreadable`; nothing throws out of this module
- [x] T011 [P] Write `apps/board/tests/unit/transcript/reader.test.ts` — growth between reads appends without re-reading; a line split across two reads is recovered whole; a file that shrinks or is replaced is handled; a synthetic large file stays within a time bound
- [x] T012 Create `apps/board/src/main/transcript/index.ts` — watch the located file, publish into the store on change, and hold every failure inside this module

**Checkpoint**: The reader works and is proven against real-shaped fixtures, with
no UI involved.

---

## Phase 2: User Story 1 — See what the agent was actually asked (Priority: P1) 🎯 MVP

**Goal**: The instruction the agent is working from, in full, without leaving
the board.

**Covers**: FR-001, FR-003, FR-009, FR-010, FR-014; SC-001

**Independent test**: With a session in progress, the view shows the most recent
prompt, matching what was typed; a new prompt appears with no developer action.

- [x] T013 [US1] Hold transcript state in `apps/board/src/main/store.ts` as its own branch of the session — never inside `report`, and with no code path that lets it reach one (FR-015)
- [x] T014 [US1] Project it in `apps/board/src/main/view.ts` as a separate `transcript` field carrying availability per section, listed explicitly like every other projected field
- [x] T015 [US1] Create `apps/board/src/renderer/src/views/overview/LastPromptSection.tsx` and its CSS — the card at the top of the Overview stack, per the export's "Last prompt" block, with the prompt as written and its full text retrievable
- [x] T016 [US1] Derive the latest prompt from the prompt list, **not** from `last-prompt` records — 217 of those against 57 prompts settles it
- [x] T017 [P] [US1] Write `apps/board/tests/e2e/transcript.spec.ts` — a fixture transcript renders its most recent prompt; appending a prompt updates the view with no interaction; a long prompt stays legible with its full text retrievable

---

## Phase 3: User Story 4 — Nothing breaks when the transcript is not what we expect (Priority: P1)

**Goal**: The property that makes depending on an undocumented, externally-owned
format acceptable at all.

**Covers**: FR-002, FR-011, FR-012, FR-016; SC-003, SC-004, SC-005, SC-006

**Independent test**: For each hostile fixture, the transcript sections report
unavailability while the task list, plan, focus, notes and title bar all keep
working.

- [x] T018 [US4] Write `apps/board/tests/unit/transcript/degradation.test.ts` — missing file, `garbage.jsonl`, `truncated.jsonl`, `unknown-types.jsonl`, a permission error and a directory where a file was expected each yield `unreadable`, and none of them throws
- [x] T019 [US4] Write `apps/board/tests/integration/transcript-containment.test.ts` — the absence test for SC-004 and SC-005: spy `node:fs` across a full read cycle and assert **zero** writes anywhere and **zero** reads outside the one located transcript, including no read of the sibling `subagents/` directory
- [x] T020 [P] [US4] Extend `apps/board/tests/e2e/transcript.spec.ts` — with a garbage transcript, the three sections say unavailable **and** the Overview sections from feature 004 render normally. This is the blast-radius test; it is the reason the dependency is acceptable
- [x] T021 [US4] Make unavailable visibly distinct from empty in the renderer, and assert it (SC-006) — a section that could not read its source must never be drawn as one with nothing to show

**Checkpoint**: A bad transcript cannot take down a working board, proven rather
than asserted.

---

## Phase 4: User Story 2 — Look back over earlier prompts (Priority: P2)

**Goal**: Find the instruction that produced the current state, open it, reuse
it.

**Covers**: FR-004, FR-005, FR-006, FR-007; SC-002, SC-008

**Independent test**: Several prompts list newest first with relative times; one
expands in place; copying puts exactly that text on the clipboard.

- [x] T022 [US2] Create `apps/board/src/renderer/src/views/overview/HistorySection.tsx` and its CSS — newest first, relative times, a row expanding in place, and the total count stated when more exist than are listed
- [x] T023 [US2] Add copy-to-clipboard with a brief self-confirmation, copying the stored text exactly — no trimming, no normalising, no re-wrapping (SC-002)
- [x] T024 [P] [US2] Extend `apps/board/tests/e2e/transcript.spec.ts` — order and relative times; expansion shows untruncated text; a copied prompt matches character for character including newlines; the count appears only when the list is short of the total
- [x] T025 [US2] Decide and document the list length — a display choice research left open. State the number and why in the component, since "Show all 18" having no destination is a known open item from design round 2

---

## Phase 5: User Story 3 — See what the agent is holding in context (Priority: P3)

**Goal**: "Does it even know about the file I care about?" answered without an
interruption.

**Covers**: FR-008

**Independent test**: Files in context are listed and one being actively read is
distinguishable; collapsed, the header still summarises.

- [x] T026 [US3] Extend `classify.ts` to recognise context entries, reading `assistant.message.usage` and the `attachment` records defensively — every missing field is *unavailable*, never zero
- [x] T027 [US3] Create `apps/board/src/renderer/src/views/overview/ContextSection.tsx` and its CSS — files listed, one actively read distinguished, an aggregate in the header, and "unavailable" when the transcript carries no context information rather than showing zero files as though that were the answer
- [x] T028 [P] [US3] Extend `apps/board/tests/e2e/transcript.spec.ts` for the three cases above

---

## Phase 6: Polish

- [x] T029 [P] Extend `apps/board/tests/e2e/only-reported.spec.ts` or add a sibling — transcript text containing `<script>` renders as visible characters (SC-009), and transcript content never alters a task status, chip or count (FR-015)
- [x] T030 Walk the `stacks/vite-react.md` and `stacks/electron.md` checklists, and confirm the reader never runs on the renderer side
- [x] T031 Run `npm run typecheck`, the full suite, the Playwright suite and a build, then walk the eight scenarios in [quickstart.md](quickstart.md)
- [x] T032 [P] Update `CHANGELOG.md`, `STATUS.md`, and `docs/design/architecture.md` where it describes what the board reads
- [ ] T033 Read back the full diff, then merge

---

## Dependencies

Foundational → US1 → US4 → US2 → US3 → Polish.

US4 sits second despite being written last in the spec, because it is P1 and
because containment is cheapest to prove while there is one section to contain
rather than three. Its *mechanism* — `availability.ts` and a reader that never
throws — is built in Foundational; its phase is the proof.

T001 blocks T004 (exact file selection needs the field). T007 blocks T009 and
T026. Everything else marked `[P]` is genuinely independent.

## What is deliberately not here

Reconciling transcript content against agent reports — `cwd` is right there in
every record and is deliberately unused, because cross-checking is
reconciliation and decision 16 declines it. Reading any other session's
transcript. Reading the `subagents/` directory. Filtering or redacting prompt
content: a prompt containing a secret is shown, because a board that silently
withholds what was actually said is worse, and that exposure is why the service
binds to localhost only.

Also not here: making `isSidechain` do something. It is filtered, it is
currently inert, and the comment says so — a test that faked subagent records to
prove the filter works would be testing the fixture, not the tool.
