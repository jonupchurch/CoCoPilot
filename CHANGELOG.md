# Changelog

All notable changes to CoCoPilot are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project is pre-release and not yet versioned.

## [Unreleased]

### Added

- **Feature 009 (part) — Publishable packages.** Three packages that pack,
  install and run: `cocopilot-board` (the whole product, one command),
  `@cocopilot/mcp` (the reporting tools alone) and `@cocopilot/contract`.
  **Nothing is published** — the work ends at a release script that would.
  - **Re-specified first.** The original spec had one route, signed installers,
    and made them a hard requirement — which put the product's availability
    behind an Apple developer account and a Windows certificate. There are two
    routes now over one build, cheapest first, with the installers demoted to
    P3 and their requirements unchanged. Deferred visibly rather than dropped.
  - `packages/runner` is a separate package rather than `apps/board`
    un-privated, because `electron-builder` requires `electron` in
    devDependencies and the npm route requires it as a dependency. One manifest
    cannot be both, so the application is untouched and both routes package the
    same `out/`.
  - **`scripts/pack-check.mjs` is the rehearsal for a thing that cannot be
    undone.** It packs everything, installs the runner into a clean directory,
    starts it, and separately installs the client alone to prove it still drags
    no browser runtime behind it.
  - It earned itself immediately: the published command opened a window onto a
    file-not-found. Electron had been handed the entry *file* rather than the
    package directory, so `app.getAppPath()` came back one level too deep. Every
    file was present, both binaries resolved, the process stayed up — and only
    the window was wrong. The check now starts the installed board and fails if
    it cannot load itself, because **a package that installs is not a package
    that runs**.
  - **`scripts/release.mjs` refuses rather than recovers**, since a published
    version cannot be replaced: dirty tree, version disagreement, a pin naming
    the wrong version, a manifest missing `publishConfig.access` or
    `prepublishOnly`. Each refusal verified by causing it. It builds from
    scratch, rehearses the install, and prints the publish commands in
    dependency order — and does not publish even with `--publish`.
  - Housekeeping the repository had been missing: a root `README.md`, a
    `LICENSE` file (five manifests claimed MIT with no licence anywhere), and
    `publishConfig.access: public` — a scoped package defaults to *restricted*
    and fails with a billing error, which is the most common first-publish
    surprise.
  - The naming decision is deliberately left open and documented: `cocopilot`
    unscoped is an npm security holding package, so `npx cocopilot` is
    unavailable; the scoped names need an organisation whose availability
    cannot be checked without a login, and the fallback rename is recorded.

- **Feature 008 — Multiple sessions.** Every view showed `sessions[0]` until
  now, so a developer's second agent was invisible. A switcher row appears when
  a second session declares itself, holds a pill per session in declaration
  order, and offers a control that clears the board's copy of one.
  - **The P1 story is an absence.** Below two sessions there is no row at all —
    most sessions are single, and permanent chrome for a choice that usually
    does not exist taxes every ordinary use to serve an occasional one. The
    threshold lives in one component so no caller can draw a switcher for one
    session by forgetting to check.
  - **Pills carry their own attention state, and that is the point.** The chip
    is the only channel an agent has for asking for a human (decision 15) and
    the board shows one session at a time, so without state on unselected pills
    a `needs-you` on the session you are not watching is an ask that never
    arrives. It shows as an ember border; nothing reorders, moves or flashes,
    and the board never switches itself.
  - **The renderer gained its first write.** The preload bridge had been exactly
    `getState` and `subscribe` since feature 001, with a test asserting that
    list by name and a note saying a third member should be argued for. FR-012
    needs a dismiss control and the store lives in main, so the argument is now
    in the test and the property it protects was restated rather than loosened:
    the window may change what it shows and what the board holds, and still send
    nothing to any agent. Asserted by exercising select, switch-back and dismiss
    with zero outbound requests.
  - Main resolves the selection, which reverses feature 006's pattern for a
    stated reason: in 006 the renderer held every story and task and could
    resolve locally, but here it holds one session and cannot see the others.
    Pushing all of them so it could pick is fine at three sessions and
    untenable at `MAX_SESSIONS` of 100 with 500 tasks each. So the window gets a
    summary per session plus one full projection, and FR-016's fallback lives in
    the projection where no view can forget it.
  - **The density rule needed correcting against FR-005.** The plan said the
    branch drops from unselected pills past two sessions; that draws two
    identical pills for the case the spec names in its own edge cases — two
    sessions in the same repository on different branches. The branch now
    survives wherever a repository name is not unique, however crowded the row
    is. Density is a preference; telling which agent you are about to switch to
    is the requirement.
  - Three tests were written wrong first: SC-001 compared a single-session
    window to itself (it now measures against the two-session case, so reserving
    permanent space would fail); the no-expiry test faked twelve hours with
    `page.clock`, which cannot patch timers a page created before it ran, so the
    ages sat at `0s` and it passed for the wrong reason; and comparing
    `isFocused()` across an arrival flaked in the full suite, because focus
    belongs to the window manager. The last is now structural — the main process
    calls nothing that focuses, flashes or floats, and its one `show()` is
    named.
  - 29 more Playwright tests and 8 more unit tests; 429 unit and integration
    tests and 209 end-to-end in total.

