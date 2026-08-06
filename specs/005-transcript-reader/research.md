# Research: Transcript Reader

**Feature**: [005-transcript-reader](spec.md) | **Date**: 2026-08-06

The only feature that reads a file we do not own, in a format nobody documents.
So it gets the same treatment the Spec-Kit formats got: **verified against real
files**, not assumed from what the shape ought to be.

**Verified against** `C:\Users\<user>\.claude\projects\d--Codelib-skmc\*.jsonl`
— a real 384 KB session transcript, 143 records.

> Everything below is **empirical and unstable**. It describes what one version
> of one tool wrote on one day. Feature 005's whole design is that when this
> stops being true, three sections report unavailability and nothing else
> notices. Re-verify before implementing; do not trust this document as a spec.

---

## 1. Location and naming

Transcripts live at `~/.claude/projects/<slug>/<sessionId>.jsonl`.

The slug is the absolute project path, lowercased, with the drive colon and every
separator replaced by a hyphen:

```
d:\Codelib\skmc   →   d--Codelib-skmc
```

`d:` → `d-`, then `\` → `-`, giving the doubled hyphen. Case is preserved after
the drive letter.

**Consequence**: a reported `repo` resolves to a directory with no configuration
(FR-001), and the filename *is* the session identifier — so a session maps to
exactly one file with no scanning.

**Risk**: this rule is inferred from one platform's paths. Verify on macOS and
Linux before relying on it; a wrong slug means unavailability, which is the
designed failure rather than a crash.

---

## 2. Format

JSONL — one JSON object per line, each with a `type` discriminator.

Types observed, with counts from the sample:

| `type` | Count | Relevance |
|---|---|---|
| `assistant` | 64 | Carries `message.usage` — token accounting |
| `user` | 37 | **Not the same as prompts.** See finding 3 |
| `queue-operation` | 12 | Ignore |
| `last-prompt` | 10 | Convenience record holding `lastPrompt` |
| `ai-title` | 9 | Ignore |
| `attachment` | 9 | Ignore |
| `file-history-delta` | 8 | Ignore |
| `file-history-snapshot` | 4 | Ignore |

**Unknown types must be skipped, not treated as errors** (FR-012). This list will
grow; a reader that rejects what it does not recognise breaks on the next
release of someone else's software.

---

## 3. The trap: `type: "user"` is not "a prompt"

**The sample has 37 `user` records and roughly 10 actual human prompts.**

Most `user` records are **tool results** being fed back into the conversation.
Counting `user` records to build a prompt history would show a developer 37
entries, most of them tool output, presented as things they typed.

This is the direct analogue of the `- [x]` versus `- [X]` finding for Spec-Kit:
the obvious reading is wrong, and wrong quietly.

Two candidate discriminators were checked, and **only one works**:

| Field | Finding | Usable? |
|---|---|---|
| `promptSource` | 4 records `sdk`, 33 absent | **No** — does not separate prompts from tool results |
| `isSidechain` | all `false` in this sample | **Unproven** — no subagents ran; assume it exists and filter on it |
| `message.content` | **always an array**, never a string | **Yes** — inspect block types |

**Decision**: identify a human prompt by inspecting `message.content` blocks — a
prompt carries text blocks, a tool result carries `tool_result` blocks. Never by
record type alone.

**Also filter `isSidechain === true`.** The sample contains none because no
subagents ran, but subagent turns land in the same file. Unfiltered, a developer
would see an agent's internal delegation presented as their own instructions.
Untested here, and flagged for verification against a transcript with subagent
activity.

---

## 4. Fields that matter

**`user` records** carry: `message`, `timestamp`, `uuid`, `parentUuid`,
`sessionId`, `cwd`, `gitBranch`, `version`, `isSidechain`, `promptSource`,
`userType`, `entrypoint`, `permissionMode`.

`cwd` was `d:\Codelib\skmc` — the repository path is recoverable from the
transcript itself, independent of what an agent reported. **We do not use it.**
Feature 001 already has the path, and cross-checking would be reconciliation,
which decision 16 declines.

**`assistant` records** carry `message.usage` with `input_tokens`,
`output_tokens`, `cache_read_input_tokens` and `cache_creation_input_tokens`.

So token accounting is genuinely available — the design's "12.4k" figure has a
real source. Note the nesting is deep and includes an `iterations` array; read
defensively and treat any missing field as unavailable rather than zero.

`last-prompt` records hold `lastPrompt` directly. Tempting as a shortcut for
FR-003, but it is a convenience record whose semantics are unclear (10 records
for ~10 prompts is suggestive, not proof). **Derive the latest prompt from the
prompt list instead** — one code path, one set of assumptions.

---

## 5. Reading strategy

**Decision**: read the file, parse line by line, skip anything that fails; watch
for growth and read only the appended region.

**Rationale**: FR-013 requires a large transcript not to block the window, and
SC-007 sets 100 MB as the bar. Re-reading from the start on every change would
be quadratic over a session.

**Partial trailing lines are expected, not exceptional** — the file is being
appended to while it is read. A trailing fragment is buffered and retried on the
next read, never reported as corruption (US4 scenario 4).

**Reading happens in the Electron main process**, off the UI thread, feeding the
store like any other source.

---

## 6. Why this stays narrow

Three display sections consume this and nothing else does. That is the entire
justification for depending on an undocumented format, and it is a property to
protect actively: transcript-derived data must not flow into task state, session
identity, or anything an agent reported (FR-015).

The failure this buys: when the format changes, three sections say unavailable
and the board keeps working.

---

## Resolved

| Unknown | Resolution |
|---|---|
| Location | `~/.claude/projects/<slug>/<sessionId>.jsonl`, slug rule above |
| Format | JSONL, `type`-discriminated, unknown types skipped |
| Prompt identification | `message.content` block inspection — **not** record type |
| Subagent turns | Filter `isSidechain` — unverified, must be tested |
| Token counts | `assistant.message.usage`, read defensively |
| Large files | Incremental append-only reads, in the main process |

## Still open

- **Verify the slug rule on macOS and Linux.** Windows only, so far.
- **Verify `isSidechain` filtering** against a transcript containing subagent
  activity. The sample had none.
- **How many prompts to list before summarising** — a display choice for the
  view, not a reading concern.
