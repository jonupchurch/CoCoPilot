# Feature Specification: Stories and Tasks Tabs

**Feature Branch**: `006-stories-tasks-tabs`

**Created**: 2026-08-06

**Status**: Draft

**Input**: The two detail views. Stories lists the reported user stories and shows one in full — its narrative, acceptance criteria, tasks and the files it touches. Tasks scopes to one story and shows a single task in full — its detail, checks and files. Both are master–detail at a comfortable width and diverge below a breakpoint: Stories collapses its list into a picker, Tasks stacks its shorter list above the detail.

## Context

Where a developer goes when the Overview tab's summary is not enough. Both views
are read-only presentations of reported content — no editing, no filtering, no
re-ordering.

The actor is the **developer**, moving from "the agent is on task 13" to
"what is task 13 actually supposed to do, and does it match what I wanted?"

Both views must survive a panel that may be as narrow as the window's minimum,
which is what drives the layout divergence: a story list is several rows of
several lines, while a story's task list is a handful of single rows.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a story in full (Priority: P1)

A developer selects a reported story and reads what it is for — who wants it,
what they want, why — along with how it will be judged done and which tasks
belong to it.

**Why this priority**: The primary reason to leave the Overview tab. It answers
whether the agent is building the right thing, which no status can.

**Independent Test**: Report several stories and confirm one can be selected and
read in full, with narrative, criteria and its tasks.

**Acceptance Scenarios**:

1. **Given** reported stories, **When** the developer looks, **Then** they are
   listed with identifier, title, priority and status.
2. **Given** a listed story, **When** it is selected, **Then** its full detail
   is shown and the selection is visibly marked in the list.
3. **Given** a selected story, **When** the developer reads it, **Then** its
   narrative, acceptance criteria, tasks and touched files are shown as
   reported.
4. **Given** a story's tasks, **When** they are shown, **Then** each carries its
   status, and the current task is marked if it belongs to this story.
5. **Given** stories were reported in an order, **When** they are listed,
   **Then** that order is preserved.

---

### User Story 2 - Read one task in full (Priority: P2)

A developer narrows to a single task and reads its detail, the checks that
qualify it as done, and the files it involves.

**Why this priority**: The finest grain of "what is actually happening."
Valuable, but a developer usually arrives here from a story rather than starting
here.

**Independent Test**: Select a story, then a task within it, and confirm the
task's detail, checks and files are shown.

**Acceptance Scenarios**:

1. **Given** a selected story, **When** the developer opens the task view,
   **Then** that story's tasks are listed and one is shown in full.
2. **Given** a shown task, **When** the developer reads it, **Then** its detail,
   checks and files are shown as reported.
3. **Given** the task view, **When** the developer changes which story is
   scoped, **Then** the task list follows and a task from the new story is
   shown.
4. **Given** a task that is the current one, **When** it is shown, **Then** it
   is marked as current alongside how long ago that was reported.
5. **Given** a story with no tasks, **When** it is scoped, **Then** the view
   says so rather than showing an empty list without explanation.

---

### User Story 3 - Read a status that means nothing to the board (Priority: P2)

A developer sees a task whose status is text the board does not recognise. It is
shown exactly as the agent wrote it, with no colour or icon implying a meaning
the board has not established.

**Why this priority**: Equal to P2 because statuses are open-ended by design.
Handling only known values would make the views wrong in ordinary use, not in an
edge case.

**Independent Test**: Report tasks with a mix of recognised statuses and
arbitrary text, and confirm the recognised ones carry their treatments while the
rest render neutrally with text intact.

**Acceptance Scenarios**:

1. **Given** a task with a recognised status, **When** it is shown, **Then** it
   carries that status's established treatment.
2. **Given** a task with unrecognised status text, **When** it is shown,
   **Then** the text is displayed as reported in a neutral treatment.
3. **Given** a status differing from a recognised one only by case or
   surrounding whitespace, **When** it is shown, **Then** it is treated as
   recognised.
4. **Given** a status resembling but not matching a recognised one, **When** it
   is shown, **Then** it is treated as unrecognised.
5. **Given** status text too long for its space, **When** it is shown, **Then**
   it is truncated legibly and the full text remains retrievable.

---

### User Story 4 - Use both views in a narrow panel (Priority: P3)

A developer keeps the board narrow beside their editor and still uses both
views without losing the detail they came for.

**Why this priority**: Determines whether these views survive the product's
actual habitat. Below P1 and P2 only because the views must work before they can
adapt.

**Independent Test**: Reduce the window below the breakpoint and confirm each
view adopts its narrow arrangement, with all content reachable and no sideways
scrolling.

**Acceptance Scenarios**:

1. **Given** a window at or above the breakpoint, **When** either view is shown,
   **Then** list and detail appear side by side.
2. **Given** a window below the breakpoint, **When** the story view is shown,
   **Then** the list collapses into a picker and the detail takes the full
   width.
3. **Given** a window below the breakpoint, **When** the task view is shown,
   **Then** the list sits above the detail, both reachable by scrolling.
4. **Given** a narrow arrangement with a picker, **When** the developer opens
   it, **Then** every item is selectable, showing enough to tell them apart.
