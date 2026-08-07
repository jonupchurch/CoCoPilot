# Research: Transcript Reader

**Feature**: [005-transcript-reader](spec.md) | **Date**: 2026-08-06

The only feature that reads a file we do not own, in a format nobody documents.
So it gets the same treatment the Spec-Kit formats got: **verified against real
files**, not assumed from what the shape ought to be.

**Verified against** `C:\Users\<user>\.claude\projects\d--Codelib-skmc\*.jsonl`
— a real 384 KB session transcript, 143 records.

**Re-verified 2026-08-07**, before implementing, against an 11 MB / 3,757-record
transcript and all 16 project slugs on this machine. Four claims below were
**wrong** and are corrected in place, each marked ⚠️. This is why the document
says re-verify rather than trust.

> Everything below is **empirical and unstable**. It describes what one version
> of one tool wrote on one day. Feature 005's whole design is that when this
> stops being true, three sections report unavailability and nothing else
> notices. Re-verify before implementing; do not trust this document as a spec.

---

## 1. Location and naming

Transcripts live at `~/.claude/projects/<slug>/<sessionId>.jsonl`.

⚠️ **Corrected.** The rule is not about drive letters and separators. **Every
character that is not `[A-Za-z0-9]` becomes a hyphen.** Case is preserved
throughout — including the drive letter, which is simply left as typed.

```
d:\Codelib\skmc        →   d--Codelib-skmc
d:\Codelib\CoCoPilot   →   d--Codelib-CoCoPilot
```

The doubled hyphen is just `:` and `\` each mapping to `-`. Verified against all
16 slugs on this machine, three of which settle it beyond the separator reading:

| Real path | Slug |
|---|---|
| `d:\Codelib\D&D` | `d--Codelib-D-D` |
| `d:\Codelib\fitt.d` | `d--Codelib-fitt-d` |
| `d:\Codelib\t@nk.r` | `d--Codelib-t-nk-r` |
| `d:\Codelib\playm8z` | `d--Codelib-playm8z` |

`&`, `.` and `@` are none of them separators, and all three become hyphens.
Digits survive.

**Consequence**: a reported `repo` resolves to a directory with no configuration
(FR-001), and the filename *is* the session identifier — so a session maps to
exactly one file with no scanning.

**The macOS/Linux risk is smaller than it looked**, because the corrected rule
has no Windows-specific component left: `/home/u/proj` → `-home-u-proj` falls
out of the same substitution. Still not verified on those platforms
empirically — but there is no longer a drive-letter special case to get wrong,
and a wrong slug means unavailability, which is the designed failure.

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

⚠️ **The list already grew.** The 2026-08-07 transcript contains a ninth type,
`system` (compaction metadata), that did not exist in the first sample. Counts
there, for scale: `assistant` 1702, `user` 1128, `last-prompt` 217, `ai-title`
217, `attachment` 190, `file-history-delta` 182, `queue-operation` 88,
`file-history-snapshot` 31, `system` 2.

**Unknown types must be skipped, not treated as errors** (FR-012). This list will
grow; a reader that rejects what it does not recognise breaks on the next
release of someone else's software. It grew between two samples a day apart,
which is the whole argument in one observation.

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

⚠️ **`message.content` is not always an array.** In the 2026-08-07 sample, 10 of
1,129 `user` records carry `content` as a plain **string**. The classifier must
accept both shapes; treating a string as unparseable would silently drop real
prompts.

⚠️ **Block inspection is necessary and not sufficient.** Filtering `user`
records down to text-only content leaves 74 records, of which **17 are still not
prompts**:

| Count | What it is |
|---|---|
| 57 | An actual human prompt |
| 9 | A skill instruction payload — begins `Base directory for this skill:`, or contains `(Re-invocation of` |
| 4 | A local-command echo — `<local-command-caveat>` or `<local-command-stdout>` |
| 2 | An interrupt marker — `[Request interrupted…` |
| 2 | A command invocation — `<command-name>` / `<command-message>` |

**57 real prompts out of 1,134 `user` records.** The original finding said the
obvious reading is wrong; the correction is that the *second* reading is wrong
too. A prompt is a text-only `user` record that is **also** not one of the four
wrapper shapes above, and each of those needs its own named test case.

⚠️ **`isSidechain: true` never appears — including when subagents do run.** The
2026-08-07 session ran several subagents, and all 3,022 records carrying the
field are `false`. Subagent transcripts are written elsewhere (a per-task file
under the session's temp directory), **not** into the project transcript. So the
plan's statement that "subagent turns land in the same file" is false for this
version.

Keep the filter regardless: it costs one comparison, it is correct if the
behaviour returns, and unfiltered it would show an agent's internal delegation
as the developer's own instructions. But it is currently **inert**, and a test
asserting it filters anything would be testing a fixture rather than reality.

**No `<system-reminder>` text is persisted inside a stored prompt.** Injected
context appears at request time and not in the record, so a stored prompt is
exactly what the developer typed — which is what makes SC-002's character-for-
character copy achievable.

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

⚠️ **Now proven not to be one-per-prompt.** The 2026-08-07 sample holds **217
`last-prompt` records against 57 real prompts**. The first sample's 10-for-10
was a coincidence of a short session. Using it as a shortcut would have
overstated the history nearly fourfold — the existing decision was right, and
this is the evidence it lacked.

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
| Location | `~/.claude/projects/<slug>/<sessionId>.jsonl`; slug = every non-alphanumeric character replaced by `-` |
| Format | JSONL, `type`-discriminated, unknown types skipped (9 types seen, and counting) |
| Prompt identification | Text-only `message.content` — accepting **string or array** — *and* none of the four wrapper shapes |
| Subagent turns | Filter `isSidechain`, but it is inert: subagent transcripts are written elsewhere |
| Token counts | `assistant.message.usage`, read defensively |
| Large files | Incremental append-only reads, in the main process |

## Still open

- **Verify the slug rule on macOS and Linux.** Windows only, so far — though the
  corrected rule no longer has a platform-specific clause to get wrong.
- **How many prompts to list before summarising** — a display choice for the
  view, not a reading concern.

## Closed since the first pass

- ~~Verify `isSidechain` filtering against a transcript with subagent
  activity.~~ Done: subagent activity does not reach this file at all. The
  filter stays as cheap insurance and is documented as inert.
