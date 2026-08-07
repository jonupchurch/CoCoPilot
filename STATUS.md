# Status

**Project:** CoCoPilot (as in *Co-Copilot*) — a tool to help a developer keep
information straight while working with Claude on a GitHub Spec-Kit repository.
An MCP server + local API + desktop board: agents report what they're working
on, a human watches.

**Phase:** Implementation. Design is settled (31 decisions below), all nine
features are specced and planned, and features 001 through 004 are built and
verified. Rule 7 is satisfied, so the remaining five are ordinary feature work.

**Last updated:** 2026-08-07 (features 001–004 implemented)

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
| Architecture — everything else | ✅ Settled across decisions 1–31; no open design questions remain |
| Distribution | ✅ MCP server and CLI via npx; only the Electron app needs notarizing (decision 27) |
| Design exports (`resources/`) | ✅ Round 3 landed — Overview Panel current against every UI-affecting decision; canon per decision 8 |
| Design revisions owed | ✅ None outstanding |
| Design docs (`docs/design/`) | 🟡 `architecture.md` + `push-schema.md` drafted, both awaiting review |
| Feature specs (`specs/`) | ✅ All nine written, each with a passing quality checklist |
| Implementation plans | ✅ All nine planned; constitution check passes with no violations |
| Stack packs (`stacks/`) | ✅ `electron.md` + `vite-react.md` written, owed before framework code |
| Implementation | 🟡 **Started** — features 001–008 complete and merged; **009 (packaging) is all that remains** |

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
19. ~~**A task has two states, and they come from the file.**~~ **Superseded by
    decision 24**, which removed the file as a source. Kept for the reasoning
    trail; the state set is re-decided in decision 25. Original text follows.

    Checked or
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
22. **Port discovery is a fixed port plus a documented fallback range,** resolved
    by a health check. The app claims the fixed port and walks up a short range
    if it is taken; the MCP server and CLI probe the same sequence and use the
    first that identifies itself as CoCoPilot. Nothing is written to disk, which
    keeps this consistent with decision 21.
    - *The health check must identify us specifically.* Probing a range means
      knocking on ports owned by unrelated local software, so a client that
      treats any 200 as success would POST prompt text and file paths into some
      other program. Match on the payload, never on the connection succeeding.
    - *Degrades into an already-handled case:* nothing in the range answering
      means the board is not running, which decision 6 already covers.
23. **Pushes with no MCP server process behind them share one "unattributed"
    session per repo,** labelled in the UI as a script or hook rather than
    presented as an agent. Hooks and scripts have no process whose lifetime maps
    to a session, and generating an id per invocation would fill decision 14's
    switcher with one-shot entries — a hook firing per tool call would create a
    session per call.
    - *Accepted cost:* two unrelated scripts in one repo are indistinguishable.
    - *Honest labelling matters here.* An unattributed push is not an agent
      narrating, and showing it as one would misrepresent where the information
      came from — the thing decision 16 already declined to police.
24. **The app never reads the user's repository. The agent pushes everything.**
    No `tasks.md` parsing, no `specs/` walk, no `.specify/feature.json`, no git.
    Stories, tasks, acceptance criteria, titles, states and file lists all
    arrive by push. The board is a renderer of what it is told.
    - **Supersedes decision 19.** Task state came from the file because the file
      was the only source; with nothing read from disk, state returns to the
      push. The two-state limit was a consequence of the checkbox, and that
      constraint is gone.
    - *Amends decision 6.* The "two kinds of state, only one is ours" split no
      longer includes repo files. What the board shows is now entirely pushes
      plus the Claude Code transcript. Nothing is re-derivable from the
      repository, so after a restart the board is empty until the agent pushes
      again — which makes the empty state a routine screen rather than a
      first-run one.
    - *Moves the Spec-Kit grounding from us to the agent.* The `- [x]` versus
      `- [X]` trap, bare versus bold task IDs, tasks nesting under `###` — none
      of that is our parser's problem any more, because we have no parser. It
      becomes guidance for the agent-side tool and its prompt. The findings are
      no less true; they just apply somewhere else now. See below.
    - *Makes decision 16 trivially true.* There is nothing to reconcile the
      transcript against, because there is no independently-read source left.
    - *Cost, accepted:* a much larger payload, and the board can only be as
      correct as the agent is. An agent that stops pushing leaves a board frozen
      at its last word, with no ability to notice the repo moved underneath it.
    - *Not affected:* the Claude Code transcript (decision 10). That is not the
      user's repository, and decision 12 already established that following the
      file the AI writes is the AI updating the board.
