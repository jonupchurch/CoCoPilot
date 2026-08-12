# Feature Specification: Ticket Tab and Openable Links

**Feature Branch**: `010-ticket-tab-links`

**Created**: 2026-08-12

**Status**: Draft

**Input**: A tab holding the tracker ticket the current work comes from, reported by the agent like everything else — its identity, description, acceptance criteria, labels, comments and parent. Neutral across trackers, with a labelled-value escape hatch so a tracker the board does not model still displays in full. Absent entirely for sessions that are not ticket-driven, and sticky once seen so a later report cannot take it away mid-read. Its address, and its parent's, open in the developer's own browser — the first outbound action the product has ever had, restricted to ordinary web addresses and refused rather than repaired otherwise.

## Context

Every view on this board shows what the agent decided to say about its own work:
the plan it made, the tasks it cut the work into, the files it touched. Where
that work *originates* in a tracker ticket, the ticket itself has been the one
thing the board could not show — so the developer keeps it open in another
window and switches back and forth to read the acceptance criteria they are
being measured against.

The actor is the **developer working from a tracker ticket** — Jira today, Azure
DevOps expected, and neither one named anywhere in what gets built.

Two constraints govern the shape, and both come from elsewhere in the design.

**The board is told; it never fetches.** It contacts no tracker, holds no
credential and knows how to talk to no tracker at all. The agent already has
access to the
tracker, so the agent pulls the ticket and reports it the way it reports
everything else. This is what keeps the feature neutral: a second tracker costs
a second agent-side adapter and no change to the board at all.

**Not every session has a ticket.** A session working from repository specs has
no ticket *concept*, which is a different claim from having a ticket with
nothing in it — the same distinction the board already draws between a section
that is empty and one whose source could not be read. So this tab is absent
rather than empty, and it is the only tab that is ever absent once a session
exists.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read the ticket you are working from (Priority: P1)

A developer whose agent is working a tracker ticket sees that ticket on the
board: what it is called, what state the tracker has it in, who it is assigned
to, what it asks for, and what it will be accepted against.

**Why this priority**: It is the feature. Everything else here either reaches
the ticket (P2) or adds to it (P3), and neither is possible without it.

**Independent Test**: Report a ticket and confirm a tab appears carrying every
field that was reported, with nothing shown that was not.

**Acceptance Scenarios**:

1. **Given** a session for which no ticket has been reported, **When** the
   developer looks, **Then** no ticket tab is offered.
2. **Given** such a session, **When** a report carrying a ticket arrives,
   **Then** a ticket tab appears and shows that ticket.
3. **Given** a reported ticket, **When** the developer reads it, **Then** every
   field the agent reported is shown, and every field it did not report is
   absent rather than shown as blank or filled in by the board.
4. **Given** a reported ticket, **When** the developer looks, **Then** they can
   see how long ago it was reported, and the board offers no judgement about
   whether it is still current.
5. **Given** a description containing formatting characters or markup, **When**
   it is shown, **Then** those characters appear as written and none of it is
   interpreted as markup.
6. **Given** a shown ticket, **When** a later report for that session omits the
   ticket, **Then** the tab remains and continues to show the last ticket
   reported.
7. **Given** a shown ticket, **When** a report carries a different one, **Then**
   the tab shows the new one in place of the old.
8. **Given** two held sessions, one ticket-driven and one not, **When** the
   developer switches between them, **Then** the tab is offered for the first
   and not for the second.

---

### User Story 2 - Open the ticket in your own browser (Priority: P2)

The developer activates the ticket's address and it opens in the browser they
already use, signed in, where they can comment or change state themselves.

**Why this priority**: The tab is genuinely useful without it — the description
and criteria are the things most often needed. This removes the copy-and-paste
that remains, and it is where the product's care has to go, because it is the
first action the board has ever taken outside its own window.

**Independent Test**: Report a ticket carrying an ordinary web address, activate
it, and confirm the browser opens it while the application's own window goes
nowhere and nothing is sent to any agent.

