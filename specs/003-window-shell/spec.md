# Feature Specification: Window Shell

**Feature Branch**: `003-window-shell`

**Created**: 2026-08-06

**Status**: Draft

**Input**: The desktop window itself — one window sized to live beside an editor. Title bar carrying repository, branch, elapsed time since the last report and the attention chip; the tab strip; the empty state seen on every launch; width that belongs to the user and never changes on its own; and the scrolling behaviour that keeps a short window usable.

## Context

The first feature a person can actually see. It renders the *frame* — identity,
liveness, navigation, emptiness — while the tabs inside it are features 4
through 8.

The actor is the **developer**, working in an editor with an agent running
somewhere else, who wants to know what is happening without interrupting it.

Two properties shape everything here. The window **never refreshes itself** —
what changes on screen changes because an agent caused it to. And the
application **holds nothing across a restart**, so an empty board is a routine
screen rather than a first-run one.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what is being worked on, and how long ago (Priority: P1)

A developer glances at the board and learns three things without reading
carefully: which repository and branch is being worked, how recently the agent
said anything, and whether it is waiting on them.

**Why this priority**: This is the product's core promise at its smallest. A
board that answers only this is already worth leaving open.

**Independent Test**: Report a session, then confirm the window shows that
repository and branch, a growing elapsed time, and an attention state — all
without the developer taking any action.

**Acceptance Scenarios**:

1. **Given** a session has been reported, **When** the developer looks at the
   window, **Then** the repository and branch are shown.
2. **Given** a report arrived some time ago, **When** the developer looks,
   **Then** elapsed time since it arrived is shown and increases as time passes.
3. **Given** an agent reporting that it needs attention, **When** the developer
   looks, **Then** that is distinguishable at a glance from an agent working
   normally.
4. **Given** an agent that has stopped reporting, **When** time passes, **Then**
   only elapsed time changes — nothing declares the agent stalled, stuck or
   failed, at any duration.
5. **Given** a newly arrived report, **When** it is received, **Then** the
   window reflects it without the developer refreshing anything.

---

### User Story 2 - Open the board before anything has been reported (Priority: P2)

A developer opens the board — for the first time, or any time after closing it —
before an agent has said anything. The window explains it is waiting, makes
clear there is nothing to set up, and does not present controls that lead
nowhere.

**Why this priority**: Because nothing survives a restart, this is not a
first-run screen — it is seen on **every** launch. Getting it wrong means the
product looks broken regularly, not once.

**Independent Test**: Launch with no reports and confirm the window states it is
waiting, offers no configuration, and hides navigation that would lead to empty
views. Then report, and confirm the window populates.

**Acceptance Scenarios**:

1. **Given** a freshly launched application with no reports, **When** the
   developer looks, **Then** it states it is waiting for an agent rather than
   showing an error or a blank panel.
2. **Given** that state, **When** the developer looks for setup, **Then** the
   window makes clear the agent supplies everything and there is nothing to
   configure.
3. **Given** that state, **When** the developer looks at navigation, **Then**
   no navigation is offered at all. *(Amended by decision 36: in the waiting
   state this still holds, and holds because there is no session rather than no
   content. Once a session exists every destination is offered — see FR-009.)*
4. **Given** the empty state, **When** a first report arrives, **Then** the
   window populates and navigation becomes available, without a restart.
5. **Given** a populated board, **When** the application is closed and
   reopened, **Then** it is empty again and says so plainly.

---

### User Story 3 - Move between views without the window moving (Priority: P3)

A developer sizes the window to sit beside their editor and switches between
views. The window stays exactly where and what size they put it.

**Why this priority**: A panel that resizes itself is actively worse than one
that is slightly too small — it disturbs a deliberately arranged workspace. But
it only matters once there is more than one view to move between.

**Independent Test**: Set a width, switch between every view, and confirm the
width never changes; resize, and confirm the new width is respected everywhere.

**Acceptance Scenarios**:

1. **Given** a window at a chosen width, **When** the developer switches views,
   **Then** the width does not change.
2. **Given** any view, **When** the developer resizes the window, **Then** the
   new size is honoured and the content adapts to it.
3. **Given** a deliberately narrow window, **When** any view is shown, **Then**
   its content remains usable rather than clipped or overlapping.
4. **Given** a view is active, **When** a report arrives changing other content,
   **Then** the developer stays where they were.

---

### User Story 4 - Keep a short window usable (Priority: P4)

A developer with limited vertical space still needs to find their way around
content taller than the window.

**Why this priority**: Real placement beside an editor is often short as well as
narrow. Necessary for the product to survive its actual habitat, but only after
there is enough content to overflow.

**Independent Test**: With content exceeding the window height, scroll and
confirm the section a person is reading remains identifiable throughout.

**Acceptance Scenarios**:

1. **Given** content taller than the window, **When** the developer scrolls,
   **Then** all of it is reachable.
2. **Given** scrolling within a section, **When** its contents pass, **Then**
   which section is being read remains identifiable, along with its summary.
3. **Given** a window at a small height, **When** it is shown, **Then** it
   remains usable rather than degrading into unreadable fragments.
