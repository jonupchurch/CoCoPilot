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
| Interface surfaces | ✅ MCP server + HTTP API + CLI, plus a transcript reader (decision 10) |
| Direction of flow | ✅ One-way, agent → board. Never writes to the user's repo (decision 11) |
| Architecture — state ownership | ✅ Settled 2026-08-06: the app process owns volatile state; MCP/CLI are thin clients |
| Architecture — push model | ✅ Settled 2026-08-06: typed facts + agent prose, board owns layout |
| Architecture — everything else | ⬜ Still open — the prior round's decisions are not binding |
| Design exports (`resources/`) | ✅ Round 1 landed — Brand, Design System, Overview Panel (4 tabs); canon for look and feel per decision 8 |
| Design revisions owed | 🟡 Brief written — [`resources/designprompt2.md`](resources/designprompt2.md); needs a Claude Design run |
| Design docs (`docs/design/`) | 🟡 `push-schema.md` drafted, awaiting review; nothing else written |
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
   question 5.
8. **The `resources/` designs are canon for look and feel; this repo's docs win
   on everything else.** Palette, type scale, spacing, radius, elevation, panel
   chrome, layout and component shapes come from the design exports and are
   followed as given — that is the whole point of having them. Where a design's
   *incidental content* — sample IDs, sample thresholds, fixture text — conflicts
   with the grounding and decisions recorded here, the documentation wins and
   that part of the design is read as illustrative rather than prescriptive.
   - *Resolved by this rule, out of the 2026-08-06 design review:* the mock's
     hyphenated `T-011` / `US-002` IDs give way to the real bare and bold `T001`
     forms in the grounding above; the "stalled step older than 60s" acceptance
     criterion gives way to decision 15, which rejects thresholds entirely;
     and the fixture's mixing of CoCoPilot's own features with a generic sample
     app gets separated per the notable wrinkle below.
   - *Not resolved by this rule:* cases where two design files contradict each
     other, or where a design shows data that no decided source can supply. The
     rule cannot arbitrate those, because the conflict is not between a design
     and the docs. Both instances raised by the design review were settled
     directly instead — decisions 10 and 11.
9. **Panel width is stable and user-owned.** The window keeps its width when the
   user switches tabs; only a deliberate resize changes it. The mock's jump
   between 452px on Overview/Notes and 880px on Stories/Tasks is mock
   convenience, not intended behaviour.
   - *Consequence:* Stories and Tasks are drawn as master–detail at 880px, so
     they need a defined behaviour at narrow widths — detail stacks under the
     list, or the list collapses to a picker. The designs do not cover this yet
     and owe a revision.
10. **Claude Code's own session transcripts are the source for prompt, history
    and context.** The app tails `~/.claude/projects/<slug>/*.jsonl`, which
    Claude Code already writes per project directory, to feed the Overview tab's
    *Last prompt*, *History* and *In context* sections. This is observed data,
    not agent-claimed, so it also does most of the work of the honesty question
    below.
    - *Fits decision 6 rather than fighting it:* transcripts join repo files as
      truth on disk that we re-read and never store. History therefore survives
      an app restart, which removes the "Show all 18 but the list is empty"
      dishonesty the design review flagged, and the board can show what happened
      while it was closed, because the transcripts were being written anyway.
    - *Free consequence:* the transcript directory is named from a slug of the
      project path, so a pushed repo path resolves to exactly one transcript
      folder with no configuration. Decision 13 supplies the path.
    - *Cost:* the format is undocumented and can change without notice, so the
      reader has to be defensive and degrade to "no transcript data" rather than
      break the board. Prompt text is also the most sensitive thing on screen —
      a privacy surface we did not previously have.
    - *Does not replace the push.* A transcript is raw conversation; the push is
      the agent deliberately curating a status for a human. Decision 6's build
      order stands.
    - *Tailing is live and continuous*, and this is consistent with decision 12
      rather than an exception to it — the app follows the file the AI writes,
      and never watches the repository or git. See decision 12.
11. **Data flows one way: agent → board. The board never talks back.** Nothing
    in the UI sends anything to the agent or writes to the user's repository.
    - *Removes from scope:* the Design System's "Ask about this file…" input,
      Apply / Skip, Re-read / Discard, and "Open in Claude". Those controls stay
      in the design as the visual reference for button, input and chip styling —
      decision 8 still governs look and feel — but no product surface uses them.
    - *Closes the older question* of whether CoCoPilot ever writes to the user's
      repo: it does not, which restores the "add-on, not source of truth"
      honesty the previous round had.
    - *Still allowed,* because none of it reaches the agent: collapsing a
      section, expanding a past prompt, copying one to the clipboard, resizing,
      and tearing a view into its own window.
