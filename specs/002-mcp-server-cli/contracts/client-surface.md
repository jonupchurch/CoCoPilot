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

Both derive `repo` from `git rev-parse --show-toplevel` and `branch` from the
current checkout. Both report as the unattributed session for that repository.

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

## Discovery

1. Try `127.0.0.1:41847` through `:41851` in order.
2. `GET /v1/health` on each.
3. Accept the first whose body has `app === "cocopilot"`.
4. Transmit nothing to anything else, including anything returning 200.
5. All five exhausted → the board is absent.

No caching between calls. No retry after exhaustion.