**Acceptance Scenarios**:

1. **Given** a ticket carrying an ordinary web address, **When** the developer
   activates it, **Then** the ticket opens in the system browser.
2. **Given** that action, **When** it happens, **Then** no part of the
   application navigates anywhere and no additional application window opens.
3. **Given** a ticket with a parent that carries an address, **When** the
   developer activates it, **Then** the parent opens the same way.
4. **Given** a reported address that is not an ordinary web address, **When**
   the developer looks, **Then** it is not offered as openable, and it is still
   shown as text.
5. **Given** any link activation, **When** it happens, **Then** nothing is sent
   to any agent and no agent's behaviour changes.
6. **Given** a ticket for which no address was reported, **When** the developer
   looks, **Then** no link is offered and the rest of the ticket is unaffected.
7. **Given** a reported address, **When** the developer inspects it before
   activating, **Then** they can see where it leads.

---

### User Story 3 - Read the ticket's discussion (Priority: P3)

The developer reads the comments on the ticket — the clarification that never
made it into the description, and the reason the ticket says what it says.

**Why this priority**: Real, and routinely where the actual requirement lives.
Deferred behind the description and criteria because it is the bulkiest part of
a ticket and the part most likely to be stale.

**Independent Test**: Report a ticket with comments and confirm they are listed
with their authors in the order reported, and that a ticket with more comments
than the board holds says how many are missing.

**Acceptance Scenarios**:

1. **Given** a ticket with comments, **When** the developer opens the tab,
   **Then** each is shown with its author, in the order reported.
2. **Given** a ticket with more comments than the board accepts, **When** it is
   shown, **Then** the developer is told how many were not included rather than
   silently seeing a partial list.
3. **Given** a ticket with no comments, **When** the developer looks, **Then**
   the view says so rather than omitting the section.
4. **Given** comment text containing formatting or markup, **When** it is shown,
   **Then** it appears as written and none of it is interpreted as markup.

---

### User Story 4 - Work from a tracker the board has never heard of (Priority: P3)

A developer on a different tracker — Azure DevOps, or something in-house — sees
their ticket in full, including the fields peculiar to that tracker, without
anything in the board having been taught about it.

**Why this priority**: It is what makes the feature outlive its first tracker,
and it is cheap if designed in from the start and expensive to retrofit. Behind
P2 because the first tracker is the one that has to work.

**Independent Test**: Report a ticket whose fields are entirely ones the board
does not model, and confirm all of them are displayed.

**Acceptance Scenarios**:

1. **Given** a ticket carrying fields the board does not model, **When** it is
   shown, **Then** those fields are displayed as labelled values in the order
   they were reported.
2. **Given** a ticket that names which tracker it came from, **When** it is
   shown, **Then** the board identifies that tracker.
3. **Given** a ticket that does not name its tracker, **When** it is shown,
   **Then** the ticket is shown in full and no tracker is named or guessed.
4. **Given** a tracker whose state names differ from any the board recognises,
   **When** the ticket is shown, **Then** the state appears exactly as reported.

---

### Edge Cases

- **A description longer than the board accepts.** The report is refused, naming
  the field and the limit, and no text is shortened by the board. What the
  developer reads is either the whole description or a shortened one the agent
  chose and can say it shortened.
- **A ticket with no address.** Shown in full; nothing is openable and nothing
  is missing-looking.
- **An address that is not an ordinary web address** — a local file, a script, a
  registered application handler. Never openable, always still visible as text.
- **An address that is well-formed and simply wrong.** Opens, and lands wherever
  it leads. The board vouches for the kind of address, never the destination.
- **A ticket reported by a script or hook rather than an agent.** Shown like any
  other, and identified as coming from a script the way such sessions already
  are.
- **A ticket with no key, or no title.** Shown with whatever it has; the board
  invents neither.
- **A very long ticket key, title or label at the window's minimum width.**
  Degrades legibly, with the whole value retrievable.
