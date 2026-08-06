# Feature Specification: MCP Server and CLI

**Feature Branch**: `002-mcp-server-cli`

**Created**: 2026-08-06

**Status**: Draft

**Input**: The two thin clients that wrap the local service — an MCP server Claude Code spawns per session, and a CLI for hooks and scripts. Distributed together so no per-platform path or binary is involved. Must start cleanly whether or not the board is running, connect lazily per call, locate the board by probing a documented address range and confirming its identity, and fail soft with a message that tells an agent to carry on rather than retry.

## Context

Feature 001 holds state; this feature is how anything reaches it. Both clients
are thin: they derive session identity, forward what the agent composed, and
report back what happened. Neither holds state of its own.

The actors are the **reporting agent**, which calls tools without leaving its
own workflow, and the **automation author**, who wires a hook or script.

The single hardest constraint comes from how Claude Code works: **an MCP
server's tool list is discovered once, when a session starts.** A server that
refuses to start because the board is closed leaves its tools missing for that
entire session — including after the board is opened two minutes later.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An agent reports without leaving its workflow (Priority: P1)

An agent working in a repository calls a tool to say what it is doing and to
record a note. It supplies only what it composed — which task, what is
happening, whether it needs attention, note text. Everything identifying the
session is filled in for it.

**Why this priority**: This is the path essentially every report takes. If it
does not work, the product has no input.

**Independent Test**: With a board running, have an agent call the reporting
tool with only content, then confirm the board holds a session identifying the
correct repository and branch that the agent never supplied.

**Acceptance Scenarios**:

1. **Given** a board running and an agent session in a repository, **When** the
   agent calls the reporting tool with content only, **Then** the board holds
   that report against the correct repository and branch.
2. **Given** the same, **When** the agent calls the note tool, **Then** the note
   is added to that session.
3. **Given** an agent that supplies no session identity, **When** it reports,
   **Then** the client supplies a consistent identity for the life of the
   session, so successive reports update one session rather than creating many.
4. **Given** two agent sessions in the same repository, **When** both report,
   **Then** the board holds two distinct sessions.
5. **Given** a successful report, **When** the tool returns, **Then** it
   confirms delivery without returning content the agent must act on.

---

### User Story 2 - The tools are available even when the board was closed at startup (Priority: P1)

A developer starts an agent session before opening the board. The reporting
tools are present in the agent's toolset anyway. When the board is opened later,
reports begin working immediately, with no restart of anything.

**Why this priority**: Equal to P1 above because it is a *precondition* for it.
The tools existing only when the board happened to be open first would make the
feature unreliable in the ordinary case — most people start working before they
open a dashboard.

**Independent Test**: With no board running, start an agent session and confirm
the reporting tools are present. Open the board, report, and confirm it arrives
without restarting the agent session.

**Acceptance Scenarios**:

1. **Given** no board running, **When** an agent session starts, **Then** the
   reporting tools are present in its toolset.
2. **Given** that session, **When** the board is opened afterwards and the agent
   reports, **Then** the report is delivered, with no restart required.
3. **Given** a board that is closed mid-session, **When** the agent reports,
   **Then** the call fails soft, and a later report after the board reopens
   succeeds.
4. **Given** a board that has moved to a different address in the documented
   range between calls, **When** the agent reports, **Then** the client locates
   it without intervention.

---

### User Story 3 - A failed report never derails the work (Priority: P2)

The board is not running. The agent reports anyway. It is told plainly that
there is no board, that this is not an error in its work, and that retrying will
not help — and it carries on with what it was doing.

**Why this priority**: A monitoring tool that costs an agent turns, or sends it
investigating a failure that is not its problem, is worse than no monitoring
tool. This is what makes the whole product safe to leave installed.

**Independent Test**: With no board running, have an agent report, and confirm
the response states the board is absent and directs it to continue — and that
the agent's subsequent behaviour is unchanged.

**Acceptance Scenarios**:

1. **Given** no board running, **When** an agent reports, **Then** the response
   says the board is not running and that the agent should continue without
   retrying.
2. **Given** no board running, **When** an agent reports, **Then** nothing is
   queued, buffered, or delivered later.
3. **Given** no board running, **When** an agent reports, **Then** nothing is
   launched — no window opens and no process starts.
4. **Given** an unrelated program answering at an address in the range, **When**
   a client probes it, **Then** the client sends nothing to it and continues
   looking.
5. **Given** any failure, **When** the client responds, **Then** it does so
   promptly rather than leaving the agent waiting.

---

### User Story 4 - A hook or script reports without an agent (Priority: P3)

An automation author wires a command into a hook or a build script so mechanical
events reach the board without an agent composing them.

**Why this priority**: Genuinely useful and keeps the contract honest by proving
it has more than one consumer — but the agent path carries the product.

**Independent Test**: Run the command from a shell inside a repository with a
board running, and confirm a session appears attributed as a script rather than
as an agent.

**Acceptance Scenarios**:

1. **Given** a board running, **When** the command is run inside a repository,
   **Then** a report reaches the board with repository and branch filled in from
   the working directory.
2. **Given** repeated runs from hooks, **When** they report, **Then** they share
   one session rather than creating one per invocation.
3. **Given** that shared session, **When** it is read, **Then** it is
   distinguishable from an agent's session.
4. **Given** no board running, **When** the command is run, **Then** it reports
   the board's absence and exits without error output that would fail a hook.

---

### User Story 5 - Installation needs no path or platform knowledge (Priority: P4)

Someone adds the reporting tools to their agent configuration the same way they
add any other, without knowing where the desktop application is installed or
which platform they are on.

