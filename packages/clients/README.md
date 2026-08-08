# cocoapilot-mcp

The MCP server and CLI that report to a [CoCoapilot](https://github.com/jonupchurch/CoCoPilot)
board — a window a human watches while an AI agent works a Spec-Kit repository.

Both are thin. They derive which repository, which branch and which session you
are, forward what you composed, and tell you what happened. Neither holds state.

## Install

There is nothing to install. Add this to your `.mcp.json`:

```json
{
  "mcpServers": {
    "cocoapilot": {
      "command": "npx",
      "args": ["-y", "cocoapilot-mcp"]
    }
  }
}
```

That entry is the same on Windows, macOS and Linux, and contains **no path to
the desktop application** — it does not need one, and it works on a machine
where the application was never installed. The tools are simply present and
report that the board is not running.

## Tools

### `cocoapilot_report`

What you are working on right now. Replaces your previous report entirely —
send the whole current picture, not a delta.

| Parameter | Type | Notes |
|---|---|---|
| `task` | string | The task id you are on |
| `note` | string | Prose for the human: why, not what |
| `chip` | `idle` \| `watching` \| `thinking` \| `needs-you` | Defaults to `thinking` |
| `feature`, `stories`, `tasks`, `plan`, `changedFiles` | — | The full picture when you have it |

`chip: "needs-you"` is the **only** way to ask for a human's attention. The
board will never decide on its own that you are stuck — it shows how long it has
been since it heard from you and lets the person judge.

### `cocoapilot_note`

A note for the human. Notes are **cleared when the board window closes** — they
are not storage. Anything worth keeping belongs in the repository, written with
your own file tools.

`repo`, `branch` and `sessionId` are not parameters of either tool. Exposing
them would be three more chances to get identity wrong mid-task, for no benefit.

## CLI

For hooks and build scripts:

```sh
npx cocoapilot-mcp cocoapilot report --task T033 --note "build finished" --chip idle
npx cocoapilot-mcp cocoapilot note "coverage dropped below 80%" --source "noticed in CI"
```

| Exit code | Meaning |
|---|---|
| 0 | Delivered, **or** no board running |
| 1 | Invalid usage, or not inside a repository |
| 2 | Rejected by the board — reason on stderr |

A missing board exits **0** deliberately. These run from hooks, and a hook that
failed because a dashboard was closed would be a monitoring tool breaking the
work it monitors.

Reports from the CLI are attributed to a shared script session per repository,
not to an agent, so a hook firing repeatedly does not fill the board's session
switcher with one-shot entries.

## How it finds the board

1. Try `127.0.0.1:41847` through `:41851`, in order.
2. `GET /v1/health` on each.
3. Accept the first whose body says `app: "cocoapilot"`.
4. Send nothing to anything else — **including anything that returns 200**.
5. All five exhausted: the board is absent.

Nothing is cached between calls, because a remembered port is stale the moment
the board restarts on a different one. Nothing is queued, buffered or retried.
Nothing is ever launched.

## When the board is not running

> CoCoapilot board is not running — continue working, no need to retry.

That is the whole failure mode. It is not an error, it costs you nothing, and
the next call will work if the board is open by then — with no restart of
anything.

## What it reads and writes

Reads `.git/HEAD` in the repository you are working in, to know the branch.
Nothing else, anywhere. Writes nothing, anywhere.

## Requirements

Node 22 or newer.

## Just the tools, or the whole product?

This package is the reporting tools on their own — an MCP server, a CLI, and
nothing that pulls in a browser runtime. It is what an agent needs, and it is
around 21 KB.

If you also want the board itself, the window that displays what your agent
reports, run `npx cocoapilot` instead. That package brings these tools with
it, so you never need both.