25. **Task status is a free string, not an enum.** The agent sends whatever
    describes the task, and the board renders it. Chosen knowing the costs: two
    sessions can describe the same situation differently, and there is no
    guaranteed mapping from a status to a signal colour.
    - *Loosens decision 7 for this one field.* "The schema fixes the skeleton"
      still governs everything else — `repo`, `branch`, `sessionId` and the task
      identifier stay typed and validated. The free-form set is now status,
      the status note, and a note's text.
    - *Derived, not asked — correct this if it is wrong:* the board keeps a
      recognised-value table (todo, active, blocked, done, and the obvious
      synonyms) mapped to the design's colours, and renders anything else in the
      neutral muted grey. It is the only way to honour both this decision and
      decision 8 — an arbitrary string cannot be assigned a signal colour, but
      the common case should still look exactly like the design.
    - *Changes the design brief.* Revision 1 in `resources/designprompt2.md`
      flips from "cut tasks to two states" to "states are open-ended: render the
      recognised set as designed, and define the unrecognised fallback."
26. **Every push is a full snapshot and replaces what the board holds.** No
    deltas, no merging. The agent sends the complete current picture for its
    session each time it reports.
    - *Rationale:* idempotent and self-healing. A dropped, duplicated or
      out-of-order push costs nothing, because the next one is authoritative.
      That matters more than usual under decision 24, where there is no repo
      read left to correct a board that drifted.
    - *Preserves decision 6's replace semantics* rather than introducing
      accumulated state built from a sequence.
    - *Cost:* a larger payload per call, and the agent must hold or rebuild the
      whole picture in order to resend it — real context and time cost on every
      update. The agent-side tool should be efficient about reconstructing it.
    - *Notes remain the single exception,* and now the only one: they append
      where everything else replaces (decision 20). Folding them into the
      snapshot would force the agent to carry every note it has ever written
      just to add one.
27. **The MCP server ships as an npx-able npm package** — `.mcp.json` runs
    `npx -y @cocopilot/mcp`. The CLI ships the same way, most likely as a second
    binary in the same package.
    - *The real win is code signing.* Decision 6 requires something Claude Code
      can spawn independently of the app, and shipping that as JavaScript takes
      it out of the signing and notarization story entirely. The Electron app
      remains the only thing to notarize, instead of also having to cover a
      binary launched outside its own startup.
    - *Matches convention,* so it configures the way every other MCP server the
      user already has does, and works identically on all three platforms with
      no per-platform path to get wrong.
    - *Cost:* Node has to be present, there is an `npx` cold start per session,
      and the published server can drift from the installed app.
    - *Drift is detectable, not silent.* The HTTP path is versioned (`/v1`) and
      decision 22's health check already returns a version, so a mismatched pair
      can say so rather than failing obscurely. Worth building in from the
      start — it is nearly free then and awkward to retrofit.
28. **The window is notified in-process when held state changes.** It does not
    poll, and there is no streaming connection. The service and the window are
    in the same application, so state notifies the window directly.
    - *Rationale:* immediate updates, nothing running while idle, and no
      interval to tune — which matters for a panel left open all day. It also
      keeps the "window never refreshes itself" rule clean: nothing fires on a
      timer at all, rather than a timer we have to argue is a different kind.
    - *Cost:* couples the window to an in-process service. A remote window would
      need a second mechanism — accepted, since decision 18 already ruled remote
      viewing out.
    - *Left open by the specs on purpose,* and decided here before planning so
      that features 1 and 3 through 8 do not each assume something different.
29. **A request body is capped at 1 MiB, checked before parsing.** Found while
    implementing feature 001, not on paper. The per-field and per-collection
    caps do not bound a request on their own: 500 tasks each carrying 50 checks
    of 4,000 characters is legal by every individual cap and still roughly
    127 MB, and 100 sessions of that is 20 GB. The spec's edge case claiming
    "collection caps bound the total" was simply not true until this existed.
    - *Cost:* a report that is legal by every individual cap can still be
      refused for total size. It answers 413 naming the ceiling, so the caller
      can act on it, and 1 MiB is around ten times a realistic full report.
    - *Where it lives:* `MAX_BODY_BYTES` in `packages/contract`, alongside every
      other cap, so a client can refuse before a round trip.
30. **The service requires `content-type: application/json`, answering 415
    otherwise.** Decision 18 accepts that any local *process* may report — being
    on the box is not authorization, and the blast radius is misleading text.
    It does not follow that any web page the user happens to have open may
    report. Requiring a content type that is not CORS-simple forces a browser to
    preflight, and nothing here answers a preflight.
    - *Cheaper than the alternative:* the same hole could be closed by checking
      the `Origin` header, but that is a header check, and decision 18 is
      explicit that the localhost guarantee is a bind address rather than a
      header.
    - *Cost:* a client shelling out with `curl` must remember the header. The
      CLI and MCP server set it, so this only bites hand-written probes.