- **Feature 007 — Notes.** The last of the four tabs, and the only view whose
  content accumulates: what the agent recorded this session, newest first, with
  how long ago and why. Flat rows rather than cards, because forty cards is
  forty boxes to read past and forty rows is one column to read down.
  - **The view's job is to be true, not just to list things.** A permanent
    footer states that closing the window clears these notes and that anything
    worth keeping belongs in the repository, and every part of the tree has to
    agree with that sentence. A pin or a star would break no code — it would
    falsify the footer — so the requirement is asserted as an absence, twice:
    zero operable elements in the rendered view, and no handler or interactive
    element anywhere in the tree's source.
  - That source check asserts **interactivity**, not a list of words like `pin`
    and `archive`. The word list was written first and was wrong twice over: it
    matched the `export` keyword in every module and the prose in this tree
    explaining why a pin is absent, and it would have missed a control named
    something nobody listed.
  - **An arriving note must not move the reader**, which was named up front as
    the thing most likely to fail. Notes enter at the top of a list that may be
    scrolled. Chromium's scroll anchoring absorbs it — and it is doing real
    work: with `overflow-anchor: none` a single note moves the reader 45px and a
    burst of ten moves them 447px, half a screen. The property is asserted by
    measuring a row's position across an arrival.
  - Newest first by **reversing arrival order**, never by sorting on
    `receivedAt`: two notes can share a millisecond and a sort would order those
    arbitrarily, where arrival order is a fact the store already established.
    Keyed by arrival index — an array index, which the stack pack forbids, and
    the one list where it is right: notes never reorder, so the index is fixed
    for the life of the window and `receivedAt` is not an identifier.
  - **The unread mark is a boolean and cannot become a count.** The tab strip's
    prop admits no number, so a component that cannot receive one cannot start
    rendering one — a count would read as an inbox with something to clear, and
    there is nothing to clear. The mark is muted rather than teal or ember,
    because either would make an arriving note a summons. An arrival is
    asserted not to move, raise, focus or resize the window.
  - Three more export bindings decided rather than transcribed: one source line
    where the export draws two, because `NoteRequest` has one `source`; one
    muted gutter dot, because the export's ember is reserved for `needs-you` by
    decision 15 and its teal-on-newest says what the elapsed time already says;
    and an elapsed span in the header where the export writes `since 09:14`,
    because a wall clock is the one time format nothing else in this product
    uses.
  - The count question the spec's assumptions raised is settled explicitly: no
    count on the tab, where a number reads as an inbox; a count in the view's
    own header and in the footer, where `clears all 12` makes the loss concrete
    rather than leaving the reader to guess whether it means much.
  - 26 more Playwright tests and 11 more unit tests; 421 unit and integration
    tests and 180 end-to-end in total.

