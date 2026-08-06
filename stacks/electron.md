# Electron

Defaults for the desktop shell. The repo wins where it already differs.

## Defaults

- **Three processes, three tsconfigs.** `main` (Node), `preload` (isolated
  bridge), `renderer` (browser). They do not share a build; a Node import that
  compiles in the renderer is a mistake the config should catch.
- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.** Not
  negotiable here — this window renders text composed by an AI agent.
- **All privilege lives in `main`.** The renderer asks; it never reaches the
  filesystem, the network, or a child process itself.
- **`contextBridge.exposeInMainWorld` with a named, minimal surface.** Expose
  functions, never `ipcRenderer`. One object, one purpose, no passthrough.
- **`ipcMain.handle` + `invoke` for request/response**; `webContents.send` for
  main-initiated pushes. Do not fake one with the other.
- **Validate at the IPC boundary too.** It is a trust boundary like any other.

## Where things go

```
apps/board/src/
├── main/       # window lifecycle, service, anything privileged
├── preload/    # contextBridge only. No logic.
└── renderer/   # UI. No node: imports, ever.
```

## Don't

- Don't enable `nodeIntegration` "just for now."
- Don't pass `ipcRenderer` through the bridge — it re-exposes everything.
- Don't put business logic in `preload`; it is a wire, not a layer.
- Don't `shell.openExternal` on agent-supplied text without an allowlist.
- Don't hold state in the renderer that main also holds. One owner.
- Don't block the main process — it is the UI thread *and* the server host.

## Verify

- [ ] `nodeIntegration` off, `contextIsolation` on, `sandbox` on
- [ ] Bridge surface is a named object of functions, no raw IPC
- [ ] No `node:` import resolves in the renderer build
- [ ] IPC payloads validated on the main side
- [ ] App quits cleanly — no orphaned server, no lingering handles
- [ ] Packaged build launches on all three platforms, not just `dev`
