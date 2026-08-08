# CoCoapilot

A display panel for watching an AI agent work a
[Spec-Kit](https://github.com/github/spec-kit) repository — the tool that keeps
straight the information a developer would otherwise be tracking in their head
across a long agent session.

The agent reports what it is doing. The board shows it. Nothing else happens:
the board sends nothing to any agent, holds nothing durable, and reads nothing
from your repository.

## Running it

```bash
npx cocoapilot
```

The same command on Windows, macOS and Linux. Requires **Node 22 or newer**.

> **The first run downloads about 150 MB.** The board is an Electron
> application, so the package carries a browser runtime. It happens once per
> machine and npm caches it afterwards. If you only want the reporting tools
> for your agent and not the window, install `cocoapilot-mcp` instead — around
> 20 KB, and it pulls in no runtime at all.

## Telling your agent about it

Add one entry to your MCP configuration. It is the same on every platform and
contains no path to anything:

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

Your agent then has two tools — one to report what it is working on, one to
leave a note. Both fail soft: if no board is running, the agent is told
`CoCoapilot board is not running — continue working, no need to retry.` and
carries on. Nothing about your agent depends on this being installed.

Two things an agent cannot infer and that the tool descriptions state outright:
`needs-you` is the only way to ask for a human, and notes are cleared when the
board window closes.

## What you see

| Tab | What it holds |
|---|---|
| **Overview** | The current task, the spec, the plan, changed files — plus the last prompt, the prompt history and the files the agent is holding, read from the agent's own transcript |
| **User Stories** | Each reported story in full: narrative, acceptance criteria, its tasks, the files it touches |
| **Tasks** | One task at a time — detail, checks, files, and which story it came from |
| **Notes** | What the agent recorded this session, newest first. Cleared when the window closes, and the view says so |

Several agents at once each get a pill in a switcher row; one asking for a human
shows it there without the board switching to it.

## The packages

| Package | What it is | Size |
|---|---|---|
| `cocoapilot` | The board, and the tools with it. What `npx` fetches | ~150 MB installed |
| `cocoapilot-mcp` | The MCP server and CLI, on their own. What an agent needs | ~21 KB |
| `cocoapilot-contract` | The shared payload definition. An implementation detail of the two above | ~9 KB |

## Development

```bash
npm install
npm run build
npm test          # unit and integration
npm run test:e2e  # Playwright, against the built app
npm run typecheck
npm run pack:check   # pack, install and launch every package, cleanly
```

The end-to-end suite drives the **built** application, so `npm run build` has to
happen first or it tests the previous build.

### The icon

`apps/board/resources/icon.ico` and `icon.png` are generated from
`resources/cocoapilot-mark.svg` and committed. After changing the mark:

```bash
node scripts/build-icons.mjs
```

It is not part of `npm run build` on purpose — committing the output keeps the
rasteriser out of the publish path, so a release cannot fail on a native module
that will not install on the release machine. `npm run pack:check` asserts both
files reach the published package, because Electron ignores an icon path that
does not exist without erroring: the board would run perfectly and simply show
Electron's own logo.

## Status

Features 001–008 are built and merged: the contract and service, the MCP server
and CLI, the window, all four tabs, the transcript reader, and multiple
sessions. Feature 009 is packaging — the npm route described above, with signed
desktop installers specified and deferred until there are certificates to test
them against.

See [STATUS.md](STATUS.md) for the architecture decisions, each with its
rationale *and* its cost, and [CHANGELOG.md](CHANGELOG.md) for what each feature
added.

## Licence

MIT.
