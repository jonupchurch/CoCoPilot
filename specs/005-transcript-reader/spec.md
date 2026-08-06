# Feature Specification: Transcript Reader

**Feature Branch**: `005-transcript-reader`

**Created**: 2026-08-06

**Status**: Draft

**Input**: The one thing the board reads from disk. Follows the AI tool's own session transcript for the repository being shown, and feeds three sections of the Overview tab — the last prompt, the history of earlier prompts, and the files currently in context. Read-only, resolved from the reported repository path without configuration, and degrading to absence rather than failure when the format is not what we expect.

## Context

Everything else on the board arrives because an agent chose to report it. These
three sections cannot work that way: an agent cannot honestly report its own
prompt history or how much context it is holding. So the board reads the AI
tool's own transcript instead.

The actor is the **developer**, who wants to see what was asked, not only what
was done.

Two things make this safe. It is **read-only** — the transcript belongs to
another program. And it is **narrow**: exactly three display sections depend on
it, so when the format changes, three sections degrade and nothing else in the
product notices.

This is also the only source that survives a restart, because it is on disk
rather than in memory.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what the agent was actually asked (Priority: P1)

A developer sees the most recent instruction given to the agent, in full,
alongside what the agent has been doing about it.

**Why this priority**: Reframes everything else on the board. "Editing the auth
middleware" means one thing after "fix the login bug" and something quite
different after "delete the auth system."

**Independent Test**: With a session in progress, confirm the view shows the
most recent prompt, matching what was actually typed.

**Acceptance Scenarios**:

1. **Given** a session with at least one prompt, **When** the developer looks,
   **Then** the most recent prompt is shown as written.
2. **Given** a new prompt is submitted, **When** it is recorded, **Then** the
   view reflects it without any developer action.
3. **Given** a prompt longer than the space available, **When** it is shown,
   **Then** it is legible and its full text is retrievable.
4. **Given** no transcript can be found, **When** the developer looks, **Then**
   the section reports that this information is unavailable rather than showing
   an error or appearing empty for no stated reason.

---

### User Story 2 - Look back over earlier prompts (Priority: P2)

A developer picking a thread back up reads earlier prompts in the session, opens
one in full, and copies it to reuse.

**Why this priority**: The most common way a long session is resumed — finding
the instruction that produced the current state. Genuinely useful, but the
current prompt carries more value per pixel.

**Independent Test**: With several prompts in a session, confirm they are listed
newest first with relative times, that one can be expanded to its full text, and
that copying puts exactly that text on the clipboard.

**Acceptance Scenarios**:

1. **Given** a session with several prompts, **When** the developer looks,
   **Then** earlier prompts are listed with how long ago each was given.
2. **Given** a listed prompt, **When** the developer expands it, **Then** its
   full untruncated text is shown in place.
3. **Given** a listed prompt, **When** the developer copies it, **Then** exactly
   that text reaches the clipboard, and the action confirms itself briefly.
4. **Given** a session with more prompts than are listed, **When** the developer
   looks, **Then** the total count is stated.
5. **Given** the board is closed and reopened, **When** the developer looks,
   **Then** history from before the restart is present — unlike everything else
   on the board.

---

### User Story 3 - See what the agent is holding in context (Priority: P3)

A developer sees which files the agent currently has in view, and which it is
reading right now.

**Why this priority**: Answers "does it even know about the file I care about?"
— a question that otherwise costs an interruption. Lower than history because
it is a narrower question.

**Independent Test**: With an agent reading files, confirm the section lists
them and distinguishes one being actively read.

**Acceptance Scenarios**:

1. **Given** an agent with files in context, **When** the developer looks,
   **Then** those files are listed.
2. **Given** a file being actively read, **When** the developer looks, **Then**
   it is distinguishable from files merely held.
3. **Given** the section is collapsed, **When** the developer looks at its
   header, **Then** an aggregate summary is visible.
4. **Given** context information is not available in the transcript, **When**
   the developer looks, **Then** the section says so rather than showing zero
   files as though that were the answer.

---

### User Story 4 - Nothing breaks when the transcript is not what we expect (Priority: P1)

The transcript belongs to another program and can change without warning. When
it does, the three sections that depend on it say they are unavailable, and
every other part of the board carries on untouched.

**Why this priority**: Equal to P1 because it is what makes depending on an
undocumented, externally-owned format acceptable at all. Without it, a change in
someone else's software breaks the product.

**Independent Test**: Present a transcript that is missing, unreadable,
truncated mid-record, or in an unrecognised shape, and confirm the three
sections report unavailability while everything else works normally.

**Acceptance Scenarios**:

1. **Given** no transcript exists for the repository, **When** the developer
   looks, **Then** the three sections report unavailability and the rest of the
   board is unaffected.
2. **Given** a transcript in an unrecognised format, **When** it is read,
   **Then** the sections report unavailability rather than displaying garbled
   content, and nothing crashes.