31. **The clients read `.git` directly; they never run `git`.** Found while
    implementing feature 002. `contracts/client-surface.md` had said to derive
    the repository from `git rev-parse --show-toplevel`, but feature 002's
    FR-011 forbids the clients from launching "the desktop application **or any
    other process**", and its US3 says "nothing is launched — no window opens and
    no process starts". FR-018 permits *determining the path and current branch*
    without saying how.
    - *Also cheaper and more available:* no process spawn on a path SC-003
      bounds at two seconds, and no assumption that `git` is on `PATH` — which
      the MCP server, launched by a host rather than by a shell, cannot make.
    - *Cost:* we reimplement a small slice of git — walking up for `.git`,
      resolving the `gitdir:` worktree pointer, reading `HEAD`. Any repository
      layout those three do not cover reports `unknown` rather than being
      correct. Accepted; the alternative was a subprocess per call.
    - *Consequence:* a detached HEAD reports the abbreviated commit rather than
      the literal `HEAD` that `git rev-parse --abbrev-ref` returns, because
      `HEAD` in a board's branch slot reads as a bug rather than as information.
32. **The envelope carries an optional `transcriptId`, derived from
    `CLAUDE_CODE_SESSION_ID`.** Found while implementing feature 005. The
    board's own `sessionId` is a `randomUUID()` minted by the client process; a
    transcript's filename is *Claude Code's* session id. They are unrelated, so
    "the transcript for the session being shown" — which FR-016 requires — could
    not be answered at all from what the board held.
    - *Reaches back into features 001 and 002*, which is why it was raised as a
      decision rather than appearing in a diff. One optional field, capped as a
      `Label`, defaulting to null, populated from the environment and never
      model-composed — the same treatment as `repo` and `branch`.
    - *Cost:* an agent that is not Claude Code supplies nothing, and the reader
      falls back to the newest `.jsonl` in the project directory. That is right
      whenever one session is running in a repository and capable of picking a
      sibling's file when two are. Stated as the heuristic it is.
    - *Also a trust boundary:* the contract checks only a `Label`'s length, so
      `../../../etc/passwd` is a legal value. The id is refused unless it is
      plainly filename-shaped, rather than sanitised — a repaired path is a
      guess about what the caller meant.
33. **Unavailable is a third state, not an empty one.** `available | empty |
    unreadable`, as a discriminated union carrying the value on the first arm
    only, from the reader all the way to the section. A section drawn as though
    it had nothing to show, when in fact it could not read its source, presents
    a failure as a confident answer — and it is the *worst* direction to be
    wrong in.
    - *Cost:* every consumer narrows before it can reach a list, and three
      display states exist where two would have done.
    - *Consequence:* the distinction has to survive collapsing, where the body
      is unmounted and the header summary is the whole section. It does.
    - *Not the ember tint.* `--ember` is attention and `needs-you` and nothing
      else, and a transcript is unreadable for every agent that is not Claude
      Code — tinting it would light a standing alarm for a state that is normal
      in those sessions.
34. **"Show all N" expands the list in place.** Design round 2 recorded that the
    export's "Show all 18" had no destination. There is no history *view* to
    send anyone to, and building one would be a second place to read the same
    thing; the section is already collapsible, so a long list closes the way
    everything else on the tab does.
    - *Cost:* a very long history is a very long section until it is closed.
35. **The board shows what the transcript says and estimates nothing.** The
    design export draws a per-file token size in the In context section. That
    number exists nowhere in the format, and the only way to produce one would
    be to estimate it — which is inventing content (FR-016), in a section whose
    whole value is being trustworthy about what the agent actually has.
    - *Consequence:* the slot carries what touched the file instead, which the
      transcript does say. The export's teal-versus-muted distinction among held
      files goes the same way: no visible rule, no source, so every held file
      gets the same disc and only the running one is marked.
    - *Cost:* two visible departures from an export that is otherwise canon.

## What survives the restart

**The Spec-Kit format grounding.** Verified against `../LMNTLZ` (21 features,
1,076 task lines, Spec-Kit 0.12.12.dev0). This is empirical evidence about what
real Spec-Kit files look like, not an architecture opinion, so it holds
regardless of what gets built.

> **Whose problem this is changed.** Decision 24 removed our parser — the app
> never reads the repository. These findings now apply to the **agent-side**
> tool and its prompt, which is what actually reads `tasks.md` and pushes
> normalised data. Every trap below is still a trap; it just gets sprung
> somewhere else. Anything we ship that tells an agent how to read Spec-Kit
> files needs this list.

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