- **Feature 006 — Stories and Tasks tabs.** The two remaining detail views, and
  the last placeholder tabs except Notes. A story in full — narrative, numbered
  criteria, its tasks and the files it touches — and a task in full: detail,
  checks, files, and which story it came from.
  - **The developer is never moved.** Not by a report and not by a resize.
    `useSelection` holds the *intent* — an id someone clicked — and resolves it
    against the current report on every render, so "keep the selection if it
    still exists" and "move somewhere valid if it does not" are the same two
    lines rather than an effect and a stale copy. Reports replace wholesale
    (decision 26), so a story vanishing between two reports is ordinary rather
    than exceptional, and a view that rendered nothing there would read as a
    crash. Scroll position survives for the same structural reason.
  - **A scope for tasks belonging to no reported story.** Nothing validates that
    an agent reports a consistent graph: `storyId` may be null or name a story
    that was never sent. The design export has no such scope — it assumes the
    graph resolves — so this is designed rather than transcribed, and it appears
    only when it actually holds something.
  - **One status vocabulary, enforced rather than intended.** Four surfaces now
    draw a status. `source-hygiene.test.ts` fails on a synonym literal or a
    `classify` call anywhere in the renderer outside the two files that own the
    vocabulary, and `status-vocabulary.spec.ts` reads the same ten-case matrix
    from every surface and *compares* them, so a divergence fails in CI rather
    than being noticed by someone with two tabs open a month later.
  - Same breakpoint, two different answers, each with the reason in its
    stylesheet: Stories collapses its list into a picker below 640px because a
    story row is three lines and five of them would push the detail off the
    panel; Tasks stacks instead because a task row is two short lines and
    hiding the list would cost a click per task. The Tasks scope picker is
    present at every width — it is the scope control, not a narrow fallback.
  - Two more export bindings the contract cannot supply, decided rather than
    invented: `task.updated` is the *report's* age shown against the current
    task only, with its `title` saying so outright, because no per-task
    timestamp exists and decision 26 refuses the state that would create one;
    and `story.spec` is the feature's path, labelled as the feature's.
  - **SC-008 as three assertions, not one.** The bridge exposes two members and
    both are reads; no file in either view tree names a way of sending; and
    every control in both views is activated with zero outbound requests
    recorded. The third alone would pass on a build with no controls yet, and
    the first two alone would miss an `<img>` — which is what the teeth-check
    used.
  - Two tests were found passing while measuring something other than what they
    named: a resize to 380px that silently landed at 452 (the renderer sees a
    resize a beat late), and a boundary case at 639px that a 1.5 display scale
    rounds back up to 640. Both now assert the width they actually got.
  - 45 more Playwright tests and one more unit test; 410 unit and integration
    tests and 154 end-to-end in total.

- **Feature 005 — Transcript reader.** The board follows Claude Code's own
  session transcript for the repository being shown, and three more sections sit
  above the reported ones: *Last prompt*, *History* and *In context*. Read-only,
  resolved from the reported repository path with no configuration, and the only
  thing on the board that survives a restart.
  - **A `user` record is not a prompt, and neither is a `user` record whose
    content is text.** Measured on a real session: **1,134** `user` records,
    **74** with text-only content, **57** actual prompts. The rest are tool
    results, skill instruction payloads, local-command echoes and interrupt
    markers. Both wrong readings are wrong quietly, and the first pass of the
    research made the second one.
  - One optional envelope field, `transcriptId`, reaching back into features 001
    and 002. The board's `sessionId` is a `randomUUID()` and a transcript's
    filename is Claude Code's own id; without the field, "the transcript for the
    session being shown" cannot be answered honestly. Derived from
    `CLAUDE_CODE_SESSION_ID`, never model-composed, and an agent that cannot
    supply one still reports successfully.
  - **Three states, never two.** `available`, `empty` and `unreadable` are a
    discriminated union from the reader to the section, and empty and unreadable
    are drawn differently — including when the section is collapsed, where the
    summary is all that is left of it.
  - **Blast radius, asserted.** A transcript that is missing, denied, replaced
    mid-session or full of rubbish costs three sections and nothing else. Every
    `node:fs` call across a full read cycle is recorded and the paths touched are
    required to be exactly one file: not the sibling session's transcript beside
    it, not the `subagents/` tree beneath it, nothing inside the repository, and
    zero writes anywhere.
  - Copying a prompt writes the stored text with no trim, no normalising and no
    re-wrapping. One platform exception, found while building: **Windows expands
    every newline to CRLF on the way to the clipboard**, because
    `CF_UNICODETEXT`'s convention is CRLF and no API puts a bare LF there.
  - The In context section departs from the design export twice, both because
    the transcript does not carry what it draws: there is no per-file token size
    anywhere in the format, and the export's teal-versus-muted distinction among
    held files has no source. Estimating either would be inventing content.
  - Two facts the research had wrong and the real data corrected before any code
    was written: `input_tokens` is *not* the context size (with prompt caching it
    is routinely `2` against 290,000 cache reads), and `system` /
    `compact_boundary` really appears — which is where the agent's context was
    thrown away and the file list has to be emptied.
  - 25 more Playwright tests and 66 more unit tests, most of them about failure
    rather than success. The fixture set exists so that "the format changed" is a
    case with expected behaviour rather than an incident.