**Why this priority**: A setup step people get wrong is a feature nobody uses,
but it can be got right after the mechanics work.

**Independent Test**: On a clean machine, add the documented configuration entry
and confirm the tools appear in a new agent session with no path editing.

**Acceptance Scenarios**:

1. **Given** a machine with the desktop application never installed, **When**
   the documented configuration entry is added, **Then** the tools are available
   and can reach a board when one runs.
2. **Given** Windows, macOS or Linux, **When** the same configuration entry is
   used, **Then** it works unchanged on each.
3. **Given** a client and a board from different releases, **When** they
   interact, **Then** any incompatibility is stated plainly rather than failing
   obscurely.

---

### Edge Cases

- **The board opens and closes repeatedly during one session.** Each call is
  independent; calls made while it is up succeed, calls while down fail soft.
- **Nothing in the documented range answers.** The client concludes the board is
  absent within a bounded time rather than probing indefinitely.
- **Something answers but is not the board.** Nothing is transmitted to it.
- **The command is run outside a repository.** It says so rather than reporting
  a meaningless path.
- **The runtime needed to launch the clients is missing.** The failure names the
  missing prerequisite, since the tools will otherwise appear simply broken.
- **The agent supplies a status string nobody has seen before.** It is forwarded
  unchanged; the clients impose no vocabulary.
- **Text long enough to be rejected by the service.** The rejection reason
  reaches the agent intact, not flattened into a generic failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The clients MUST expose a way to report session state and a way to
  add a note, mirroring the service contract.
- **FR-002**: The clients MUST derive repository path, branch, and session
  identity themselves, requiring none of them from the caller.
- **FR-003**: The MCP client MUST derive a session identity stable for the life
  of its process, so successive reports from one agent session update a single
  session.
- **FR-004**: The clients MUST accept only content from the model — which task,
  what is happening, attention state, note text — and MUST NOT require it to
  supply identity or timing.
- **FR-005**: The MCP client MUST start successfully and advertise its full
  toolset whether or not a board is running.
- **FR-006**: The MCP client MUST attempt to reach the board only when a tool is
  actually called, never at startup.
- **FR-007**: The clients MUST locate the board by trying a documented ordered
  range of addresses and using the first that positively identifies itself.
- **FR-008**: The clients MUST NOT transmit any content to a responder that
  fails to identify itself as the board.
- **FR-009**: When no board can be reached, the clients MUST return a message
  stating the board is not running and directing the caller to continue without
  retrying.
- **FR-010**: The clients MUST NOT buffer, queue, or retry an undelivered
  report.
- **FR-011**: The clients MUST NOT launch the desktop application or any other
  process.
- **FR-012**: The clients MUST complete every call within a bounded time,
  including when nothing is listening.
- **FR-013**: The clients MUST pass a rejection reason from the service back to
  the caller intact.
- **FR-014**: The command-line client MUST report a session distinguishable from
  an agent-driven one, and MUST group repeated invocations in a repository into
  a single session.
- **FR-015**: The command-line client MUST exit in a way that does not fail a
  calling hook when the board is absent.
- **FR-016**: Both clients MUST be distributed as one unit, installable and
  configurable identically on Windows, macOS and Linux without any
  filesystem path specific to the desktop application.
- **FR-017**: The clients MUST state their own version and surface a mismatch
  with the board's contract version as a clear message.
- **FR-018**: The clients MUST NOT read the user's repository beyond determining
  its path and current branch, and MUST NOT write anything anywhere.
- **FR-019**: The tool descriptions MUST state that attention state is the only
  way to request a human's attention, and that notes are not durable storage.

### Key Entities

- **Reporting tool**: The agent-facing capability that forwards composed content
  plus derived identity. Returns delivery confirmation or a soft failure.
- **Note tool**: As above, for appending a single note.
- **Client session identity**: A value stable for one client process lifetime,
  distinguishing concurrent agent sessions in the same repository.
- **Discovery sequence**: The documented ordered set of addresses tried, plus the
  identity check that qualifies a responder.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An agent session started with no board running has the full
  reporting toolset available in 100% of cases.
- **SC-002**: A board opened after an agent session has begun receives that
  session's next report without any restart, in 100% of cases.
- **SC-003**: Every call completes within 2 seconds, including when nothing is
  listening.
- **SC-004**: An agent receiving a board-absent response continues its work
  without retrying, in 100% of observed cases.
- **SC-005**: Zero content is transmitted to any responder that does not
  identify itself as the board.
- **SC-006**: Repeated invocations from hooks in one repository produce exactly
  one session, regardless of invocation count.
- **SC-007**: The documented configuration entry works unmodified on all three
  platforms.
- **SC-008**: A developer whose report is rejected can correct it from the
  message alone, without reading source.
- **SC-009**: No client run creates, modifies, or deletes any file, and none
  reads any file inside the reported repository — verifiable by observing file
  operations across a full exercise.

## Assumptions

- **The clients ship as one installable unit** requiring only a common runtime,
  chosen over a path into the installed application because it removes the
  desktop app's code-signing story from the spawnable piece entirely.
- **Session identity comes from process lifetime**, which matches one agent
  session because the host spawns one client process per session. Automation
  has no such process, hence the shared script-attributed session.
- **Branch is read at call time**, so a report made after a branch change
  reflects the new branch.
- **The address range is short** — a handful of entries — so an absent board is
  concluded quickly.
- **Version mismatch is surfaced, not reconciled.** Neither side translates for
  the other; they say so and let the human fix it.
- **Prompting agents to report well is out of scope.** This feature makes
  reporting possible and cheap; how often an agent chooses to is a matter for
  tool descriptions and project instructions.
