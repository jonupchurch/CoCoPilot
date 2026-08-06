# Status

**Project:** CoCoPilot (as in *Co-Copilot*) — a tool to help a developer keep
information straight while working with Claude on a GitHub Spec-Kit repository.
An MCP server + local API + desktop board: agents report what they're working
on, a human watches.

**Phase:** Design, **restarted 2026-08-06**. No implementation code, and none
should be written until the design docs exist and are reviewed.

**Last updated:** 2026-08-06

## Where things stand

| Area | State |
|---|---|
| Repo scaffolding | ✅ Toolkit from `../ai-tools`, engine dry-run verified |
| Git | ✅ `main`, pushed to [`jonupchurch/CoCoPilot`](https://github.com/jonupchurch/CoCoPilot) (public) |
| Grounding in real Spec-Kit formats | ✅ Done against `../LMNTLZ` — survives the restart (see below) |
| Product definition | ✅ Unchanged from the previous round: the live Spec-Kit board |
| Stack | ✅ Vite + React, Electron-wrapped, cross-platform (Windows / macOS / Linux) |
| Interface surfaces | ✅ MCP server + HTTP API + CLI |
| Architecture | ⬜ **Deliberately reopened** — the prior round's decisions are not binding |
| Design prompts / wireframes (`resources/`) | ⬜ Emptied 2026-08-06; new round being written |
| Design docs (`docs/design/`) | ⬜ Not started |
| Feature specs (`specs/`) | ⬜ None |
| Implementation | ⬜ Blocked on design review |

## What this is

Same product as the previous round, renamed. CoCoPilot reads a Spec-Kit
repository's own files for structure and takes live narration pushed by the
agents doing the work, so a human can watch a board while Claude implements
tasks. The name change reflects the framing better: it's the *co*-pilot's
copilot — it holds the information the developer would otherwise be tracking in
their head across a long agent session.

## Decisions settled (2026-08-06)

1. **Name: CoCoPilot.** Published to a new **public** repo,
   `jonupchurch/CoCoPilot`, on 2026-08-06. The previous private `jonupchurch/skmc`
   repo is retained untouched and is still wired up as the `skmc-old` git remote;
   deleting it is a pending user action. Note that the round 1 design exports
   deleted in this restart remain in the now-public git history.
2. **Vite + React** for the UI. *Cost:* a SPA, so any deep-link/routing story is
   ours to build.
3. **Electron** as the desktop wrapper, targeting Windows, macOS and Linux.
   *Rationale:* the main process is Node, so the MCP server, the HTTP API and
   any file watching run in-process in the same TypeScript codebase — no second
   language and no IPC bridge to a sidecar. *Cost:* ~100 MB binaries, real
   memory overhead, and per-platform packaging work (macOS notarization in
   particular is not free).
4. **Three interface surfaces: MCP server, HTTP API, and CLI.** *Rationale:*
   Claude connects over MCP; hooks and scripts get the CLI; the window and any
   non-MCP client get HTTP. *Cost:* three front doors must resolve to one
   contract or they will drift — this is the main thing the architecture doc has
   to pin down.
5. **Architecture is open.** The previous round's controller+windows model,
   two-layer data model, and never-writes-to-the-repo constraint are all
   re-decidable. They are recorded below as *inputs*, not as settled state.

## What survives the restart

**The Spec-Kit format grounding.** Verified against `../LMNTLZ` (21 features,
1,076 task lines, Spec-Kit 0.12.12.dev0). This is empirical evidence about what
real Spec-Kit files look like, not an architecture opinion, so it holds
regardless of what gets built:

- Checkbox case is inconsistent *inside one repo* — `- [x]` ×554, `- [X]` ×341,
  `- [ ]` ×181. A case-sensitive parser silently misreads 341 completed tasks.
- Task IDs appear bare (`T001`) and bold (`**T001**`).
- Tasks nest under `###`, not only under `##` phase headers.
- Header text drifts once hand-edited: `## Phase 3b: WIRING`, emoji, `(Priority: P1)`.
- `tasks.md` alone yields the feature title, user stories and `[US*]` tags — a
  kanban needs no other file.
- "Checked" ≠ done: a struck-through, explicitly-dropped task can still be `[X]`.
- Features can be partial; `.specify/feature.json` is the current-feature pointer.

Re-verify against `../LMNTLZ` rather than against the Spec-Kit templates — the
templates do not predict what real files look like.

**Nothing else.** `resources/` was emptied on 2026-08-06; the round 1–3
wireframes and design prompts are gone, and a new round is being written.

## Open questions

Ordered roughly by how much downstream work each one blocks.

1. **Where does state live, and what owns it?** Claude Code spawns stdio MCP
   servers as its *own* child processes, so the MCP server is not naturally the
   same process as the Electron app. Either (a) the MCP server is a thin client
   of the local HTTP API and the desktop app must be running, or (b) state lives
   in a separate always-on headless daemon that the app, the MCP server and the
   CLI all talk to. *Recommended default:* (b) — it is the only one where
   closing the window doesn't drop the session.
2. **Does CoCoPilot ever write to the user's repo?** The previous round said
   never, which is what made "add-on, not source of truth" honest. Now open. If
   it may write, the whole conflict/ownership story has to be designed.
3. **One instance watching N repos, or one per repo?**
4. **Is the HTTP API localhost-only, or does it serve remote windows too?** The
   previous round wanted "local-first, remote-ready" off one seam.
5. **How do three ingest paths stay one contract?** Shared schema package,
   generated clients, or a single internal service the three surfaces wrap.
6. **Liveness thresholds.** Carried forward as an unsolved problem: a healthy
   agent goes quiet for minutes during a typecheck, so the previous round's
   45s/3m guesses were too aggressive.
7. **Keeping the MCP tool surface honest** — what stops an agent from marking
   everything "editorial"?
8. **Packaging and distribution** per platform, including code signing.

## Notable wrinkle

This repo both *uses* Spec-Kit and is *about* Spec-Kit. Our own `.specify/` and
`specs/` are real tracked state, while the app being designed reads those same
structures in *other* repos. Keep the two roles distinct in specs and fixtures.

## Working agreements

The nine rules in [AGENTS.md](AGENTS.md) govern (auto-loaded via [CLAUDE.md](CLAUDE.md));
[MANIFEST.md](MANIFEST.md) is the routable catalog of toolkit assets. Relevant
here: **rule 7** — plan the whole initial feature set before implementing any of
it; **rule 9** — feature work on a feature branch, not `main`.
