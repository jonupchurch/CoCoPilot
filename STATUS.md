# Status

**Project:** CoCoPilot (as in *Co-Copilot*) — a tool to help a developer keep
information straight while working with Claude on a GitHub Spec-Kit repository.
An MCP server + local API + desktop board: agents report what they're working
on, a human watches.

**Phase:** Design, **restarted 2026-08-06**. No implementation code, and none
should be written until the design docs exist and are reviewed.

**Last updated:** 2026-08-06 (state ownership and push model settled)

## Where things stand

| Area | State |
|---|---|
| Repo scaffolding | ✅ Toolkit from `../ai-tools`, engine dry-run verified |
| Git | ✅ `main`, pushed to [`jonupchurch/CoCoPilot`](https://github.com/jonupchurch/CoCoPilot) (public) |
| Grounding in real Spec-Kit formats | ✅ Done against `../LMNTLZ` — survives the restart (see below) |
| Product definition | ✅ Unchanged from the previous round: the live Spec-Kit board |
| Stack | ✅ Vite + React, Electron-wrapped, cross-platform (Windows / macOS / Linux) |
| Interface surfaces | ✅ MCP server + HTTP API + CLI |
| Architecture — state ownership | ✅ Settled 2026-08-06: the app process owns volatile state; MCP/CLI are thin clients |
| Architecture — push model | ✅ Settled 2026-08-06: typed facts + agent prose, board owns layout |
| Architecture — everything else | ⬜ Still open — the prior round's decisions are not binding |
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
5. **Architecture is open**, except where decisions 6 and 7 close it. The
   previous round's controller+windows model, two-layer data model, and
   never-writes-to-the-repo constraint are all re-decidable. They are recorded
   below as *inputs*, not as settled state.
6. **State lives in the desktop app process, in memory, and is volatile.**
   Two kinds of state, and only one is ours: the Spec-Kit repo files
   (`tasks.md`, `specs/`, `.specify/feature.json`) are truth on disk, re-read on
   demand and never stored by us; agent narration is push-only and held in
   memory by the Electron main process. The MCP server, the CLI and any non-MCP
   client are thin clients of the local HTTP API. There is no daemon, no
   buffering and no auto-spawn: when the app is not running, none of the three
   surfaces respond.
   - *Rationale:* the always-on daemon existed only to survive the window
     closing. If narration is disposable, that justification goes away. The app
     process is also the merge point for concurrent Claude Code sessions, which
     each spawn their own MCP server child and cannot see each other.
   - *Required implementation detail:* Claude Code discovers an MCP server's
     tool list **once, at session start**. Our MCP server must therefore start
     cleanly whether or not the app is up, and connect to the HTTP API lazily
     per call — otherwise the tools are missing for the whole session even after
     the board is opened. A failed call returns copy along the lines of
     *"CoCoPilot board is not running — continue working, no need to retry,"* so
     a monitoring tool never derails the work it monitors.
   - *Cost:* restarting the app loses the narrative history; the board is still
     correct after a re-scan, just without the story. Accepted.
   - *Build order:* the HTTP API is the one internal service and gets built
     first; the MCP server and CLI are thin adapters over it and come second.
     Cutting MCP entirely was considered and rejected — without it, model-authored
     prose has to arrive by the agent shelling out to the CLI, which costs
     PowerShell quoting on every multi-line note and a permission prompt per call.
7. **Agents push typed facts plus prose.** The schema fixes the skeleton — which
   task, what state — and carries a free-text field the agent writes for the
   human to read. The board owns layout and placement; agents never specify
   presentation. *Rationale:* one contract across all three surfaces, while
   still letting an agent say things a status enum cannot express (*why* T042 is
   blocked). *Cost:* the prose field is unvalidatable by construction — see open
   question 6.

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

1. **Does CoCoPilot ever write to the user's repo?** The previous round said
   never, which is what made "add-on, not source of truth" honest. Now open. If
   it may write, the whole conflict/ownership story has to be designed.
2. **One instance watching N repos, or one per repo?**
3. **Is the HTTP API localhost-only, or does it serve remote windows too?** The
   previous round wanted "local-first, remote-ready" off one seam.
4. **What is actually in the push schema?** Decision 7 fixed the *shape* (typed
   facts + prose) and decision 6 fixed the *mechanism* (one internal service,
   three surfaces wrapping it), so the remaining work is the field list itself:
   which states exist, what identifies a task across repos, and how a push
   references a feature the board hasn't scanned yet.
5. **Liveness display.** Narrowed by decision 6 rather than solved: a volatile,
   push-driven board does not have to adjudicate "dead" at all — showing "last
   heard from 4m ago" and letting the human judge is consistent with a tool that
   keeps information straight rather than rendering verdicts. That sidesteps the
   previous round's too-aggressive 45s/3m thresholds, but the display rules are
   still unwritten. **Not explicitly confirmed** — flagged for review.
6. **Keeping the MCP tool surface honest** — what stops an agent from marking
   everything "editorial"? Decision 7's free-text field sharpens this: prose is
   unvalidatable by construction, so whatever honesty mechanism exists has to
   live in the typed part or in how the board presents unverified claims.
   - *Candidate answer, not yet decided:* Claude Code **hooks** emit mechanical
     facts — which files changed, which tools ran, session start/stop — with zero
     agent cooperation, so unlike a self-reported status they cannot be gamed by
     the agent. Pairing hook-observed facts with agent-claimed prose would let
     the board distinguish **observed** from **claimed** in the UI. Hooks can
     never replace the prose (they fire on events; they cannot author *why* a
     task is blocked), so this is additive.
   - *Consequence if adopted:* hooks become a **fourth ingest path** and have to
     fold into the same contract as the other three — see open question 4.
7. **Packaging and distribution** per platform, including code signing.
   Sharpened by decision 6: Claude Code *spawns* the MCP server as its own child
   process, so an Electron app has to ship a separately-spawnable Node entry
   point that lives outside the app bundle and starts with the app closed.
   Whether that is an npx-able package, a small per-platform binary, or a
   documented path into the installed app is open, and it collides with macOS
   signing and notarization.

## Notable wrinkle

This repo both *uses* Spec-Kit and is *about* Spec-Kit. Our own `.specify/` and
`specs/` are real tracked state, while the app being designed reads those same
structures in *other* repos. Keep the two roles distinct in specs and fixtures.

## Working agreements

The nine rules in [AGENTS.md](AGENTS.md) govern (auto-loaded via [CLAUDE.md](CLAUDE.md));
[MANIFEST.md](MANIFEST.md) is the routable catalog of toolkit assets. Relevant
here: **rule 7** — plan the whole initial feature set before implementing any of
it; **rule 9** — feature work on a feature branch, not `main`.
