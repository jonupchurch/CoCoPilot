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
npx cocoapilot-board
```

The same command on Windows, macOS and Linux. Requires **Node 22 or newer**.

> **The first run downloads about 150 MB.** The package itself is 163 kB — the
> weight is Electron, which the board is built on. Its runtime is fetched
> separately from GitHub's release downloads rather than from npm, and cached
> per machine, so it happens once. Two consequences worth knowing: a locked-down
> network needs both `registry.npmjs.org` and `github.com` reachable, and if you
> only want the reporting tools for your agent and not the window, install
> `cocoapilot-mcp` instead — 22 kB, and it pulls in no runtime at all.

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

Not every tab is offered to every session — the board shows the destinations that
session actually has, which is why two agents can give you two different strips.

| Tab | What it holds | When it appears |
|---|---|---|
| **Overview** | The current task, the spec, the plan, changed files — plus the last prompt, the prompt history and the files the agent is holding, read from the agent's own transcript | Always |
| **Ticket** | The tracker ticket the work came from — description, acceptance criteria, state, comments, and its address, openable in your own browser | Once an agent reports one |
| **Spec-Kit** | Stories and the tasks beneath them as one expandable tree, with a detail pane | Once an agent reports a story |
| **Stories** | Each reported story in full: narrative, acceptance criteria, its tasks, the files it touches | Until the Spec-Kit tree replaces it — unless you had already opened it |
| **Tasks** | One task at a time — detail, checks, files, and which story it came from | Same as Stories |
| **Notes** | What the agent recorded this session, newest first. Cleared when the window closes, and the view says so | Always |

Several agents at once each get a pill in a switcher row; one asking for a human
shows it there without the board switching to it.

**The board reads nothing and fetches nothing.** Everything above either arrived
in an agent's report or was read from the agent's own transcript file. It never
opens your repository, never contacts your tracker, and the one thing it sends
anywhere is a ticket address handed to your browser when you click it — and only
ever an ordinary `http:` or `https:` one.

## The packages

All three are published at **0.1.0**.

| Package | What it is | Download | On disk |
|---|---|---|---|
| [`cocoapilot-board`](https://www.npmjs.com/package/cocoapilot-board) | The board, and the tools with it. What `npx` fetches | 163 kB | 1.1 MB, plus ~150 MB of Electron |
| [`cocoapilot-mcp`](https://www.npmjs.com/package/cocoapilot-mcp) | The MCP server and CLI, on their own. What an agent needs | 22 kB | 69 kB |
| [`cocoapilot-contract`](https://www.npmjs.com/package/cocoapilot-contract) | The shared payload definition. An implementation detail of the two above | 13 kB | 49 kB |

They install in that order of dependency — the board brings the other two, and
`cocoapilot-mcp` brings only the contract. Nothing an agent installs can drag in
a browser runtime.

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

**Every specced feature is built.** Features 001–011: the contract and service,
the MCP server and CLI, the window and its tabs, the transcript reader, multiple
sessions, packaging, the Spec-Kit tree, and the ticket tab with openable links.

**npm is the only way this is distributed**, deliberately. There are no
downloadable installers and there will not be: CoCoapilot is for developers
watching an agent work, and a developer already has Node. That also means nothing
here needs code signing or notarisation — the Electron runtime arrives as an
ordinary npm dependency.

It is a first release and says so: the version is deliberately below 1.0, and
the only platform it has been exercised on is Windows. The command and the
packaging are identical on macOS and Linux, but "identical" there is a claim
about the design rather than a report from a test.

See [STATUS.md](STATUS.md) for the architecture decisions, each with its
rationale *and* its cost, and [CHANGELOG.md](CHANGELOG.md) for what each feature
added.

## Licence

MIT.
