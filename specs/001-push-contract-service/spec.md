# Feature Specification: Push Contract and Local Service

**Feature Branch**: `001-push-contract-service`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "Push contract and local service — the HTTP API and in-memory state that every other CoCoaPilot surface wraps. Serves POST /v1/push (a full snapshot that replaces the board's state for one session), POST /v1/note (append-only), and GET /v1/health (identifies the app so port probing cannot mistake unrelated software for the board). Holds per-session state in memory keyed by repo and sessionId, stamps receipt time itself rather than trusting any client clock, and clears everything when the process exits. Binds to 127.0.0.1 only, with no auth and no TLS. Validates every field regardless, because localhost is not a trust boundary: repo must be an existing path but is never opened, all free text is length-capped and count-capped per collection, unknown keys are ignored so newer clients degrade instead of failing. Never reads the user's repository and never writes anything anywhere."

## Context

This is the spine of CoCoaPilot. It delivers nothing a person can see — the
window is feature 3 — but every other feature depends on it, so its acceptance
criteria are stated as **testable** rather than **observable**.

Two actors matter here:

- The **reporting agent** (an AI agent working in a repository, via the MCP
  server, the CLI, or direct HTTP). It is the only thing that writes.
- The **board**, which reads held state to render it.

The developer watching the board is the ultimate beneficiary, but they never
interact with this feature directly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An agent reports what it is doing, and the report is held (Priority: P1)

An agent working in a repository sends a complete picture of its session — the
feature it is on, the stories and tasks, what it is focused on right now, and
any prose for the human. The service accepts it, records when it arrived, and
holds it as that session's current state, available to whoever reads it.

**Why this priority**: This is the entire purpose of the component. Without it
nothing else in the product has anything to display.

**Independent Test**: Send one report to a running service, then read the held
state back and confirm it matches what was sent, with an arrival time attached.
Delivers the core value — a report given is a report kept.

**Acceptance Scenarios**:

1. **Given** a running service with no state, **When** an agent sends a complete
   report for a session, **Then** the service holds it as that session's current
   state and records the time it arrived.
2. **Given** a held session, **When** its state is read, **Then** everything the
   agent sent is present and the arrival time is the service's own, not any
   value the client supplied.
3. **Given** two agents reporting for different sessions, **When** both send
   reports, **Then** both sessions are held independently and neither overwrites
   the other.
4. **Given** a report arriving from a client with no session identity of its
   own, **When** it is accepted, **Then** it is attributed to a single shared
   "unattributed" session for that repository, distinguishable from an agent's.
5. **Given** held state for several sessions, **When** the service stops,
   **Then** all of it is gone; restarting yields a service holding nothing.

---

### User Story 2 - A newer report completely replaces the older one (Priority: P2)

An agent that has already reported sends an updated picture. The new report
replaces the previous one wholesale rather than merging into it, so the held
state is always exactly one agent's latest word.

**Why this priority**: Replacement is what makes the contract safe to build on.
Without it, held state becomes an accumulation whose correctness depends on
every message arriving exactly once, in order — and nothing else in the system
can correct it if it drifts.

**Independent Test**: Send a report, send a second differing report for the same
session, read the state back, and confirm it equals the second report exactly —
with nothing surviving from the first.

**Acceptance Scenarios**:

1. **Given** a session with a held report, **When** a newer report arrives for
   the same session, **Then** the held state equals the newer report exactly and
   retains nothing from the earlier one.
2. **Given** a report listing five tasks, **When** a newer report lists three,
   **Then** the held state lists exactly those three.
3. **Given** the same report sent twice, **When** both are processed, **Then**
   the held state is identical to having sent it once.
4. **Given** a session identified by repository and session identity, **When** a
   report arrives for a different repository, **Then** it is held separately
   rather than replacing the first.

---

### User Story 3 - A bad report is refused without damaging good state (Priority: P3)

Any local process can reach this service, so it treats every incoming field as
untrusted. A report that is malformed, oversized, or names a path that does not
exist is rejected with a clear reason, and whatever was already held is
untouched.

**Why this priority**: Held state is the only copy — nothing re-derives it. A
bad report that corrupts or empties a good session destroys information with no
recovery path.

**Independent Test**: Hold a valid report, then send a series of invalid ones
(oversized text, absurd collection sizes, a non-existent path, a bad status
value), and confirm each is refused with a reason while the original state
remains exactly as it was.