12. **The AI drives updates. The window never refreshes itself.** The board does
    not poll, does not watch the repository for changes, and does not re-scan on
    a timer. What is on screen changes because the agent caused it to change.
    - *Consequence:* the screen is explicitly a snapshot as of the last update,
      not a live mirror of the working tree. Editing a file by hand, or running
      git outside the agent, does not move the board. That is a feature — it
      shows what the *agent* believes and did — but it makes decision 15
      load-bearing, because the human needs to see how stale the picture is.
    - *Consequence:* the design's fine-grained activity — a progress bar,
      "reading src/api/client.ts", "editing src/hooks/useSession.ts" — is only as
      fresh as the last update. Either the agent updates often enough to sustain
      it, or those elements need to read as last-known rather than live.
    - *Supersedes* the file-watching mentioned in passing in decision 3's
      rationale. Electron's Node main process is still where this lives; it just
      is not watching anything.
    - *Section priority, stated 2026-08-06:* **Changed files matters least** of
      the Overview sections. That conveniently defuses most of the staleness
      cost above — the git-derived section is the one that would most want
      watching, and it is the one we care about least. Weight *Last prompt*,
      *History*, *In context*, *Spec* and *Plan* above it when they compete for
      space or for effort.
    - *Resolved:* following the transcript **counts as the AI updating the
      board**, not as the window refreshing itself, because the transcript is
      written by Claude Code. The distinction that matters is *whose* file the
      app follows: the one the AI writes, yes; the repository and git, no. So
      the Overview activity sections stay live without requiring a push per tool
      call, which would otherwise be the only way to sustain the design's
      "reading src/api/client.ts" state.
13. **No user-facing repo selection. The board follows what the AI declares.** A
    push carries its own repo and branch, and the board renders whatever it is
    told about. There is no folder picker, no watch list, and no per-repo
    configuration step.
    - *Consistent with decision 12* — the AI drives the board, including what
      the board is even looking at.
    - *Consequence:* the design's title bar, showing a repo and
      `feat/session-hook` beside the Watching chip, is pushed data rather than
      user-chosen state. It changes when the agent says it changed.
    - *Consequence:* this supplies the trigger decision 10 was missing. The
      pushed repo path resolves to the transcript directory by slug, so the
      board knows which transcript to follow without being told separately.
    - *Consequence:* a board with nothing pushed to it yet has no repo and
      nothing to show, so an empty state is now a real screen the designs do not
      cover. Added to the revisions owed.
14. **One window. A session switcher appears only once a second session
    declares itself.** The board holds every declared session. With one — the
    common case — the chrome is exactly as designed and there is no picker at
    all. A second declared repo makes a switcher appear.
    - *Not a contradiction of decision 13:* the user is not choosing what to
      watch, only which of the sessions the AI already declared to look at.
    - *Settles the shape:* one process, one main window. The tear-off `+` still
      spawns extra windows for individual sections, which is a separate axis and
      unaffected.
    - *Design revision owed:* the switcher chrome does not exist in the exports,
      and by construction it has to be invisible at one session and present at
      two, which is not a state the designs currently show.
15. **Liveness is elapsed time. The board never renders a verdict.** It shows
    "last heard from 4m ago" and nothing more — no thresholds, no automatic
    state change, no colour shift. A healthy agent goes quiet for minutes during
    a typecheck, so any threshold is a guess about work the board cannot see.
    Elapsed time is a fact; "stuck" is a guess.
    - *Kills outright* the previous round's 45s/3m thresholds and the design
      fixture's "stalled step older than 60s" criterion, which decision 8 had
      only deferred.
    - *Consequence:* the design's four status chips — Idle, Watching, Thinking,
      Needs you — are driven by pushes and transcript activity, never by a timer.
      The board does not move a chip on its own. "Needs you" in particular is
      only ever a state the agent pushes, which is the sole way it can ask for
      attention under the one-way rule.
    - *Cost, accepted:* a genuinely hung agent looks exactly like a slow one.
      The human does the judging, which is the point.
16. **The board does not reconcile the transcript against the push.** Pushed
    status drives the task, spec and plan views; the transcript feeds only the
    three sections it was adopted for — *Last prompt*, *History* and *In
    context*. The two are never compared, and no disagreement between them is
    computed or displayed.
    - *Closes the honesty question by declining it rather than solving it.* The
      board reflects what the agent reports. Accepted cost: the one unfakeable
      check available to us goes unused, so an agent that reports inaccurately
      is displayed inaccurately.
    - *Upside, and it is a real one:* it keeps the transcript reader a narrow,
      well-scoped component with three consumers instead of a source of truth
      threaded through the whole app. That directly limits the blast radius of
      decision 10's main cost — when the undocumented format shifts, three
      display sections degrade and nothing else does.
    - *Consistent with the product definition:* an observer that keeps
      information straight, not an auditor that grades the agent.
