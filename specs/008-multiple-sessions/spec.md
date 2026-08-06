# Feature Specification: Multiple Sessions

**Feature Branch**: `008-multiple-sessions`

**Created**: 2026-08-06

**Status**: Draft

**Input**: What happens when more than one agent is reporting. A switcher row that is absent entirely at one session and appears when a second declares itself, holding a pill per session in order of declaration. Each pill carries its own attention state and elapsed time, so an unselected agent asking for attention is still visible. A dismiss control clears the board's copy of a session without telling the agent, and a dismissed session returns if it reports again.

## Context

Every other view shows one session. This feature is how a developer holds more
than one without the board becoming unreadable.

The actor is the **developer** running agents in two or more repositories at
once — the power case, but a real one, and the case the product's premise
implies.

The governing constraint comes from elsewhere in the design: **the attention
state is the only way an agent can ask for a human.** The board never escalates
on its own. So a session the developer is not looking at must still be able to
raise its hand, or that single channel is silently broken exactly when it
matters.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nothing changes when there is only one session (Priority: P1)

A developer running one agent — the ordinary case — sees no switcher, no pills,
and no chrome devoted to a choice they do not have.

**Why this priority**: Most sessions are single. Permanent navigation for a
case that usually does not exist would tax every ordinary use to serve an
occasional one.

**Independent Test**: With exactly one session reported, confirm no switcher is
present and the window is identical to the single-session design.

**Acceptance Scenarios**:

1. **Given** one reported session, **When** the developer looks, **Then** no
   switcher or session list is shown.
2. **Given** one session, **When** it reports repeatedly, **Then** no switcher
   appears.
3. **Given** no sessions at all, **When** the developer looks, **Then** no
   switcher is shown.
4. **Given** two sessions reduced back to one by dismissal, **When** the
   developer looks, **Then** the switcher is gone again.

---

### User Story 2 - See and switch between concurrent sessions (Priority: P2)

A second agent declares itself. A switcher appears, listing both. The developer
picks one and the whole board follows it.

**Why this priority**: The core of the feature, but by definition it cannot
matter until a second session exists.

**Independent Test**: Report two sessions, confirm a switcher appears with both,
select each in turn, and confirm every view follows the selection.

**Acceptance Scenarios**:

1. **Given** one session, **When** a second declares itself, **Then** a switcher
   appears listing both.
2. **Given** the switcher, **When** the developer selects a session, **Then**
   every view shows that session and nothing from any other.
3. **Given** sessions declared in an order, **When** they are listed, **Then**
   they appear in that order, and that order does not change as reports arrive.
4. **Given** a selected session, **When** another session reports, **Then** the
   selection does not change.
5. **Given** a selected session, **When** the developer switches away and back,
   **Then** the board shows that session's current state.
6. **Given** a third session declares itself, **When** it does, **Then** it is
   added without disturbing the existing order or selection.

---

### User Story 3 - Notice an unselected agent asking for attention (Priority: P2)

An agent the developer is not currently watching reports that it needs
attention. They can see this without switching to it.

**Why this priority**: Equal to P2 because it is what makes multiple sessions
safe rather than merely possible. Without it, the board's one attention channel
is silently dropped for every session but one.

**Independent Test**: With two sessions, have the unselected one report needing
attention, and confirm its pill shows this distinctly without the board
switching or the selected session being disturbed.

**Acceptance Scenarios**:

1. **Given** two sessions, **When** the unselected one reports needing
   attention, **Then** its pill shows that state distinctly.
2. **Given** that state, **When** it appears, **Then** the selection does not
   change and the board does not switch on its own.
3. **Given** each pill, **When** the developer looks, **Then** it shows how long
   since that session last reported.
4. **Given** an attention state that is later replaced by an ordinary one,
   **When** the newer report arrives, **Then** the pill returns to ordinary.
5. **Given** an unselected session needing attention, **When** it appears,
   **Then** pills do not reorder, and nothing moves under the developer's
   cursor.

---

### User Story 4 - Clear a session the developer is done with (Priority: P3)

A developer finished with a session removes it from the board. The agent is not
told and is not affected. If it reports again, it comes back.

**Why this priority**: Needed for a long working day, when finished sessions
accumulate. Not needed to make concurrency work.

**Independent Test**: Dismiss a session, confirm it leaves the board and the
agent is unaffected, then have it report again and confirm it returns.

**Acceptance Scenarios**:

1. **Given** a listed session, **When** the developer dismisses it, **Then** it
   is removed from the board.
2. **Given** a dismissal, **When** it happens, **Then** nothing is sent to any
   agent and no agent's behaviour changes.
3. **Given** a dismissed session, **When** it reports again, **Then** it
   reappears with its new state.
4. **Given** the selected session is dismissed, **When** it is removed, **Then**
   the board selects another remaining session rather than showing nothing.