3. **Given** a transcript that is partially readable, **When** it is read,
   **Then** what can be read is shown and the remainder is skipped silently.
4. **Given** a transcript being written while it is read, **When** an incomplete
   record is encountered, **Then** it is skipped and reading continues.
5. **Given** a transcript that cannot be accessed due to permissions, **When**
   it is read, **Then** unavailability is reported rather than a failure being
   raised.
6. **Given** any transcript at all, **When** it is processed, **Then** it is
   only ever read — never modified, moved, or deleted.

---

### Edge Cases

- **Several transcripts exist for one repository**, from separate sessions. The
  one corresponding to the session being shown is used.
- **A very large transcript** from a long session. Reading it does not make the
  board unresponsive.
- **A transcript containing text that looks like markup.** Rendered as visible
  characters.
- **The repository path reported does not resolve to any transcript.** Reported
  as unavailable, not as an error.
- **The transcript is deleted or rotated while the board is open.** Sections
  become unavailable without disturbing anything else.
- **Prompts containing secrets.** Displayed as written — the board is a mirror,
  not a filter. Noted so the exposure is a known, accepted property.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The board MUST locate the transcript for the session being shown
  using the reported repository path, without any configuration by the user.
- **FR-002**: The board MUST open transcripts strictly read-only, and MUST NOT
  create, modify, move, or delete any transcript or any file beside it.
- **FR-003**: The board MUST show the most recent prompt from the session's
  transcript.
- **FR-004**: The board MUST list earlier prompts newest first, each with how
  long ago it was given.
- **FR-005**: The board MUST allow an individual prompt to be expanded to its
  full untruncated text.
- **FR-006**: The board MUST allow a prompt's exact text to be copied, and MUST
  confirm the action briefly.
- **FR-007**: The board MUST state the total number of prompts when more exist
  than are listed.
- **FR-008**: The board MUST list files the transcript shows as being in
  context, distinguishing one being actively read.
- **FR-009**: The board MUST update these sections as the transcript grows,
  without any developer action.
- **FR-010**: The board MUST report unavailability for a section whose
  underlying information cannot be read, distinguishably from that information
  being genuinely empty.
- **FR-011**: The board MUST continue functioning normally in every other
  respect when transcript reading fails for any reason.
- **FR-012**: The board MUST skip records it cannot interpret and continue
  reading the remainder.
- **FR-013**: The board MUST NOT let transcript reading make the window
  unresponsive, at any transcript size.
- **FR-014**: The board MUST render all transcript-derived text as inert
  content.
- **FR-015**: The board MUST confine transcript-derived information to the
  sections that display it, and MUST NOT use it to alter, correct, or
  contradict anything an agent reported.
- **FR-016**: The board MUST read only transcripts belonging to the session
  being shown, and MUST NOT read any other file on the system.

### Key Entities

- **Transcript**: The AI tool's own record of a session, owned by that tool,
  read-only here. Located from the repository path.
- **Prompt record**: One instruction given to the agent, with the time it was
  given.
- **Context entry**: One file the transcript indicates the agent is holding,
  possibly marked as being actively read.
- **Availability state**: Per section — available, genuinely empty, or
  unreadable. The third must never be presented as the second.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer reads the instruction the agent is working from
  without leaving the board, in 100% of sessions where a transcript exists.
- **SC-002**: A copied prompt matches the original exactly, character for
  character, in 100% of copies.
- **SC-003**: A missing, unreadable, or unrecognised transcript degrades exactly
  three sections and leaves every other part of the board fully functional, in
  100% of cases.
- **SC-004**: No transcript file is created, modified, moved, or deleted —
  verifiable by observing zero write operations against the transcript location.
- **SC-005**: No file outside the transcript location for the session being
  shown is read — verifiable by observing read operations.
- **SC-006**: A section that cannot read its source is visibly distinct from one
  that has nothing to show, in 100% of cases.
- **SC-007**: The window stays responsive with a transcript of at least 100 MB.
- **SC-008**: History from before a restart is present after reopening, in 100%
  of cases where the transcript survives.
- **SC-009**: Transcript text containing markup renders as visible characters
  and never executes, in 100% of cases.

## Assumptions

- **The transcript location is derived from the repository path** by a documented
  rule, so no configuration is needed. If that rule stops holding, the sections
  report unavailability, which is the designed failure.
- **The format is undocumented and may change without notice.** Every
  requirement here is written so that a change degrades rather than breaks.
  Tracking upstream changes is ongoing maintenance, accepted when this source
  was chosen.
- **Transcript content is displayed, never filtered.** A prompt containing a
  secret is shown, because the alternative is a board that silently withholds
  what was actually said. The exposure is real and accepted; it is why the
  service is reachable only from the local machine.
- **How many prompts are listed before summarising is a display choice** made
  during planning, not a requirement here.
- **The board never reconciles transcript content against agent reports.**
  Contradictions between them are not detected or surfaced.
- **Only the session being shown is read**; no background reading of other
  sessions' transcripts.
