# Feature Specification: Notes

**Feature Branch**: `007-notes`

**Created**: 2026-08-06

**Status**: Draft

**Input**: The notes view. Notes the agent wrote — because the user asked it to record something, or because the agent judged something worth recording. Newest first, flat rows with a relative-time gutter and a source line in the agent's voice. No cards, no pin, no save, no archive. A footer states plainly that closing the window clears them and that anything worth keeping should be written into the repository. A muted unread dot appears on the tab when a note arrives while the developer is elsewhere.

## Context

The only place on the board where content accumulates rather than being replaced
— and the only place where being honest about impermanence is itself a design
requirement.

The actor is the **developer**, who asks their agent to remember something, or
receives something the agent thought worth flagging.

The user never types here. They tell the agent, and the agent reports. That
keeps this view inside the same one-way flow as everything else, and it is why a
notes view exists at all in a product that takes no input.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read what the agent recorded (Priority: P1)

A developer opens the notes view and reads what their agent has written this
session, newest first, with how long ago each was written and why it exists.

**Why this priority**: The whole feature. Without it the notes an agent records
have nowhere to go.

**Independent Test**: Have an agent record several notes, then confirm the view
lists them newest first with relative times and stated reasons.

**Acceptance Scenarios**:

1. **Given** notes recorded this session, **When** the developer opens the view,
   **Then** they are listed newest first.
2. **Given** a listed note, **When** the developer reads it, **Then** its text
   is shown as written and how long ago it was recorded is shown.
3. **Given** a note carrying a stated reason for existing, **When** it is shown,
   **Then** that reason is shown alongside it in the agent's own phrasing.
4. **Given** a new note arrives while the view is open, **When** it is received,
   **Then** it appears at the top without any developer action, and reading
   position is not disturbed.
5. **Given** no notes have been recorded, **When** the developer opens the view,
   **Then** it says so plainly rather than showing an empty frame.

---

### User Story 2 - Understand that notes are not storage (Priority: P1)

A developer reading notes understands, without having to discover it the hard
way, that these disappear when the window closes and that anything worth keeping
belongs in the repository.

**Why this priority**: Equal to P1 because a notes view that *looks* like
storage is worse than no notes view. Someone who trusts it to persist loses
information, and the loss is silent.

**Independent Test**: Confirm the view states impermanence plainly, offers no
affordance implying durability, and that closing and reopening leaves it empty.

**Acceptance Scenarios**:

1. **Given** the notes view, **When** the developer looks at it, **Then** it
   states that closing the window clears these notes.
2. **Given** the notes view, **When** the developer looks for a way to keep a
   note, **Then** it says anything worth keeping should be written into the
   repository, and offers no save, pin, archive or export.
3. **Given** notes recorded this session, **When** the application is closed and
   reopened, **Then** none remain.
4. **Given** a note that has been shown, **When** the developer looks, **Then**
   nothing suggests it is stored, synced, backed up, or recoverable.

---

### User Story 3 - Notice a note without watching for it (Priority: P2)

A developer working in another view learns that a note arrived, without being
interrupted and without a number implying something to clear.

**Why this priority**: A note nobody sees was pointless to write. But a
notification treatment that nags would be worse than the occasional missed note,
so this earns its own story rather than being folded into the view.

**Independent Test**: With another view active, have a note arrive; confirm a
muted indicator appears on the notes tab, carries no count, and clears once the
view is visited.

**Acceptance Scenarios**:

1. **Given** the developer is in another view, **When** a note arrives, **Then**
   a muted indicator appears on the notes tab.
2. **Given** that indicator, **When** the developer looks at it, **Then** it
   shows no count.
3. **Given** the indicator, **When** the developer opens the notes view,
   **Then** it clears.
4. **Given** the developer is already in the notes view, **When** a note
   arrives, **Then** no indicator appears.
5. **Given** a note arrives, **When** it does, **Then** nothing steals focus,
   raises the window, or produces sound.

---

### User Story 4 - Read forty notes without losing the thread (Priority: P3)

A developer in a long session scrolls a substantial list and can still tell
where they are and what they are reading.

**Why this priority**: Only matters once a session has run long enough to
accumulate. Real, but later than the mechanics.

**Independent Test**: With several dozen notes, confirm the list remains
readable and navigable, each note remains individually legible, and its density
does not collapse into an undifferentiated block.

**Acceptance Scenarios**:

1. **Given** several dozen notes, **When** the developer scrolls, **Then** all
   are reachable and each remains individually legible.
2. **Given** a long note, **When** it is shown, **Then** it is legible without
   truncation obscuring its point.
3. **Given** a long list, **When** the developer looks at any part, **Then**
   relative times let them tell recent notes from old ones.
4. **Given** the window is narrow, **When** the list is shown, **Then** it
   stays readable without horizontal scrolling.

---

### Edge Cases

- **A note arriving before any report for its session.** Displayed normally; the
  session need not have reported anything else first.
- **Many notes arriving in quick succession.** All are listed in order, and the
  view does not flicker or reorder as they land.
- **A note whose text is a single character, or one at the maximum length.**
  Both display legibly.
- **A note carrying no stated reason.** Shown without one rather than with an
  invented or placeholder reason.
- **Notes belonging to a session the developer is not viewing.** Not shown; the
  view follows the selected session.
- **A note containing markup.** Rendered as visible characters.
- **A note arriving for a dismissed session.** The session returns, along with
  its note.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The view MUST list the selected session's notes, newest first.
- **FR-002**: The view MUST show each note's text as written.
- **FR-003**: The view MUST show how long ago each note was recorded, relative
  to now.
- **FR-004**: The view MUST show a note's stated reason for existing when one
  was supplied, and MUST NOT supply one when it was not.
- **FR-005**: The view MUST add an arriving note without any developer action
  and without disturbing reading position.
- **FR-006**: The view MUST state plainly that closing the window clears these
  notes.
- **FR-007**: The view MUST state that anything worth keeping should be written
  into the repository.
- **FR-008**: The view MUST NOT offer any means of saving, pinning, archiving,
  exporting or otherwise retaining a note, and MUST NOT imply that any exists.
- **FR-009**: The view MUST NOT offer any means of composing, editing or
  deleting a note.
- **FR-010**: The view MUST show an explicit empty state when the selected
  session has no notes.
- **FR-011**: The application MUST show a muted indicator on the notes
  destination when a note arrives for the selected session while another view is
  active.
- **FR-012**: That indicator MUST NOT show a count.
- **FR-013**: That indicator MUST clear when the notes view is visited.
- **FR-014**: An arriving note MUST NOT steal focus, raise the window, or
  produce sound.
- **FR-015**: The view MUST remain readable and navigable with at least several
  hundred notes.
- **FR-016**: The view MUST remain usable at the window's minimum supported
  width without horizontal scrolling.
- **FR-017**: The view MUST render all note text as inert content.
- **FR-018**: The view MUST show only the selected session's notes.

### Key Entities

- **Note**: One piece of text an agent recorded, with the time it arrived and
  optionally a stated reason. Belongs to one session. Appends rather than
  replaces, and does not survive the application closing.
- **Unread indicator**: A muted, countless mark on the notes destination,
  present when a note arrived while the developer was elsewhere.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer who asks their agent to note something finds it in the
  notes view without further instruction, in 100% of cases.
- **SC-002**: A developer reading the notes view correctly states that notes do
  not survive closing the window, without consulting documentation.
- **SC-003**: No affordance in the view implies durability — verifiable by
  confirming zero save, pin, archive or export controls exist.
- **SC-004**: An arriving note appears without developer action and without
  moving reading position, in 100% of cases.
- **SC-005**: A note arriving while another view is active produces exactly one
  muted, countless indicator, and no focus change, window raise or sound.
- **SC-006**: 300 notes remain scrollable and individually legible, with no
  perceptible delay.
- **SC-007**: After a restart, the notes view is empty in 100% of cases.
- **SC-008**: The view is usable at the minimum supported width with no
  horizontal scrolling.
- **SC-009**: Note text containing markup renders as visible characters and
  never executes, in 100% of cases.

## Assumptions

- **The append capability is specified in feature 001.** This feature is the
  view, plus the unread indicator.
- **The impermanence statement is permanent chrome, not a dismissible notice.**
  A warning that can be dismissed stops being read, and this one has to be true
  every time.
- **Copy is a general window affordance**, not specified here.
- **No grouping, filtering or search.** With relative times as the only
  structure, a long list is a flat column. Accepted for now; grouping is the
  obvious future addition if sessions get long enough to need it.
- **Notes are per session**, matching the rest of the board.
- **Notes are not counted anywhere**, including in tab labels — a count invites
  clearing, and there is nothing to clear.