- **Feature 004 — Overview tab.** The default view: Focus, Spec, Plan and
  Changed files, each a collapsible section whose header carries its own
  summary, so a developer with everything closed can still read the feature's
  completion, the position in the plan and the volume of change.
  - `Section` **requires** a summary, typed so neither `null` nor `undefined`
    satisfies it. A section without one fails to compile, which is what makes
    "every header answers its question" structural rather than a convention that
    decays by feature 006.
  - The status vocabulary lives in the renderer, not the contract. `done`,
    `active`, `blocked`, `todo` and their listed synonyms take signal colours;
    everything else renders grey with its text intact and no disc at all.
    Matching normalises case and surrounding whitespace and **nothing else** —
    `donee` is not `done`. The full table is in
    [`docs/design/push-schema.md`](docs/design/push-schema.md).
  - `changedFiles[].note` now has a stated meaning: *why this file wants your
    eye*. Its presence is what flags a file. The field had a cap and no
    documented purpose; the MCP tool description says so now, because an agent
    cannot use a convention nobody told it about.
  - The focus tag counts from the report, not from when the task became current.
    Tracking the latter would mean carrying state across snapshots, which is the
    merge path decision 26 refuses. A note arriving does not reset it.
  - Two departures from the design export, both content rather than look and
    feel: status text appears on **every** task row, because a disc cannot carry
    a status the board does not recognise; and there is a Focus section, which
    the export does not have, because the export marks focus only on a task row
    and that leaves the agent's prose nowhere to go.
  - 30 more Playwright tests. The one that matters subtracts every reported
    value and every *declared* derivation from the rendered text and asserts
    nothing remains — so a derived percentage or an invented count cannot be
    added later without someone writing it down and justifying it.

- **Feature 003 — window shell.** The first feature a person can see. One
  Electron window with `contextIsolation` on, `nodeIntegration` off and
  `sandbox` on, rendering identity, liveness, navigation and emptiness from the
  store in feature 001 — read once on mount, pushed to thereafter, and never
  polled.
  - `tokens.css` transcribes the round 1–3 design exports, which are canon for
    look and feel. The title bar carries the repository as well as the branch:
    the export shows only the branch, but FR-001 requires both, and decision 8
    makes this repository's docs authoritative on incidental content.
  - Elapsed time is derived at render and never stored. It stays a
    *measurement* at any duration — the board never says stalled, stuck or
    failed, because a healthy agent goes quiet for minutes during a typecheck.
  - The waiting state is a primary layout, not a fallback: nothing survives a
    restart, so it is seen on every launch. The tab strip is hidden entirely
    rather than offering four dead ends, and each tab appears only once its view
    has content.
  - 20 Playwright tests against the built app, two of them absences — nothing
    changes on a timer beyond the elapsed counter, and agent-composed markup
    renders as visible characters and executes nothing.
  - Main is bundled as CommonJS. Worth knowing for anyone who hits it: ESM
    appeared to be the problem, but the actual cause was `ELECTRON_RUN_AS_NODE`
    set in the environment, which makes `electron.exe` run as plain Node so its
    built-in module is never registered. The E2E helper strips it.

- **Feature 002 — MCP server and CLI.** `packages/clients`, published as
  `@cocopilot/mcp` and fetched by `npx`, carrying both binaries. Two thin
  clients over feature 001's contract: neither holds state, both derive
  repository, branch and session identity themselves, and both translate every
  failure into a value rather than a throw.
  - **The MCP server starts offline and stays that way through initialisation.**
    A host discovers a server's tool list once, at session start, so a server
    that probes for the board while starting leaves an agent with no reporting
    ability for the whole session — including after the board opens two minutes
    later. The test asserting zero network calls during startup and `tools/list`
    is the one worth protecting; every other test passes whether or not this
    holds.
  - Discovery accepts only a responder that names itself `cocopilot`, and
    caches nothing between calls. Nothing is queued, retried, or launched.
  - One budget per call, spent across discovery and delivery together, so five
    ports that black-hole rather than refuse still cannot exceed two seconds.
  - The CLI exits **0** when no board is running, deliberately: these run from
    hooks, and a hook failing because a dashboard was closed would be a
    monitoring tool breaking the work it monitors.
  - 193 tests. Both protected behaviours were checked for teeth by introducing
    the violation they exist to catch.

### Fixed

- **The reserved `unattributed` session id could be claimed as an agent's.** The
  service derived attribution from the absence of a session id, so a client that
  spelled the reserved string out was recorded as an agent narrating rather than
  as a script. Feature 002's plan had assumed the opposite. The service now
  refuses the claim however it arrives, and the CLI sends no id at all.
- **A 500 from the service reported itself as `invalid_json`**, sending a caller
  looking for a malformed field that was fine.

### Added

