# The push schema

**Status:** draft, for review. **Written:** 2026-08-06, rewritten the same day
for decisions 24–26.

The contract every ingest surface wraps. Decision 6 made the HTTP API the one
internal service and the MCP server and CLI thin adapters over it; this is the
payload that service accepts, and the thing that keeps three front doors from
drifting into three products.

Read [STATUS.md](../../STATUS.md) first — the decisions this follows from are
numbered there and referenced throughout.

## What a push is

**The complete state of one session, replacing whatever the board held for it**
(decision 26). Not a delta and not an event. The agent sends the whole picture
each time it reports.

That is the direct consequence of decision 24: the app never opens a file in the
user's repository. No `tasks.md` parsing, no `specs/` walk, no
`.specify/feature.json`, no git. If it is on screen, it arrived in a push — or,
for the three activity sections, from the Claude Code transcript (decision 10).

Snapshot semantics are what make this safe. A dropped, duplicated or
out-of-order push costs nothing, because the next one is authoritative. Under
decision 24 that matters more than it usually would: there is no repo read left
to correct a board that has drifted.

Still deliberately **not** in the payload:

| Not here | Why |
|---|---|
| Prompt, history, files in context | Comes from the transcript (decision 10). |
| Presentation, layout, emphasis | The board owns layout (decision 7). |
| Anything the board should do | Flow is one-way (decision 11). |
| Notes | They append rather than replace. Separate call, below. |

## The envelope

Identity, and none of it composed by the model:

| Field | Type | Required | Notes |
|---|---|---|---|
| `repo` | absolute path | yes | Identifies the session and resolves the transcript directory by slug (decisions 13, 10). |
| `branch` | string | yes | Shown beside the repo in the title bar. |
| `sessionId` | string | no | One per MCP server process. **Omitting it is the supported case, not an error:** pushes with no such process behind them share one *unattributed* session per repo, labelled as a script or hook (decision 23). |
| `transcriptId` | string | no | The AI tool's *own* session id, which is **not** `sessionId` — it names a transcript file, read from `CLAUDE_CODE_SESSION_ID`. Without it the board cannot tell which transcript belongs to the session it is showing (decision 32, feature 005's FR-016). An agent that is not Claude Code omits it and the board falls back to the most recently modified transcript in the repository's directory. |

The board stamps receipt time itself. No client clock is ever trusted — the
"heard 40s ago" display (decision 15) counts from arrival.

## The body

Everything the board renders. All of it optional: a push may carry only what the
agent knows, and the board shows what it has.

| Key | Shape | Notes |
|---|---|---|
| `feature` | `{ id, title, specPath? }` | The feature the session is working. |
| `stories` | array of `{ id, title, priority?, status?, asA?, want?, soThat?, criteria[], taskIds[], files[] }` | Drives the User Stories tab. |
| `tasks` | array of `{ id, storyId?, title, status, detail?, checks[], files[] }` | Drives the Tasks tab and the Overview spec section. |
| `plan` | **array** of `{ text, status, detail? }` | The Plan section. A flat array, *not* an object with a `steps` key — see the note below. |
| `focus` | `{ task?, note?, chip? }` | What is happening right now. |
| `changedFiles` | array of `{ path, change, added?, removed?, note? }` | The Changed files section. Pushed rather than read from git, since we do not read the repo. Lowest-priority section (decision 12). |

> **`packages/contract/src/schema.ts` is authoritative; this document
> describes it.** Four corrections on 2026-08-08, all found by writing a client
> against the prose and watching the service reject it: `plan` is a flat array
> and was documented as `{ steps: [...] }`; `stories[].files` was missing;
> `sessionId` was marked required and is optional; `transcriptId` was absent
> entirely, having arrived with feature 005 after this was written.
>
> Only the first was load-bearing — the service answered
> `400 invalid_field / plan / Expected array, received object`, which is a good
> error and cost a minute. The other three are the quieter kind: prose that
> would have had a client send a field that does not exist, or omit one that
> does, without any error to correct it. A payload contract that drifts from
> its schema is worse than no document, because it is believed.

### `status` is a free string

On a task, a story or a plan step, `status` is whatever text the agent chooses
(decision 25). The board maps recognised values — `todo`, `active`, `blocked`,
`done` and obvious synonyms — onto the round 1 colours, and renders anything
else in neutral grey with the text shown as-is. An arbitrary string cannot
honestly be assigned a signal colour when teal, blue and ember each mean
something specific.

**The recognised set, in full** (feature 004,
`apps/board/src/renderer/src/lib/vocabulary.ts`):

| Renders as | Terms |
|---|---|
| done — teal ✓ | `done`, `complete`, `completed`, `finished` |
| active — blue ring | `active`, `in progress`, `in-progress`, `wip`, `doing`, `working`, `started` |
| blocked — ember | `blocked`, `blocker`, `stuck` |
| todo — grey outline | `todo`, `to do`, `to-do`, `pending`, `not started`, `queued` |

Matching ignores case and surrounding whitespace, and **nothing else**. No
prefix matching, no stemming, no edit distance: `donee` renders neutral, not
done. Anything unrecognised is shown in grey with its text intact and no disc at
all — an outline circle would say "not started", which is a claim about a string
the board cannot read.

Sending a status outside this list is fine and always will be. The text is
displayed exactly as sent, including for recognised terms — an agent that writes
`wip` sees `wip`, coloured as active, never rewritten to `active`.