- **Switching to a session with no ticket.** The tab is not offered for that
  session; switching back offers it again with that session's ticket.
- **A ticket on a dismissed session.** Goes with the session, and returns if the
  agent reports it again.
- **A restart.** No ticket is held, like everything else.
- **A ticket whose parent has no address**, or no parent at all. Shown without
  one; nothing is derived from the key.

## Requirements *(mandatory)*

### Functional Requirements

**The tab and its presence**

- **FR-001**: The application MUST offer no ticket view for a session for which
  no ticket has been reported.
- **FR-002**: The application MUST offer a ticket view once a ticket has been
  reported for that session.
- **FR-003**: The application MUST continue to offer the view, showing the last
  ticket reported, when a later report for that session carries no ticket.
- **FR-004**: The application MUST show the newly reported ticket in place of
  the previous one when a report carries a different ticket.
- **FR-005**: The application MUST show the ticket of the selected session only.
- **FR-006**: The application MUST keep every navigation destination legible and
  operable at the window's minimum supported width, without horizontal
  scrolling.

**What is shown**

- **FR-007**: The application MUST show every ticket field that was reported.
- **FR-008**: The application MUST omit any field that was not reported, rather
  than showing it as blank, unknown, or a value of its own.
- **FR-009**: The application MUST NOT infer, complete, derive or guess any
  ticket value, including its address.
- **FR-010**: The application MUST render all ticket text as plain text, and
  MUST NOT interpret any part of it as markup.
- **FR-011**: The application MUST show how long ago the ticket was reported,
  and MUST NOT present any assessment of whether it is current.
- **FR-012**: The application MUST accept and display ticket fields whose names
  it does not model, as labelled values in the order reported.
- **FR-013**: The application MUST identify which tracker a ticket came from
  when that is reported, and MUST name no tracker when it is not.
- **FR-014**: The application MUST show a reported state exactly as reported,
  whatever words the tracker uses.
- **FR-015**: The application MUST list reported comments with their authors in
  the order reported.
- **FR-016**: The application MUST state how many comments were not included
  when a ticket carries more than the limit.
- **FR-017**: The application MUST say when a ticket has no comments, rather
  than omitting the section.
- **FR-018**: The application MUST NOT compare the ticket against reported
  stories or tasks, and MUST NOT present any disagreement between them.

**Opening a link**

- **FR-019**: The application MUST allow the developer to open a reported ticket
  address in the system browser.
- **FR-020**: The application MUST allow the same for a reported parent address.
- **FR-021**: The application MUST NOT offer to open an address that is not an
  ordinary web address, and MUST still show that address as text.
- **FR-022**: The application MUST refuse an address it will not open rather
  than altering, correcting or completing it into one it will.
- **FR-023**: The application MUST NOT navigate any part of itself to a reported
  address, and MUST NOT open an application window for one.
- **FR-024**: The application MUST transmit nothing to any agent when a link is
  opened, and MUST make no request of its own to the address.
- **FR-025**: The developer MUST be able to see where a link leads before
  activating it.

**Limits and lifetime**

- **FR-026**: The application MUST refuse a report whose ticket exceeds a stated
  limit, naming the field and the limit that was exceeded.
- **FR-027**: The application MUST NOT shorten, truncate or summarise any
  reported text.
- **FR-028**: The application MUST retain no ticket across a restart.
- **FR-029**: The application MUST validate every reported ticket value before
  showing it, regardless of what sent it.

### Key Entities

- **Ticket**: The tracker's record of the work — its key, title, type, state,
  priority, assignee, sprint or iteration, description, acceptance criteria,
  labels, address, and the tracker it came from. Every part optional except that
  a ticket must be identifiable as one.
- **Comment**: One entry in the ticket's discussion — an author and the text,
  and when it was written if the tracker said.
- **Extra field**: A labelled value the board does not model, carried so a
  tracker's own vocabulary survives. Ordered as reported.