5. **Given** any supported width, **When** either view is shown, **Then** no
   horizontal scrolling is required.
6. **Given** a selection, **When** the window crosses the breakpoint in either
   direction, **Then** the selection is preserved.

---

### Edge Cases

- **A task belonging to no reported story.** Reachable rather than hidden by
  failing to match a parent.
- **A story whose task list references tasks that were not reported.** What was
  reported is shown; missing entries are not fabricated.
- **Very many stories or tasks.** Lists stay navigable and selection stays
  responsive.
- **Very long titles, criteria, paths or status text.** Truncated legibly with
  full text retrievable.
- **A report arriving while a story is selected.** The developer stays where
  they are if that story still exists; if it does not, the view moves somewhere
  valid rather than showing nothing.
- **No stories reported at all.** The view says so rather than rendering an
  empty frame.
- **Text containing markup.** Rendered as visible characters.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The story view MUST list reported stories with identifier, title,
  priority and status, in the order reported.
- **FR-002**: The story view MUST show one selected story in full — narrative,
  acceptance criteria, tasks and touched files — as reported.
- **FR-003**: The story view MUST visibly mark which story is selected.
- **FR-004**: The task view MUST scope to one story, list its tasks, and show
  one in full with its detail, checks and files.
- **FR-005**: The task view MUST allow the scoped story to be changed, updating
  the list and shown task accordingly.
- **FR-006**: Both views MUST mark the current task, with how long ago it was
  reported, wherever it appears.
- **FR-007**: Both views MUST display a recognised status using its established
  treatment, recognising a documented set of equivalent terms, ignoring case and
  surrounding whitespace.
- **FR-008**: Both views MUST display an unrecognised status as reported text in
  a neutral treatment that implies no meaning.
- **FR-009**: Both views MUST make the full text of any truncated content
  retrievable.
- **FR-010**: Both views MUST present list and detail side by side at or above a
  defined width, and adopt a narrow arrangement below it.
- **FR-011**: Below that width, the story view MUST collapse its list into a
  picker giving the detail full width; the task view MUST place its list above
  the detail.
- **FR-012**: Both views MUST preserve the current selection when the window
  crosses the width boundary in either direction.
- **FR-013**: Both views MUST avoid horizontal scrolling at every supported
  width.
- **FR-014**: Both views MUST preserve the developer's selection and scroll
  position when a report arrives, provided the selected item still exists.
- **FR-015**: When a selected item no longer exists after a report, both views
  MUST move to a valid selection rather than showing nothing.
- **FR-016**: Both views MUST show only reported content, and MUST NOT infer,
  derive, re-order or supply anything the agent did not send.
- **FR-017**: Both views MUST indicate emptiness explicitly rather than
  rendering an empty frame.
- **FR-018**: Both views MUST make every reported task reachable, including one
  belonging to no reported story.
- **FR-019**: Both views MUST render all reported text as inert content.
- **FR-020**: Both views MUST be read-only, offering no way to alter reported
  content or send anything to the agent.

### Key Entities

- **Story**: A reported user story — identifier, title, priority, status,
  narrative, acceptance criteria, associated tasks, touched files.
- **Task**: A reported unit of work — identifier, title, free-text status,
  detail, checks, files, and optionally a parent story.
- **Selection**: Which story and which task the developer is currently reading.
  Survives reports and layout changes; not retained across restarts.
- **Layout mode**: Side-by-side or narrow, determined solely by window width and
  differing per view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer moves from the Overview tab to the full text of the
  story behind the current task in no more than two actions.
- **SC-002**: Both views are fully usable at the window's minimum supported
  width, with all content reachable and no horizontal scrolling.
- **SC-003**: Selection survives an incoming report in 100% of cases where the
  selected item still exists.
- **SC-004**: Selection survives crossing the width boundary in 100% of cases.
- **SC-005**: An unrecognised status displays with its text intact and no colour
  implying meaning, in 100% of cases.
- **SC-006**: Both views display no content that was not reported — verifiable
  by field-by-field comparison against the report.
- **SC-007**: A list of 200 stories or 500 tasks remains navigable, with
  selection responding without perceptible delay.
- **SC-008**: No action available in either view transmits anything to an agent
  or alters reported content — verifiable by observing zero outbound requests.
- **SC-009**: Text containing markup renders as visible characters and never
  executes, in 100% of cases.

## Assumptions

- **The breakpoint is a single defined width**, chosen during planning, applying
  to both views even though their narrow arrangements differ.
- **The two narrow arrangements differ deliberately**, because the content
  differs: a story list is several multi-line rows and would push detail far
  down the panel, while a story's task list is a handful of single rows and
  stacks cheaply. Accepted cost: two behaviours across adjacent tabs.
- **Selection is not retained across restarts**, consistent with holding no
  durable state.
- **Ordering is the agent's**; the board never sorts, groups or filters.
- **The recognised status vocabulary is shared with the Overview tab**, defined
  once and applied consistently.
- **Only the selected session is shown**; concurrent sessions are feature 008.
- **Copy of displayed text is a general window affordance**, not specified here.
