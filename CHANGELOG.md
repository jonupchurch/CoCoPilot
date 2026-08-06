# Changelog

All notable changes to CoCoPilot are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project is pre-release and not yet versioned.

## [Unreleased]

### Design

- **Design restarted 2026-08-06.** `resources/` was emptied — the round 1–3
  wireframes and versioned design prompts from the previous round are gone, and
  a new round is being written. The product itself is unchanged.
- **Renamed to CoCoPilot** (as in *Co-Copilot*), from "skmc — Spec-Kit Mission
  Control", and republished to a new public repo,
  [`jonupchurch/CoCoPilot`](https://github.com/jonupchurch/CoCoPilot). The
  previous private `jonupchurch/skmc` repo is untouched and remains wired up as
  the `skmc-old` remote.
- **Stack decided:** Vite + React, wrapped in Electron for Windows, macOS and
  Linux. Electron over Tauri so the MCP server, HTTP API and file watching all
  run in the Node main process — one TypeScript codebase, no sidecar.
- **Interface surfaces decided:** MCP server + HTTP API + CLI.
- **Architecture deliberately reopened.** The previous round's controller+windows
  model, two-layer data model, and never-writes-to-the-repo constraint are
  inputs to the new design, not settled state. See [STATUS.md](STATUS.md).
- **State ownership decided:** the Electron main process owns all state and it
  is volatile and in-memory. Repo files stay truth on disk and are re-read, not
  stored; agent narration is push-only and lost on restart. No always-on daemon,
  no buffering, no auto-spawn — when the app is not running, the MCP server, the
  CLI and the HTTP API simply do not respond. The MCP server must still start
  cleanly with the app down and connect lazily per call, because Claude Code
  discovers an MCP tool list only once, at session start.
- **Push model decided:** agents push typed facts plus a free-text field for the
  human; the board owns layout. Agents never specify presentation.
- **Round 1 design exports landed** in `resources/` — Brand, Design System and
  an Overview Panel covering four tabs (Overview, User Stories, Tasks, Notes).
- **Design precedence decided:** the exports are canon for look and feel;
  where their incidental content conflicts with the docs in this repo, the docs
  win and that part of the design is illustrative. Resolves the mock's
  hyphenated task IDs, its 60s stall threshold, and its mixed fixture in favour
  of the recorded grounding.
- **Panel width decided:** stable across tab changes, user-resizable only.
  Narrow-width behaviour for the Stories and Tasks master–detail views is a
  design revision still owed.
- **Transcript reading decided:** the app tails Claude Code's own session
  transcripts (`~/.claude/projects/<slug>/*.jsonl`) to feed the Overview tab's
  Last prompt, History and In context sections, which no other source could
  supply. Transcripts join repo files as truth on disk that is re-read, never
  stored — so history survives a restart, and the board can show what happened
  while it was closed. Cost: an undocumented format that must be read
  defensively, and prompt text as a new privacy surface.
- **One-way flow decided:** data moves agent → board and never back. Nothing in
  the UI sends to the agent or writes to the user's repository, which drops the
  Design System's ask-input, Apply/Skip, Re-read/Discard and "Open in Claude"
  from scope and restores the "add-on, not source of truth" position.
- **Refresh model decided:** the AI drives updates and the window never
  refreshes itself — no polling, no repository watching, no timers. Following
  the Claude Code transcript counts as the AI updating the board, since it is
  the file the AI writes, so activity stays live without a push per tool call.
  The screen is a snapshot of what the agent did, not a mirror of the working
  tree; hand edits and out-of-band git do not move it. Changed files is the
  lowest-priority Overview section, which is also the one this costs most.
- **Repo scope decided:** no user-facing repo selection. A push declares its own
  repo and branch and the board renders what it is told, which also supplies the
  path that resolves to the transcript directory. Leaves two questions open —
  what happens when two agents push at once, and what the board shows before
  anything has been pushed at all.
- **Concurrency decided:** one window holding every declared session, with a
  switcher that appears only once a second session declares itself — so the
  single-session case looks exactly as designed. Settles the shape as one
  process, one main window; the tear-off `+` is a separate axis. Owes a design
  revision for the switcher, which must be absent at one session and present at
  two.
- **Liveness decided:** the board shows elapsed time — "last heard from 4m ago" —
  and never renders a verdict. No thresholds, no automatic state change. Kills
  the previous round's 45s/3m guesses and the design fixture's 60s stall
  criterion outright. The four status chips are driven by pushes and transcript
  activity, never by a timer, so "Needs you" is only ever a state the agent
  pushes — the one way it can ask for attention under the one-way rule.
- **Transcript and push are not reconciled.** Pushed status drives the task,
  spec and plan views; the transcript feeds only Last prompt, History and In
  context. No comparison, no disagreement display. Closes the honesty question
  by declining it: the board reflects what the agent reports, so an agent that
  reports inaccurately is displayed inaccurately. In exchange the transcript
  reader stays narrow, which limits what breaks when the undocumented format
  shifts.
- **Session eviction decided:** sessions clear on app restart, and the user can
  dismiss one from the switcher. No timers. Dismissing is not muting — a
  dismissed session that pushes again reappears, because the AI decides what is
  on the board.
- **API scope decided:** the HTTP API binds to `127.0.0.1` only — no auth, no
  TLS, no remote windows, dropping the previous round's "local-first,
  remote-ready" intent. Localhost is still not a trust boundary, so pushes are
  validated regardless.
- **Task states cut to two**, read from `tasks.md`: checked or unchecked. No
  *active* or *blocked* in the data model; the agent's prose carries what is
  happening. An explicit, informed override of the design canon — the blue
  active dot and ember blocked treatment are dropped and those views owe a
  revision. Task state now comes entirely from disk, so it survives a restart
  and cannot drift from the repo, and the push shrinks to session identity,
  current task, prose and the session chip. Known cost: struck-through
  dropped-but-still-`[X]` tasks count as done, so completion summaries can
  overcount.
- **Spec-Kit format grounding retained.** The findings verified against
  `../LMNTLZ` (21 features, 1,076 task lines, Spec-Kit 0.12.12.dev0) are
  empirical and survive the restart — notably `- [x]` ×554 vs `- [X]` ×341
  inside a single repo, which would break a case-sensitive parser.

- **The app never reads the user's repository.** No `tasks.md` parsing, no
  `specs/` walk, no `.specify/feature.json`, no git — stories, tasks, criteria,
  titles, states and file lists all arrive by push, and the board is a renderer
  of what it is told. Supersedes the two-state task decision, whose only reason
  was the checkbox. Amends the state model: nothing is re-derivable from the
  repo, so every launch starts empty. Moves the Spec-Kit format grounding from
  our parser, which no longer exists, to the agent-side tool.
- **Task status is a free string**, not an enum. Recognised values (todo,
  active, blocked, done) carry the round 1 colours; anything else renders
  neutral, since an arbitrary string cannot honestly be given a signal colour.
- **Every push is a full snapshot** and replaces what the board holds — no
  deltas, no merging. Idempotent and self-healing, which matters more now that
  no repo read remains to correct a drifted board. Notes stay the one exception,
  appending rather than replacing.
- **Port discovery decided:** fixed port plus a short fallback range, resolved
  by a `/v1/health` check that must match on payload rather than on the
  connection succeeding — probing a range means knocking on ports owned by other
  software.
- **Unattributed sessions:** pushes with no MCP server process behind them share
  one session per repo, labelled as a script or hook, so a per-tool-call hook
  cannot fill the switcher with one-shot entries.
- **Design round 2 landed** — revised Overview Panel plus a decisions doc,
  delivering all six briefed revisions. One of its decisions is already
  superseded: it ran before the no-repo-reads and free-string-status calls, so
  task-state rendering owes a round 3. Its `focus`-versus-status split survives
  and is now load-bearing.
- **Round 3 design brief written** — `resources/designprompt3.md`. A short round:
  free-string task statuses with a defined neutral fallback, the `now` tag
  carrying its own elapsed time, and session pills carrying their own chip and
  elapsed time. Locks both previous rounds explicitly, including round 2's
  `focus`-versus-status split, which free-form statuses make more necessary
  rather than less. Names overflow as optional — the largest gap round 2
  identified in itself, and a natural companion to the pill density work.
- **Round 2's five open questions ruled on.** Three defaults accepted as
  written: declaration-order pills, `×` with a clarifying tooltip, and a muted
  unread dot on Notes with no count. Two changed — the `now` tag carries its own
  elapsed time rather than muting after ten minutes, since a threshold is the
  thing the liveness decision rules out and a stated duration cannot be wrong;
  and session pills carry their own chip and elapsed time, closing a hole where
  a `needs-you` on an unselected session would have been an ask that never
  arrived.
- **Notes decided:** the tab holds notes the agent writes, either because the
  user asked it to record something or because the agent judged it worth
  recording. The user never types into the board, so Notes stays inside the
  one-way rule. Notes accumulate where everything else replaces, making them a
  second kind of push.
- **CoCoPilot owns no durable state** — it is a display panel. Nothing survives
  closing the window; everything on screen is re-derived from disk or was pushed
  since launch. Decision 6 stands with no carve-outs, including for notes.
  Durability is the agent's job: the user asks it to write to the repository
  with its own file tools, which leaves the never-writes rule untouched and
  produces a file the user owns. Removes the database, migrations, storage
  versioning and corrupt-state recovery from the build entirely, and forbids any
  UI that implies permanence.
- **Round 2 design brief written** — `resources/designprompt2.md`, a revision
  brief rather than a restart. Locks the round 1 identity, colour system, type,
  spacing and the subdivided-panel structure explicitly so they are not
  re-derived, and asks for six changes: two-state tasks, a Content blocks
  section that matches a read-only product, narrow-width Stories and Tasks, a
  session switcher that is absent at one session, an empty state, and the Notes
  tab, whose contents are now decided.
- **Push schema drafted** in `docs/design/push-schema.md` — the first design doc
  of the new round. Defines the one payload all three surfaces wrap, and splits
  it into the three fields the model composes (`task`, `note`, `chip`) and the
  rest the surface derives, on the reasoning that three fields is something an
  agent gets right mid-task and seven is a form it fills in badly. Leaves three
  open points: `sessionId` outside an MCP server process, pushes naming an
  unscanned feature, and port discovery.

### Added

- **Spec-Kit + ai-tools scaffolding.** Copied the portable toolkit from
  `../ai-tools` per its bootstrap instructions: `.specify/` (Spec-Kit engine —
  templates + PowerShell automation), `.claude/` (the `speckit-*` skills, the
  `codebase-scout` / `verifier` / `diff-reviewer` subagents, the `/orient`,
  `/mini-spec`, `/verify`, `/commit`, `/pr` commands, and the read-only
  permission allowlist), `stacks/README.md`, `docs/interview-cheat-sheet.md`,
  and the `AGENTS.md` / `CLAUDE.md` / `MANIFEST.md` operating context.
- `.gitignore` — deliberately does **not** ignore `specs/` or
  `.specify/feature.json`. In the source `ai-tools` repo those are ignored
  because it ships the engine without project state; here they are the
  project's own tracked state.
- `CHANGELOG.md` and `STATUS.md`.
- Git repository initialized (`main`) and pushed to GitHub.

### Notes

- Engine verified in place: `create-new-feature.ps1 -DryRun` resolves the repo
  root to `D:\Codelib\skmc`, all four templates resolve to `.specify/templates/`,
  and commands format as `/speckit-<name>` (hyphen separator, per
  `.specify/integration.json`).
- No implementation code yet — this is a design-first project. See
  [STATUS.md](STATUS.md).