**Acceptance Scenarios**:

1. **Given** a held session, **When** an invalid report arrives for it, **Then**
   it is rejected with a reason naming the offending field, and the held state
   is unchanged.
2. **Given** a report whose free text exceeds the documented limit, **When** it
   is received, **Then** it is rejected rather than silently truncated.
3. **Given** a report whose collections exceed the documented item limits,
   **When** it is received, **Then** it is rejected.
4. **Given** a report naming a repository path that does not exist, **When** it
   is received, **Then** it is rejected — and the path is checked for existence
   only, never opened or read.
5. **Given** a report containing fields this version does not recognise,
   **When** it is received, **Then** the unrecognised fields are ignored and the
   rest is accepted, so a newer client degrades instead of failing.
6. **Given** any accepted report, **When** its text is later read, **Then** it
   is returned as plain text carrying no markup or executable content.

---

### User Story 4 - A client confirms it has found the right board (Priority: P4)

A client that does not know where the service is listening tries a documented
sequence of addresses. The service answers an identification request in a way
that positively distinguishes it from any other program that happens to be
listening.

**Why this priority**: Clients discover the service by probing. Without positive
identification, a client can send an agent's prompt text to unrelated software
that merely answered.

**Independent Test**: Ask the service to identify itself and confirm the reply
names the application and its version; then confirm a client rejects a reply
that does not.

**Acceptance Scenarios**:

1. **Given** a running service, **When** it is asked to identify itself,
   **Then** it replies naming the application and its version.
2. **Given** some unrelated program answering at an address, **When** a client
   asks it to identify itself, **Then** the absence of the expected
   identification causes the client to keep looking rather than send anything.
3. **Given** the service is not running anywhere in the documented range,
   **When** a client looks for it, **Then** the client concludes it is absent
   rather than hanging.

---

### User Story 5 - An agent adds a note without resending everything (Priority: P5)

An agent records a note — because the user asked it to, or because it judged
something worth recording. The note is added to that session's list rather than
replacing anything.

**Why this priority**: Notes are the one thing in the system that accumulate.
Valuable, but the board is useful without them, so this can follow the rest.

**Independent Test**: Add three notes to a session, read them back, and confirm
all three are present in order and that adding them did not disturb the
session's reported state.

**Acceptance Scenarios**:

1. **Given** a session, **When** a note is added, **Then** it joins that
   session's notes and nothing else about the session changes.
2. **Given** a session with notes, **When** a new report replaces the session's
   reported state, **Then** the notes are still there.
3. **Given** a note carrying a stated reason for existing, **When** it is read
   back, **Then** that reason is available alongside the text.
4. **Given** a session's notes, **When** the service stops, **Then** they are
   gone with everything else.

---

### Edge Cases

- **Two agents, one repository.** Distinct session identities in the same
  repository are held separately, not merged.
- **A report naming a repository that exists but is not a working tree.** The
  path check confirms existence only; the service forms no opinion about the
  contents, because it never opens them.
- **An agent that reports once and never again.** The session stays with its
  arrival time. Nothing expires it and nothing marks it dead.
- **Notes arriving before any report for that session.** The session is created
  by the note, holding notes and no reported state.
- **A very large but individually-valid report.** Collection caps bound the
  total, so a report cannot be enormous while every field is legal.
- **A session removed while a report for it is in flight.** The arriving report
  recreates the session — removal clears the board's copy, it does not suppress
  the agent.
- **The address the service wants is already taken.** It moves through the
  documented range and is still discoverable at whichever it claims.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The service MUST accept a report describing one session's complete
  current state and hold it, replacing any state previously held for that
  session.
- **FR-002**: The service MUST identify a session by the combination of its
  repository path and its session identity, holding distinct combinations
  independently.
- **FR-003**: The service MUST record its own arrival time for every report and
  note, and MUST NOT accept or use any timestamp supplied by a client.
- **FR-004**: The service MUST attribute reports lacking a client-generated
  session identity to a single shared unattributed session per repository, and
  MUST make that attribution distinguishable when the session is read.
- **FR-005**: The service MUST accept a note and append it to its session's
  notes, leaving that session's reported state and existing notes intact.
- **FR-006**: The service MUST create a session on first contact, whether that
  contact is a report or a note.
- **FR-007**: The service MUST answer an identification request with the
  application name and version, sufficient for a client to distinguish it from
  unrelated software.
