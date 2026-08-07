# Contract: Client Surface

**Feature**: [002-mcp-server-cli](../spec.md)

What an agent or a script sees. The wire format is
[001/contracts/http-api.md](../../001-push-contract-service/contracts/http-api.md);
this defines what sits in front of it.

---

## MCP tools

### `cocopilot_report`

Report what you are working on right now.

| Parameter | Type | Required | Notes |
|---|---|---|---|
| `task` | string | no | Task identifier you are on |
| `note` | string | no | Prose for the human — why, not what |
| `chip` | `idle` \| `watching` \| `thinking` \| `needs-you` | no | Defaults to `thinking` |
| `feature`, `stories`, `tasks`, `plan`, `changedFiles` | — | no | The full picture when you have it |

`repo`, `branch` and `sessionId` are **not parameters**. The server derives
them. Exposing them would be four more chances for a model to get identity
wrong mid-task, for no benefit.

**Description must state**: this replaces your previous report entirely, and
`needs-you` is the only way to ask for a human's attention.

**Returns**: confirmation, or the board-absent message.

### `cocopilot_note`

Record a note for the human.

| Parameter | Type | Required |
|---|---|---|
| `text` | string | yes |
| `source` | string | no — why it exists: "you asked", "noticed while editing" |

**Description must state**: notes appear on the board and are cleared when the
window closes. Anything worth keeping should be written into the repository
using your own file tools.

---

## CLI

```
cocopilot report [--task ID] [--note TEXT] [--chip STATE]
cocopilot note TEXT [--source TEXT]
```

Both derive `repo` and `branch` from the working directory — see *Identity*
below. Both report as the unattributed session for that repository.

**Exit codes**

| Code | Meaning |
|---|---|
| 0 | Delivered, **or** no board running |
| 1 | Invalid usage, or not inside a repository |
| 2 | Rejected by the service — reason on stderr |

A missing board exits **0** on purpose. These run from hooks, and a hook that
fails because a dashboard is closed would be a monitoring tool breaking the work
it monitors.

---

## The board-absent message

One constant, used by both clients:

> CoCoPilot board is not running — continue working, no need to retry.

Its exact wording is a behavioural requirement. It has to say three things: the
board is absent, this is not a failure of your work, and retrying will not help.

---

## Identity

**Corrected during implementation.** This document originally said to derive
`repo` from `git rev-parse --show-toplevel`. It does not: identity is read from
the filesystem instead.

1. Walk up from the working directory looking for `.git`, resolving the
   `gitdir:` pointer a worktree or submodule leaves in place of a directory.
2. Read `HEAD` for the branch. A detached HEAD reports the abbreviated commit,
   not the literal string `HEAD` that `git rev-parse --abbrev-ref` would give —
   in a board's branch slot that reads as a bug rather than as information.
3. No repository above the working directory is a *value*, not a failure: the
   CLI exits 1 saying so, and the MCP tools return the same explanation.

Why not run `git`: FR-011 says the clients must not launch "the desktop
application **or any other process**", and US3's third acceptance scenario says
"nothing is launched — no window opens and no process starts". A `git`
subprocess on every call is inside that. FR-018 permits *determining the path
and current branch* without prescribing how. Reading the files also costs no
process spawn on a path SC-003 bounds at two seconds, and does not assume `git`
is on `PATH` — which the MCP server, launched by a host rather than by a shell,
cannot.

Nothing outside `.git` is ever read.

The MCP server's session id is a value generated once per process, matching one
agent session. The CLI sends **no** session id at all, and the service assigns
the shared unattributed one — sending the literal string would be recorded as an
agent narrating, because the service derives attribution from the *absence* of
an id (001 FR-004).

---

## Discovery

1. Try `127.0.0.1:41847` through `:41851` in order.
2. `GET /v1/health` on each.
3. Accept the first whose body has `app === "cocopilot"`.
4. Transmit nothing to anything else, including anything returning 200.
5. All five exhausted → the board is absent.

No caching between calls. No retry after exhaustion.