## Design round 2

Landed 2026-08-06 against [`resources/designprompt2.md`](resources/designprompt2.md):
a revised Overview Panel plus a `CoCoPilot Round 2` decisions doc. It delivered
all six revisions — open-ended widths breaking master–detail at 640px, a session
row that slides in only at two sessions, dismiss that erases the board's copy
alone, an empty state that says waiting rather than welcome, Notes as an
explicitly impermanent transcript, and a Design System section retitled to what
the board actually shows.

**One decision in it is superseded.** Round 2 ran before decisions 24 and 25, so
its decision 01 — "a task is done or not done, because a Spec-Kit checkbox
carries one bit" — is built on a source we no longer read. The export implements
it literally: `statusColor(s) { return s === 'done' ? teal : grey }`.

The revision this needs is narrower than it looks. Round 2's decision 02 —
separating *which task is being worked on* (a `focus` flag, teal left rule, mono
`now` tag) from *what state it is in* — is exactly the right split, and it
survives untouched. Arbitrary status strings need it more, not less. What round
3 owes is only the status rendering: arbitrary text in the row, the recognised
values (todo, active, blocked, done) carrying the round 1 colours, and a defined
neutral fallback for everything else.

### Round 2's own open questions — all five ruled on, 2026-08-06

Three defaults accepted as written, two changed:

1. **The `now` marker carries its own elapsed time** — `now` becomes `12m` as
   time passes. **Changed** from round 2's "mute the tag after ten minutes",
   which was a threshold and an automatic state change, the exact thing decision
   15 rules out. A tag that states elapsed time is a fact and cannot be wrong at
   any duration, so it needs no threshold. The teal rule stays either way: where
   the agent was last seen is real information.
2. **The board follows the selected session, and session pills carry their own
   chip and elapsed time.** **Extended** from round 2's default, which left a
   hole: decision 15 makes the chip the only way an agent can ask for attention,
   so a `needs-you` on an unselected session would be an ask that never arrives.
   No merged view — round 2's reasoning against interleaving two repos holds.
3. **Pills sit in order of declaration**, not recency. Accepted as proposed.
   Matters more now that pills carry live state and get glanced at rather than
   read — position becomes stable enough to learn.
4. **Dismiss keeps `×`**, with "clears this board's copy" in the tooltip.
   Accepted as proposed, including round 2's own note that this is thin cover.
   The fallback if it confuses in use is a text "hide" button, not an undo —
   there is no state to undo into.
5. **Notes gets a muted dot, no count.** Accepted as proposed. A count would
   imply an inbox to zero out, and notes clear themselves when the window
   closes.

## Design round 3

Landed 2026-08-06 against [`resources/designprompt3.md`](resources/designprompt3.md).
Delivered all three revisions, plus the optional item. **The Overview Panel is
now current against every decision in this file.**

- **Status is a string.** A `vocabulary` map takes `done`, `active`, `blocked`
  and `todo` plus synonyms (`wip`, `in progress`, `stuck`, `shipped`, `not
  started`…) to the round 1 colours; `kindOf()` returns `other` for anything
  else, which renders neutral grey, truncated at 104px with the full string on
  hover. Exactly the shape decision 25 asked for. The fixture carries
  `waiting on CI` as a live example of the fallback.
- **The tag counts.** `now` while the agent's latest report names that task,
  then `4m`, `2h` — same slot, tabular figures, right-aligned, no threshold and
  no fade.
- **Pills carry state,** and the density problem got a better answer than the
  brief asked for: past two sessions the branch drops off unselected pills, and
  the state label shows only when a pill is selected *or* needs attention. An
  unselected `needs you` takes an ember dot, border and tint, with no motion and
  no reordering.
- **Overflow,** taken up though it was optional: at 500px the body scrolls under
  sticky section headers, so a section's label and summary stay legible while
  its contents pass behind.

Two small notes, neither worth a round of its own:

1. `statusText()` lowercases the status for display, so `Waiting on CI` renders
   as `waiting on ci`. Defensible as visual consistency in a mono column, but it
   is a small deviation from decision 25's "shown as-is". Live with it unless
   an agent's casing turns out to carry meaning.
2. The fixture still uses hyphenated `T-011` and `US-002`. Already governed by
   decision 8 — real files carry bare `T001` and bold `**T001**` — so this is a
   note for whoever builds it, not a design change.

**No separate decisions doc this round;** the annotations live in the panel
margin instead. Fine for a round this size, but it means round 3 produced no new
open questions and no "not designed yet" list of its own.