4. **Given** the window scrolls in one direction, **When** any view is shown,
   **Then** it never scrolls sideways.

---

### Edge Cases

- **A report naming a very long repository path or branch.** The title bar
  degrades gracefully; identity and liveness stay legible.
- **Reports arriving faster than a person can read.** The window stays legible
  and does not flicker or queue visibly.
- **The window is closed while an agent keeps reporting.** Nothing is retained;
  reopening shows the empty state until the next report.
- **Elapsed time growing very large.** It remains readable and stays a
  measurement, never becoming a judgement.
- **A window sized smaller than any layout can honour.** A defined minimum
  applies rather than allowing an unusable window.
- **The display's appearance settings differ from the panel's.** The panel holds
  its own contrast rather than inheriting a host theme.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The window MUST display the repository and branch of the session
  currently being shown.
- **FR-002**: The window MUST display time elapsed since the most recent report
  for that session, and MUST update it as time passes.
- **FR-003**: The window MUST display the attention state the agent last
  reported, and MUST NOT derive, infer or change it on its own.
- **FR-004**: The window MUST NOT apply any time threshold that changes what is
  displayed, and MUST NOT describe an agent as stalled, stuck, failed or idle
  unless the agent reported it.
- **FR-005**: The window MUST update when a report arrives, without any action
  by the developer.
- **FR-006**: The window MUST NOT poll, watch, or otherwise re-read the user's
  repository, and MUST NOT change what is displayed except in response to
  reported information.
- **FR-007**: The window MUST present a waiting state when no session has been
  reported, stating that it is waiting for an agent.
- **FR-008**: The waiting state MUST make clear that no configuration is
  required.
- **FR-009**: ~~The window MUST NOT offer navigation to views that would be
  empty.~~ **Superseded by decision 36**, which offers every destination from the
  first report onwards; each view states its own emptiness instead. Kept for the
  reasoning trail. What survives is narrower and still enforced: the window MUST
  offer no navigation while no session is held.
- **FR-010**: The window MUST transition out of the waiting state on the first
  report, without a restart.
- **FR-011**: The window MUST retain nothing across restarts, returning to the
  waiting state every launch.
- **FR-012**: The window MUST NOT change its own size for any reason other than
  a deliberate resize by the developer.
- **FR-013**: The window MUST preserve its size across view changes.
- **FR-014**: The window MUST remain usable at any size at or above a defined
  minimum, and MUST enforce that minimum.
- **FR-015**: The window MUST allow content taller than itself to be reached by
  scrolling, and MUST keep the identity and summary of the section being read
  visible throughout.
- **FR-016**: The window MUST NOT require horizontal scrolling in any view at
  any supported size.
- **FR-017**: The window MUST preserve the developer's current view and scroll
  position when a report arrives.
- **FR-018**: The window MUST maintain its own legibility independent of any
  host or system appearance setting.
- **FR-019**: The window MUST present exactly one main window per running
  application.
- **FR-020**: The window MUST render all reported text as inert content that
  cannot execute.

### Key Entities

- **Board window**: The single main window. Holds identity, liveness, attention
  state, navigation and the active view.
- **Session identity display**: Repository, branch, elapsed time, attention
  state — the four things readable at a glance.
- **Waiting state**: What is shown when nothing has been reported. A routine
  screen, not an error and not a setup flow.
- **View**: One named destination in the strip. Defined here as a container;
  contents are features 4 through 8.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer glancing at the window identifies the repository,
  branch, how long since the last report, and whether attention is needed, in
  under 3 seconds.
- **SC-002**: A newly arrived report is visible without any developer action, in
  100% of cases.
- **SC-003**: Window width is unchanged by view switching in 100% of switches.
- **SC-004**: Every view is usable at the defined minimum width and height, with
  no clipped or overlapping content and no horizontal scrolling.
- **SC-005**: A developer opening the application with nothing reported
  correctly concludes it is waiting rather than broken, without consulting
  documentation.
- **SC-006**: Nothing in the window changes state on a timer — verifiable by
  leaving it untouched with no reports and observing zero visual change beyond
  elapsed-time counters.
- **SC-007**: After a restart, the window shows the waiting state in 100% of
  cases.
- **SC-008**: The developer's active view and scroll position survive an
  incoming report in 100% of cases.
- **SC-009**: Reported text containing markup or script renders as visible
  characters and never executes, in 100% of cases.

## Assumptions

- **How the window learns state changed is settled in planning, not here.** This
  was left open by feature 001. The requirement is that it updates without
  developer action; polling or a push channel both satisfy it, and the choice is
  an implementation trade-off.
- **One window per running application.** Detaching a section into its own
  window is out of scope and remains undesigned.
- **Window position and size are not remembered across restarts**, consistent
  with holding no durable state. Revisit only if it proves annoying in use — it
  is the one place the no-persistence rule touches ergonomics rather than
  correctness.
- **The minimum size is a real constraint, chosen during planning** against the
  narrowest layout any view can honour.
- **Only one session is shown.** Navigating between concurrent sessions is
  feature 008.
- **Content is rendered from held state**, which is agent-reported and never
  read from the repository.