- **Feature 001 — push contract and local service.** The first product code in
  the repository. An npm-workspaces monorepo (`packages/contract`, `apps/board`)
  on TypeScript strict + Vitest, and an HTTP service bound to `127.0.0.1`
  serving `POST /v1/push`, `POST /v1/note` and `GET /v1/health` over in-memory,
  volatile per-session state.
  - `packages/contract` holds the payload schemas, every cap, the port range and
    the health guard, so the service and both clients share one definition
    rather than three that drift. Nothing in it touches the filesystem or the
    network — the published client stays free of Node-only surface.
  - `createService()` in `apps/board/src/main` is the seam feature 003 mounts in
    the Electron main process. Nothing here depends on Electron, so the suite
    runs without one.
  - 122 tests. Two of them assert *absences*: across a full exercise of the
    contract the service makes exactly one filesystem call — `statSync` on the
    reported repository path — and reads nothing beneath it. Both were checked
    for teeth by temporarily introducing the violation they exist to catch.

### Changed

- **The wire contract gained 413 and 415**, both found during implementation and
  written back into
  [`contracts/http-api.md`](specs/001-push-contract-service/contracts/http-api.md).
  A body ceiling of 1 MiB, because the per-field and per-collection caps do not
  bound a request on their own — 500 tasks each carrying 50 checks of 4,000
  characters is legal by every individual cap and still around 127 MB. And a
  required JSON content type, which is what forces a browser to preflight before
  it can reach the service cross-origin; decision 18 accepts that any local
  *process* may report, not that any page the user has open may.
- **`plan` is an array**, not `{ steps: [...] }`. The contract doc's example and
  the data model disagreed; the data model was right and the example is fixed.

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
- **Architecture doc written** — `docs/design/architecture.md`, the synthesis of
  all 27 decisions for someone who has not read them. Leads with the defining
  property, that the app reads nothing from the repo, writes nothing anywhere
  and owns no durable state, and tabulates what that removes from the build
  against what it costs. Covers the four processes and the lifetime mismatch
  that shapes them, the two information sources, the state model, and a failure
  table naming what each way of going wrong actually looks like.
- **Design round 3 landed**, delivering all three revisions plus the optional
  overflow work. A vocabulary map takes the four recognised statuses and their
  synonyms to the round 1 colours and everything else to neutral, truncated with
  the full string on hover; the focus tag counts elapsed time in place with no
  threshold or fade; session pills carry their own chip and elapsed time, with
  the branch dropping off unselected pills past two sessions and the state label
  showing only when selected or attention-seeking — a better answer to the
  density problem than the brief asked for. At 500px the body scrolls under
  sticky section headers. **The Overview Panel is now current against every
  recorded decision, and no design revisions are outstanding.**
- **Distribution decided:** the MCP server ships as an npx-able npm package,
  with the CLI alongside it. The point is code signing — Claude Code has to
  spawn the server independently of the app, and shipping that as JavaScript
  takes it out of the notarization story entirely, leaving the Electron app as
  the only thing to sign. Costs a Node dependency and an npx cold start, and
  lets the published server drift from the installed app — detectable, since the
  HTTP path is versioned and the health check already returns a version.
  **Closes the last open design question.**
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

- **All nine implementation plans written**, satisfying the plan-the-whole-set
  principle. Feature 001's plan carries the shared technical foundation the
  other eight reference: TypeScript strict, npm workspaces with a published
  client package separate from the installed app, `node:http` with no framework,
  Zod as the single source of both validation and types, Vitest and Playwright.
  Feature 002 fixes the port range at 41847–41851.
- **Transcript format grounded empirically** in feature 005's research, verified
  against a real 384 KB transcript rather than assumed — and it found a trap of
  the same class as the Spec-Kit checkbox-case finding: `type: "user"` records
  are **not** prompts. The sample held 37 of them and roughly 10 actual human
  prompts, the rest being tool results. Classification must inspect message
  content, never record type, or the board shows a developer tool output
  presented as things they typed.
- **Stack packs written** — `stacks/electron.md` and `stacks/vite-react.md`,
  owed before any framework code. Both encode the prohibitions that protect this
  product's guarantees: no data timers, no `dangerouslySetInnerHTML`, no
  `nodeIntegration`, no colour literals outside the token file. The stale
  `nextjs.md` reference in the stacks README is corrected.
- **All nine feature specs written**, each with a passing quality checklist and
  no clarification markers — every gap resolved with a documented assumption.
  Several recurring shapes emerged: the guarantees the product rests on (never
  reads the repo, never writes, never judges, never persists) are stated as
  observable absences so they can be tested rather than asserted; prohibitions
  are written as requirements, because the behaviours that would break those
  guarantees are exactly the ones a later change would add as an obvious
  courtesy; and comprehension appears as a success criterion where a
  misunderstanding would cost the user information.

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
