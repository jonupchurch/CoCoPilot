# The push schema

**Status:** draft, for review. **Written:** 2026-08-06.

The contract every ingest surface wraps. Decision 6 made the HTTP API the one
internal service and the MCP server and CLI thin adapters over it; this is the
payload that service accepts, and the thing that keeps three front doors from
drifting into three products.

Read [STATUS.md](../../STATUS.md) first — the decisions this follows from are
numbered there and referenced throughout.

## What a push is

One statement, from one agent, about what it is doing right now. Not an event
log and not a diff: each push replaces the previous state for that session. The
board holds the latest and nothing else, per decision 6.

Deliberately **not** in the payload:

| Not here | Why |
|---|---|
| Task status | Comes from `tasks.md`, checked or unchecked (decision 19). |
| Prompt, history, files in context | Comes from the transcript (decision 10). |
| Changed files, diff stats | Derived from git when the board updates. |
| Presentation, layout, emphasis | The board owns layout (decision 7). |
| Anything the board should do | Flow is one-way (decision 11). |

That leaves a small payload, which is the point. The more of the screen the
agent has to remember to describe, the less of it will be accurate.

## The payload

| Field | Type | Required | Notes |
|---|---|---|---|
| `repo` | absolute path | yes | Identifies the session and resolves the transcript directory by slug (decisions 13, 10). |
| `branch` | string | yes | Shown beside the repo in the title bar. |
| `sessionId` | string | yes | Distinguishes two agents in the same repo. See open point 1. |
| `feature` | string | no | The `specs/` directory name, e.g. `002-session-hook`. Absent means "whatever `.specify/feature.json` points at". |
| `task` | string | no | Normalised task ID, e.g. `T013`. Absent means working, but not on a numbered task. |
| `note` | string | no | Free text for the human. The only field the model composes (decision 7). |
| `chip` | enum | no | `idle` \| `watching` \| `thinking` \| `needs-you`. Defaults to `thinking` on a push that omits it. |

**Normalisation is ours, not the agent's.** The grounding found task IDs bare
(`T001`) and bold (`**T001**`) inside one repo, and checkbox case inconsistent
in the same file. The board normalises on read; `task` accepts either form and
is stored bare. An agent that copies an ID straight out of `tasks.md` is never
wrong.

**`chip` is the only way an agent asks for attention.** Under decisions 11 and
15 the board never escalates on its own and never sets a chip on a timer, so
`needs-you` is the entire mechanism. Worth stating plainly in the tool
description, because an agent that does not know this will sit blocked and
silent.

**`note` is unvalidatable by construction** and we accept that (decision 16 —
nothing is reconciled). Cap its length, store it as text, render it as text.
Never as markup: it is attacker-influenceable in the same sense any model output
is, and it lands in a desktop app.

## The second push: a note

Everything above **replaces**. A note **appends** — notes accumulate over a
session, which is the one place the board holds a growing list rather than a
latest value (decisions 20 and 21). It is therefore a separate call, not a
field on the status push, because the two have opposite semantics and folding
them together would make `note` mean different things on different calls.

```
POST http://127.0.0.1:<port>/v1/note
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `repo`, `branch`, `sessionId` | — | yes | Same session identity, same derivation. |
| `text` | string | yes | The note. Written either because the user asked for one or because the agent judged it worth recording. |

Exposed as `cocopilot_note` over MCP and `cocopilot note "…"` on the CLI.

Notes are volatile like everything else — they clear when the app closes
(decision 21). Anything worth keeping gets written into the repository by the
**agent**, with its own file tools, which is outside this API entirely. The tool
description should say so, or an agent will treat the board as storage.

Same plain-text handling as `note` above: length-capped, rendered as text, never
as markup.

## What the agent supplies versus what the surface fills in

Only `task`, `note`, `chip` and a note's `text` should ever come from the model.
Everything else the surface derives:

- **`repo`** — the MCP server's working directory; the CLI's `git rev-parse
  --show-toplevel`.
- **`branch`** — read from git at push time.
- **`sessionId`** — generated once per MCP server process, which matches the
  lifetime of a Claude Code session, since Claude Code spawns one server per
  session.
- **timestamp** — never sent. The board stamps on receipt, which is what
  decision 15's "last heard from 4m ago" counts from. A client-supplied clock
  would be one more thing that can be wrong.

This split matters more than it looks. Three fields is a thing an agent can get
right mid-task; seven is a form it will fill in badly.

## The three surfaces

All three resolve to one `POST` against the local service. Decision 18 binds it
to `127.0.0.1` only — no auth, no TLS.

```
POST http://127.0.0.1:<port>/v1/push
```

**MCP** — one tool, `cocopilot_report`, exposing `task`, `note`, `chip`. The
server starts cleanly whether or not the app is running and connects lazily per
call (decision 6), because Claude Code discovers an MCP tool list once, at
session start.

**CLI** — `cocopilot report --task T013 --note "…" --chip needs-you`, for hooks
and scripts. Same three fields, same derivation.

**HTTP** — the full payload, for anything that is neither.

## When the board is not running

Every surface fails the same way: the call errors, nothing is buffered, nothing
is spawned (decision 6). The message matters, because a monitoring tool that
derails the work it monitors is worse than no monitoring tool:

> CoCoPilot board is not running — continue working, no need to retry.

## Validation

Localhost is not a trust boundary — any local process can reach this API, so
every field is validated regardless of decision 18 (rule 2, `AGENTS.md`):

- `repo` must be an existing directory and a git working tree. A push naming a
  path that is not either is rejected, not rendered.
- `feature` and `task` are matched against what was actually parsed out of the
  repo. An unrecognised value is shown as unrecognised rather than silently
  creating a phantom row.
- `note` is length-capped and rendered as plain text, never as markup.
- `chip` is a closed enum; anything else is rejected.

The realistic abuse here is a local process putting misleading text on the
board, not code execution. Small blast radius, but small is not none.

## Open points

1. **`sessionId` when the agent is not Claude Code.** Generating it per MCP
   server process works because Claude Code spawns one per session. A CLI call
   from a hook has no such process to belong to. Either the CLI derives a
   stable id from the repo path and terminal, or hook-driven pushes join a
   single "unattributed" session per repo.
2. **A push naming a feature the board has not scanned.** Rescan on demand, or
   show the pushed identifier alone until a scan catches up. The second is
   cheaper and honest, and fits decision 12 — the AI caused the change, so the
   AI's word for it is what is on screen.
3. **Port discovery.** The MCP server has to find the app's port. A fixed port
   collides; a written port file is one more piece of state. Not yet decided.