### `changedFiles[].note` is how a file asks for attention

A changed file carrying a `note` is rendered as flagged: the row takes a raised
fill and the note text appears in ember in place of the line counts. So the note
is *why this file wants your eye* — `conflict`, `regenerated, check the diff` —
not a description of the change, which is what `change` is for.

Absent a note, a file is an ordinary change. The board does not infer attention
from the size of a diff or from anything else; the agent flags it or nobody
does.

### `focus` is not a status

Which task is being worked on is tracked separately from what state that task is
in. This split came out of design round 2 and it is load-bearing: with
open-ended status strings there is no state the board can reliably read
"currently active" out of, so `focus.task` carries it explicitly. The board
renders it as the teal left rule and `now` tag.

`focus.chip` is one of `idle`, `watching`, `thinking`, `needs-you`. **This is
the entire mechanism by which an agent asks for attention** — decisions 11 and
15 mean the board never escalates on its own and never sets a chip on a timer.
Say so in the tool description, or an agent will sit blocked and silent.

### Normalising is the agent's job now

Decision 24 removed our parser, so the Spec-Kit format traps in STATUS.md move
to the agent side. Whatever tool reads `tasks.md` must handle `- [x]` and
`- [X]`, bare `T001` and bold `**T001**`, tasks nesting under `###`, and
hand-drifted headers. What arrives here should already be normalised. The board
does not second-guess it (decision 16).

## The second call: a note

Notes **append** where everything else replaces — the one exception, and the
reason it cannot be a field on the snapshot. Folding it in would force the agent
to resend every note it had ever written in order to add one.

```
POST http://127.0.0.1:<port>/v1/note
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `repo`, `branch`, `sessionId` | — | yes | Same envelope. |
| `text` | string | yes | The note itself. |
| `source` | string | no | Why it exists, in the agent's voice — "you asked", "noticed while editing". Round 2 renders this. |

Notes are volatile like everything else and clear when the app closes
(decision 21). Anything worth keeping is written into the repository **by the
agent**, with its own file tools, which is outside this API entirely. The tool
description should say so, or an agent will treat the board as storage.

## What the model composes versus what the surface derives

Only content comes from the model — `focus`, and the titles, statuses, criteria
and note text inside the body. The envelope is always derived:

- **`repo`** — the MCP server's working directory; the CLI's `git rev-parse
  --show-toplevel`.
- **`branch`** — read from git at push time by the surface.
- **`sessionId`** — generated once per MCP server process, matching the lifetime
  of a Claude Code session.
- **timestamp** — never sent; stamped on receipt.

## The three surfaces

All resolve to one `POST` against the local service, bound to `127.0.0.1` only
with no auth and no TLS (decision 18).

```
POST http://127.0.0.1:<port>/v1/push
POST http://127.0.0.1:<port>/v1/note
GET  http://127.0.0.1:<port>/v1/health   → { "app": "cocoapilot", "version": "…" }
```

**MCP** — `cocoapilot_report` and `cocoapilot_note`. The server starts cleanly
whether or not the app is running and connects lazily per call (decision 6),
because Claude Code discovers an MCP tool list once, at session start.

**CLI** — `cocoapilot report` and `cocoapilot note "…"`, for hooks and scripts.

**HTTP** — the full payload, for anything that is neither.

## Finding the port

The app claims a fixed port and walks up a short documented range if it is
taken. Clients try the same sequence and use the first that identifies itself
via `/v1/health`. Nothing is written to disk, keeping this consistent with
decision 21.

**Match on the payload, never on the connection succeeding.** Probing a range
means knocking on ports owned by unrelated local software, and a client that
treats any 200 as success will POST prompt text and file paths into some other
program.

Nothing in the range answering means the board is not running — already handled.

## When the board is not running

Every surface fails the same way: the call errors, nothing is buffered, nothing
is spawned (decision 6). The message matters, because a monitoring tool that
derails the work it monitors is worse than no monitoring tool:

> CoCoapilot board is not running — continue working, no need to retry.

## Validation

Localhost is not a trust boundary — any local process can reach this API, so
every field is validated regardless of decision 18 (rule 2, `AGENTS.md`):

- `repo` must be an existing directory. This is a path check, not a repo read —
  we never open anything inside it.
- `sessionId` and `branch` are length-capped opaque strings.
- All free text — statuses, titles, notes, prose — is length-capped, capped in
  count per collection, and rendered as **plain text, never markup**. It is
  model-composed and lands in a desktop app.
- Unknown keys are ignored rather than rejected, so an agent running a newer
  tool against an older board degrades instead of failing.

There is nothing to validate task and story identifiers *against* any more —
decision 24 removed the parsed repo they used to be checked against. Whatever
the agent sends is what the board shows.

The realistic abuse is a local process putting misleading text on the board, not
code execution. Small blast radius, but small is not none.

## Costs carried

- **The board is only as correct as the agent.** No independent source remains
  to catch a stale or wrong push, by construction (decisions 16, 24).
- **Every launch starts empty**, because nothing is re-derivable from disk. The
  empty state is a routine screen, not a first-run one.
- **The snapshot is expensive for the agent**, which must hold or rebuild the
  whole picture to resend it. The agent-side tool should be efficient about
  reconstructing it, and this is the main argument to revisit deltas later.