### Still not designed, carried from round 2

Overflow is now done, and so is **Notes drawn at six entries rather than
forty** — closed by feature 007. The answer turned out not to be a layout: the
rows are flat and unbounded, the list scrolls with the footer pinned beneath it,
and what makes forty survivable is the density (three lines, no container) plus
scroll anchoring holding the reader's place as new ones land above them. 300
notes are asserted scrollable with the oldest still legible.

What remains: the torn-off window beyond the `+` affordance; and the agent going
away mid-session — process exit or socket drop — as distinct from merely being
quiet. The second is now the more interesting of the two: with feature 008 the
board holds several agents at once, and "gone" versus "quiet" is a distinction
the switcher has no way to draw. It stays refused rather than guessed, which is
the same answer the product gives everywhere else, but it is refused for more
sessions than before.

**Feature 008 corrected its own plan.** The plan's density rule — the branch
drops from unselected pills past two sessions — breaks FR-005 for a case the
spec names in its own edge cases: two sessions in the same repository on
different branches become two identical pills. The branch now survives wherever
a repository name is not unique. Worth noting as a pattern rather than an
incident: this is the third feature running where walking the quickstart at the
end turned up something the plan had wrong.

Feature 006 closed one item that was not on this list because the export did
not raise it: **there is no unassigned scope anywhere in the design.** The
export assumes an agent's story/task graph resolves, and nothing validates that
it does — a `storyId` may be null or name a story that was never sent. Both
detail views now carry a real, selectable scope for those tasks, designed
rather than transcribed.

The prompt-history half of "long sessions" is closed by **decision 34**: "Show
all N" expands the list in place, so it has a destination. Notes still does not,
and is feature 007's to answer.

## The initial feature set

Sliced by component, 2026-08-06. Rule 7 says all nine get specced before any is
implemented, so that shared models and cross-feature dependencies surface on
paper rather than mid-build. Build order is roughly the numbering.

| # | Feature | Covers |
|---|---|---|
| 1 | Push contract and local service | `POST /v1/push`, `/v1/note`, `/v1/health`; in-memory per-session state; validation; snapshot-replace and note-append semantics |
| 2 | MCP server and CLI | The npx package, both thin clients, lazy connection, port discovery, fail-soft messaging |
| 3 | Window shell | Electron app, one window, title bar with repo/branch/elapsed/chip, tab strip, empty state, stable user-owned width |
| 4 | Overview tab | The pushed sections — Spec, Plan, Focus, Changed files — with collapsible headers carrying their own summaries |
| 5 | Transcript reader | Tailing `~/.claude/projects/<slug>/*.jsonl`; Last prompt, History, In context |
| 6 | Stories and Tasks tabs | Master–detail, the 640px breakpoint, free-string status rendering with the recognised-value vocabulary |
| 7 | Notes | Append endpoint, the list, the impermanence footer, the unread dot |
| 8 | Multiple sessions | Switcher appearing at two, pills carrying chip and elapsed, dismiss |
| 9 | Packaging and distribution | Per-platform installers, macOS notarization, publishing the npx package |

**Known cost of this slicing:** features 1, 2 and 5 deliver nothing a user can
see. Their specs need acceptance criteria that are *testable* rather than
*observable* — a push with an over-long note is rejected, a client with no board
running gets the documented message — or they will read as unfalsifiable.

## Open questions

Ordered roughly by how much downstream work each one blocks.

1. **The push schema** — drafted and then rewritten for decisions 24–26 in
   [docs/design/push-schema.md](docs/design/push-schema.md), **awaiting review**.
   All three of its original open points are now decided (23, 22, and 24
   respectively). What is left is review, not unknowns.
2. **Packaging the Electron app** per platform. The *design* question here is
   closed by decision 27 — the spawnable piece ships via npx and is out of the
   signing story. What remains is ordinary build work: installers for Windows,
   macOS and Linux, and macOS notarization for the app itself. Well-trodden, and
   not a thing to decide on paper.

## Notable wrinkle

This repo both *uses* Spec-Kit and is *about* Spec-Kit. Our own `.specify/` and
`specs/` are real tracked state, while the app being designed reads those same
structures in *other* repos. Keep the two roles distinct in specs and fixtures.

## Working agreements

The nine rules in [AGENTS.md](AGENTS.md) govern (auto-loaded via [CLAUDE.md](CLAUDE.md));
[MANIFEST.md](MANIFEST.md) is the routable catalog of toolkit assets. Relevant
here: **rule 7** — plan the whole initial feature set before implementing any of
it; **rule 9** — feature work on a feature branch, not `main`.
