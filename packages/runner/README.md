# cocoapilot-board

Run the [CoCoapilot](https://github.com/jonupchurch/CoCoPilot) board — a display
panel for watching an AI agent work a Spec-Kit repository — with one command:

```bash
npx cocoapilot-board
```

Same command on Windows, macOS and Linux.

**The first run downloads about 150 MB**, because this package carries the
Electron runtime the board is built on. That happens once per machine and is
cached by npm thereafter. If you only want the reporting tools for your agent
and not the window, install [`cocoapilot-mcp`](https://www.npmjs.com/package/cocoapilot-mcp)
instead — it is around 20 KB and pulls in no browser runtime.

Requires Node 22 or newer.

## Why this package exists separately

The board's own workspace keeps `electron` as a *dev*Dependency, because
`electron-builder` bundles the runtime itself and requires it there. Installing
from npm needs the opposite — `electron` as a real dependency, so that
`npm install` fetches it. One manifest cannot be both, so this package is a thin
wrapper: it carries the same built application, declares Electron properly for
the npm route, and its `bin` does nothing but find the Electron binary and spawn
it.

Both distribution routes are packaged over the same build, so they cannot
diverge in behaviour.