5. **Given** the last session is dismissed, **When** it is removed, **Then** the
   board returns to its waiting state.
6. **Given** the dismiss control, **When** the developer inspects it, **Then**
   it makes clear that it clears the board's copy rather than closing anything.

---

### Edge Cases

- **Many sessions at once.** The switcher stays readable at the window's
  minimum width, showing enough of each to tell them apart.
- **Two sessions in the same repository on different branches.** Both are
  listed and distinguishable.
- **Two sessions in the same repository on the same branch.** Both are listed
  and remain individually selectable.
- **A session reporting while being dismissed.** It returns; dismissal clears a
  copy, it does not suppress an agent.
- **An unattributed script session alongside agent sessions.** Listed like any
  other but identifiable as not an agent.
- **A session that reports once and never again.** Stays listed with growing
  elapsed time. Nothing expires it.
- **Very long repository or branch names in a pill.** Degrade legibly; enough
  remains to distinguish sessions.
- **Several sessions needing attention at once.** Each shows its own state;
  none is promoted above the others.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST show no switcher when fewer than two sessions
  are held.
- **FR-002**: The application MUST show a switcher when two or more sessions are
  held, and MUST remove it when the count falls below two.
- **FR-003**: The switcher MUST list one entry per held session.
- **FR-004**: The switcher MUST order entries by when each session first
  declared itself, and MUST NOT reorder them for any reason.
- **FR-005**: Each entry MUST identify its session sufficiently to distinguish
  it from the others.
- **FR-006**: Each entry MUST show the attention state that session last
  reported.
- **FR-007**: Each entry MUST show time elapsed since that session last
  reported.
- **FR-008**: An entry whose session reported needing attention MUST be visibly
  distinct from the others.
- **FR-009**: The application MUST NOT change the selected session on its own,
  for any reason including an attention state on another session.
- **FR-010**: Selecting a session MUST cause every view to show that session
  only.
- **FR-011**: The application MUST identify an unattributed script session as
  such.
- **FR-012**: The application MUST provide a control to dismiss an individual
  session, removing the board's copy.
- **FR-013**: Dismissal MUST NOT transmit anything to any agent.
- **FR-014**: A dismissed session MUST reappear if it reports again.
- **FR-015**: The dismiss control MUST convey that it clears the board's copy
  rather than closing or ending anything.
- **FR-016**: When the selected session is removed, the application MUST select
  another remaining session, or return to the waiting state if none remain.
- **FR-017**: The application MUST NOT expire, hide or remove a session on a
  time basis.
- **FR-018**: The switcher MUST remain usable at the window's minimum supported
  width without horizontal scrolling.
- **FR-019**: The switcher MUST NOT steal focus, raise the window, or produce
  sound when a session appears or changes state.
- **FR-020**: The application MUST retain no session across a restart.

### Key Entities

- **Session entry**: One held session's representation in the switcher —
  identity, attention state, elapsed time, and whether it is an agent or a
  script.
- **Selection**: Which session every view is currently showing. Changed only by
  the developer, except when the selected session is removed.
- **Declaration order**: The order sessions first appeared, fixed for as long as
  each is held.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With one session, the window is visually identical to the
  single-session design — verifiable by comparison.
- **SC-002**: A developer notices an unselected session needing attention
  without switching to it, in 100% of cases.
- **SC-003**: Selection never changes without a developer action, except when
  the selected session is removed — verifiable across a full exercise including
  attention states on other sessions.
- **SC-004**: Switcher entries never change position while sessions remain held,
  in 100% of cases.
- **SC-005**: Dismissal transmits nothing — verifiable by observing zero
  outbound requests.
- **SC-006**: A dismissed session that reports again reappears in 100% of cases.
- **SC-007**: Six concurrent sessions remain distinguishable and selectable at
  the minimum supported width, with no horizontal scrolling.
- **SC-008**: No session is removed or hidden other than by dismissal or a
  restart — verifiable by leaving sessions idle indefinitely and observing none
  disappear.
- **SC-009**: A developer switching between sessions sees the target session's
  current state within one action.
- **SC-010**: After a restart, no sessions are held in 100% of cases.

## Assumptions

- **The switcher's appearance is a visible change to the chrome**, shifting
  content below it once. Accepted over reserving permanent empty space, since
  the single-session case is the common one and permanent chrome would tax it.
- **Session identity in a pill is repository and branch**, with detail dropping
  away as the count grows and space tightens; the exact degradation is a design
  matter already settled and applied in planning.
- **No merged view.** Two repositories interleaved in one task list or history
  would be unreadable, so every view follows exactly one session.
- **Selection is not retained across restarts**, consistent with holding nothing
  durable.
- **Session removal is served by feature 001**; this feature is the control and
  the switcher.
- **There is no upper limit on held sessions in this spec** beyond the service's
  own cap. The switcher is expected to degrade legibly rather than refuse.