17. **Sessions clear on app restart, and the user can dismiss one.** Volatile
    state means a restart empties the switcher for free; a dismiss control on
    each entry handles the long working day. No timers and no automatic
    eviction, per decision 15.
    - *Allowed under decision 11* because dismissing touches only the board and
      never reaches the agent.
    - *Defined behaviour, which follows from decision 13:* dismissing is not
      muting. If a dismissed session pushes again it reappears — the AI decides
      what is on the board, and a dismiss that suppressed future pushes would
      take that back.
    - *Design revision:* folds into the switcher revision already owed, rather
      than adding a separate one.
18. **The HTTP API binds to `127.0.0.1` and nothing else.** No auth, no TLS, no
    remote access. Everything decided so far is local — the app, the MCP server
    Claude Code spawns, the CLI, the transcript files — so nothing needs a
    network hop.
    - *Drops* the previous round's "local-first, remote-ready" intent
      deliberately. Watching a board from a second machine is not possible
      without reopening this.
    - *Localhost is not a trust boundary.* Any local process can reach the API,
      so pushes still get validated per rule 2 of `AGENTS.md` — being on the box
      is not authorization. The blast radius is small given decisions 11 and 16
      (nothing is written to the repo and nothing is reconciled), but "small" is
      not "none": the realistic abuse is putting misleading text on the board.
19. **A task has two states, and they come from the file.** Checked or
    unchecked, read from `tasks.md`. There is no *active* and no *blocked* in the
    data model; the agent's prose carries what is actually happening.
    - *This is an explicit, informed override of decision 8*, taken knowing the
      cost: the designs render four task states, and the blue active dot and
      ember blocked treatment in the Stories, Tasks and Spec views are dropped.
      Those views owe a design revision down to two states. Decision 8 still
      governs everything else about how they look.
    - *Scope — this is about tasks only.* The panel-level status chips (Idle,
      Watching, Thinking, Needs you) are session state, still pushed, still
      governed by decision 15. The Plan section's live "editing …" line is
      likewise unaffected. Do not over-apply this to them.
    - *Consistency win:* task state now comes entirely from disk, so unlike a
      push-supplied state it survives a restart and cannot drift from the repo.
      That aligns tasks with decision 6's re-read-never-store pattern.
    - *Known inaccuracy, accepted:* the grounding found struck-through,
      explicitly-dropped tasks that are still `[X]`. Under two states those count
      as done, so a "2 of 4 done" summary can overcount. Revisit if it bites.
    - *Shrinks the push considerably.* With status coming from the file, a push
      no longer carries task status at all — it carries session identity (repo,
      branch), which task is current, the prose, and the session chip. That is
      most of open question 1.
20. **Notes holds agent-written notes: what the user asked to be stored, and
    what the agent judges worth adding.** The user does not type into the board —
    they tell the agent, and the agent pushes. That keeps Notes inside the
    one-way rule (decision 11) and inside "the AI drives the screen"
    (decision 12) rather than making it the one place the board takes input.
    - *New in the schema:* Notes accumulate, where a status push replaces. This
      is therefore a second kind of push — an append — not a field on the
      existing one. See [docs/design/push-schema.md](docs/design/push-schema.md).
    - *Volatile like everything else,* per decision 21. Notes clear when the app
      closes, and the UI must not imply otherwise.
21. **CoCoPilot owns no durable state. It is a display panel.** Nothing the app
    holds survives closing it — not narration, not notes, not the session list.
    Everything on screen is either re-derived from disk (repo files, git,
    Claude Code transcripts) or was pushed since launch. Decision 6 is absolute,
    with no carve-outs.
    - *Where durability actually lives:* the user asks the **agent** to write it
      into the repository with the agent's own file tools. That is the agent
      doing what it always does, not CoCoPilot writing — decision 11 is
      untouched — and the result is a file the user owns, reviews and commits,
      which is a better home for anything worth keeping than an app database
      would be.
    - *Consequence for the UI:* nothing may imply permanence. No "saved" state,
      no archive, no history presented as reaching further back than this
      launch. Where the board shows accumulated things — notes, the session
      list — it should read as this-session, because that is what it is.
    - *Consequence for the build:* no database, no migrations, no storage format
      to version, and no corrupt-state recovery path. This is a substantial
      amount of work that simply does not exist.

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

**Nothing else.** `resources/` was emptied on 2026-08-06. The round 1–3
wireframes and design prompts from the previous round are gone; the exports now
in `resources/` are the *new* round, landed the same day.

## Open questions

Ordered roughly by how much downstream work each one blocks.

1. **The push schema** — drafted in
   [docs/design/push-schema.md](docs/design/push-schema.md), **awaiting review**.
   Three open points remain inside it: how `sessionId` works for a push that is
   not from an MCP server process, what the board shows when a push names a
   feature it has not scanned, and how the MCP server discovers the app's port.
2. **Packaging and distribution** per platform, including code signing.
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