- **Parent**: The epic, feature or work item above this one — a title and,
  optionally, its own address. A reference, not a nested ticket.
- **Ticket address**: Where the ticket lives, as reported. Shown always,
  openable only when it is an ordinary web address.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer working from a ticket reads its description and
  acceptance criteria without leaving the board, in 100% of cases where the
  agent reported them.
- **SC-002**: A session with no reported ticket presents exactly the navigation
  it presented before this feature — verifiable by comparison.
- **SC-003**: A developer reaches the ticket in their browser in one action.
- **SC-004**: No address other than an ordinary web address is ever opened —
  verifiable by attempting local-file, script and application-handler addresses
  and observing that none opens.
- **SC-005**: Opening a link transmits nothing: zero outbound requests from the
  application and nothing to any agent — verifiable by observation.
- **SC-006**: A ticket at every limit the board allows — a full-length
  description and the maximum comments — remains readable and scrollable at the
  minimum supported width with no horizontal scrolling.
- **SC-007**: A report whose ticket exceeds a limit is refused with a message
  naming the field and the limit, in 100% of cases.
- **SC-008**: Every navigation destination remains legible and operable at the
  minimum supported width once the ticket view is among them.
- **SC-009**: A ticket reported once is still shown after ten subsequent reports
  that omit it.
- **SC-010**: A ticket whose fields are entirely unmodelled by the board is
  displayed in full — verifiable with a ticket carrying no recognised field but
  its identity.
- **SC-011**: After a restart, no ticket is held, in 100% of cases.
- **SC-012**: Markup in any reported ticket text is visible as characters and
  never acted on — verifiable across the description, the criteria, the labels,
  the comments and the unmodelled fields.

## Assumptions

- **The agent pulls the ticket; the board contacts no tracker.** The board holds
  no credential, knows no tracker's interface, and makes no request of its own.
  This is what makes a second tracker an agent-side change rather than a product
  change.
- **The tracker's formatting is flattened before it arrives.** Trackers return
  rich documents; the board renders plain text and will not begin interpreting
  markup for this feature. Accepted cost: a table in a description arrives as
  plain text and reads as plain text.
- **The description and comment text get a larger limit than other reported
  text**, sized for real tickets rather than for prose an agent composes. The
  exact figures are a planning matter; the rule that a limit refuses rather than
  shortens is not.
- **Comments are held to a stated maximum**, and an overflow is counted and
  declared rather than dropped quietly. A ticket's discussion is the one part
  that has no natural bound.
- **Comments are shown oldest first**, because a discussion reads forward. This
  differs from notes, which are newest first, because notes are a log and a
  discussion is a thread.
- **The ticket is the source of the work; the stories and tasks remain the
  agent's own plan.** They are not compared, and the board will not compute or
  display a disagreement — the same position it already takes toward every other
  pair of sources.
- **One ticket per session at a time.** A session working two tickets at once is
  not a case this feature serves; the newest reported ticket is the one shown.
- **Presence is sticky for the life of the session**, which makes the held ticket
  the second thing that survives a report replacing everything else. That is a
  deliberate exception and it is why the ticket is held apart from the report
  rather than inside it.
- **Openable addresses in this feature are the ticket's and its parent's only.**
  Addresses elsewhere on the board — changed files, specification paths — stay
  text, and making them openable is separate work.
- **An additional navigation destination changes the chrome**, which the existing
  design exports do not show. A design revision is owed, and shortening an
  existing destination's label is available as part of it.
- **The agent-side adapters that read a tracker are out of scope here.** They
  are instructions rather than product surface, and they cannot be written
  usefully until the shape of a reported ticket is fixed — which is what this
  spec fixes. Also out of scope: keeping any record of past tickets, and
  rendering a tracker's markup.
- **Nothing is retained across a restart**, consistent with the rest of the
  product.
- **Being a local process is not authorisation.** Anything reported is validated
  before it is shown, and an address is validated before it is offered as
  openable, however it arrived.