- **FR-008**: The service MUST accept connections only from the local machine.
- **FR-009**: The service MUST validate every field of every request before
  using it, and MUST reject an invalid request with a reason identifying the
  offending field.
- **FR-010**: The service MUST leave previously held state completely unchanged
  when it rejects a request.
- **FR-011**: The service MUST enforce a documented maximum length on every
  free-text field and a documented maximum item count on every collection,
  rejecting rather than truncating anything that exceeds them.
- **FR-012**: The service MUST verify that a supplied repository path exists,
  and MUST NOT open, read, or traverse anything within it.
- **FR-013**: The service MUST ignore unrecognised fields in an otherwise valid
  request rather than rejecting it.
- **FR-014**: The service MUST treat all stored text as inert data, returning it
  in a form that cannot be interpreted as markup or executable content.
- **FR-015**: The service MUST hold all state in memory only, and MUST NOT
  create, modify, or delete any file or persistent record anywhere.
- **FR-016**: The service MUST lose all held state when its process ends, and
  MUST start holding nothing.
- **FR-017**: The service MUST support removing a single held session on
  request, without notifying any agent and without preventing that session from
  being recreated by a later report.
- **FR-018**: The service MUST accept an arbitrary text value for any status
  field, imposing no fixed vocabulary.
- **FR-019**: The service MUST claim an address from a documented ordered range,
  taking the first available, so that a client probing the same range in the
  same order finds it.
- **FR-020**: The service MUST make its held state readable, per session, for
  the board to render.

### Key Entities

- **Session**: One agent's work in one repository. Identified by repository path
  plus session identity; may be marked unattributed. Holds one current reported
  state, an ordered list of notes, and the arrival time of the most recent
  contact. Exists only in memory.
- **Report**: A complete snapshot of a session at a moment — the feature being
  worked, its stories and tasks with free-text statuses, a plan, what the agent
  is focused on right now, and the files it says it changed. Wholly replaces its
  predecessor.
- **Note**: One piece of text an agent recorded, with an optional stated reason
  for existing and an arrival time. Appends; never replaces.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A report that has been accepted is readable as that session's
  state immediately afterward, with no intermediate state in which it is
  partially applied.
- **SC-002**: Sending the same report any number of times leaves held state
  identical to having sent it once.
- **SC-003**: 100% of rejected requests leave previously held state byte-identical
  to what it was before.
- **SC-004**: No rejected or accepted request causes any file anywhere to be
  created, modified, or deleted — verifiable by observing zero write operations
  outside the process across a full exercise of the contract.
- **SC-005**: No request causes any file within a reported repository path to be
  opened or read — verifiable by observing zero read operations against that
  path.
- **SC-006**: The service holds at least 20 concurrent sessions, each with at
  least 200 tasks and 100 notes, without loss or degradation.
- **SC-007**: Every rejection names the field responsible, such that a developer
  reading the response can correct the request without consulting source code.
- **SC-008**: A client probing the documented address range locates a running
  service, and refuses to transmit to any responder that fails to identify
  itself correctly, in 100% of attempts.
- **SC-009**: After a restart, the service holds zero sessions.
- **SC-010**: Text containing markup or script is returned in a form that
  renders as visible characters and cannot execute, in 100% of cases.

## Assumptions

- **The caps are chosen here and adjustable later.** Concrete starting values:
  4,000 characters for a note or prose field, 200 characters for a title or
  status, 500 tasks and 200 stories per report, 1,000 notes per session, 100
  sessions total. These are round numbers well above realistic use and well
  below anything that threatens memory; they exist to be enforceable, not to be
  precise.
- **Session removal is served here, driven elsewhere.** This feature provides the
  capability; the control that invokes it belongs to the multiple-sessions
  feature.
- **Reading held state is in scope; rendering it is not.** How the board asks for
  state is part of this contract. What it does with it is features 3 through 8.
- **One reader, one writer, no subscriptions.** How the board learns state has
  changed — polling, a push channel — is deferred to the window feature rather
  than assumed here.
- **No client is authenticated or distinguished.** Any local process may report.
  This is accepted: the blast radius is misleading text on a board, since
  nothing is written and nothing is executed.
- **The agent has already normalised what it sends.** Reading Spec-Kit files and
  reconciling their inconsistencies is the agent-side tool's job; this service
  takes what it is given.
- **Version identification implies a versioned contract**, so a client and
  service that disagree can say so rather than fail obscurely.
