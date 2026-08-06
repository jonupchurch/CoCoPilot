# Feature Specification: Overview Tab

**Feature Branch**: `004-overview-tab`

**Created**: 2026-08-06

**Status**: Draft

**Input**: The default view — the agent-reported sections of the board. Spec (the feature and its tasks), Plan (the steps the agent is working through), Focus (which task is current and the agent's prose about it), and Changed files. Sections are separated by a rule and a label, each header collapsible and carrying its own summary so a collapsed section still answers its question.

## Context

The view a developer leaves open. Everything in it comes from what the agent
reported — features 5's transcript-derived sections live in the same tab but are
specified separately.

The actor is the **developer**, checking on work in progress without
interrupting it.

The organising idea, carried from the design: **every section header carries its
own summary**, so a collapsed section still answers the question it exists to
answer. A developer with three sections closed can still see how far the plan
has got and how much has changed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See what the agent is doing right now (Priority: P1)

A developer looks at the board and sees which task the agent is on and what it
said about it — in the agent's own words, not a status code.

**Why this priority**: The single most valuable thing on the board. It is the
question the developer would otherwise interrupt the agent to ask.

**Independent Test**: Report a session naming a current task with prose, and
confirm the view shows both, marked as current and distinguishable from other
tasks.

**Acceptance Scenarios**:

1. **Given** a report naming a current task, **When** the developer looks,
   **Then** that task is identified and visibly marked as the current one.
2. **Given** a report carrying the agent's prose, **When** the developer looks,
   **Then** the prose is shown as written.
3. **Given** the current task marker, **When** time passes without a new report,
   **Then** the marker states how long ago it was reported rather than fading,
   changing colour, or implying the agent is still there.
4. **Given** a newer report naming a different current task, **When** it
   arrives, **Then** the marker moves.
5. **Given** a report naming no current task, **When** the developer looks,
   **Then** the section says so rather than marking an arbitrary task.

---

### User Story 2 - See the feature and its tasks at a glance (Priority: P2)

A developer sees which feature is being worked, its tasks, and how many are
done — without opening anything.

**Why this priority**: Turns "the agent is doing something" into "the agent is
five tasks into a nine-task feature." That progress framing is the reason to
watch a board rather than read a log.

**Independent Test**: Report a feature with a mix of task statuses and confirm
the section header summarises completion while the expanded section lists each
task with its status.

**Acceptance Scenarios**:

1. **Given** a reported feature, **When** the developer looks, **Then** its
   identifier and title are shown.
2. **Given** reported tasks, **When** the section is expanded, **Then** each is
   listed with its identifier, title and status as reported.
3. **Given** the section is collapsed, **When** the developer looks at its
   header, **Then** a completion summary is still visible.
4. **Given** a task whose status is one the board recognises, **When** it is
   shown, **Then** it carries that status's established visual treatment.
5. **Given** a task whose status is not recognised, **When** it is shown,
   **Then** the status text is displayed as reported, in a neutral treatment
   that claims nothing about its meaning.

---

### User Story 3 - Follow the plan the agent is working through (Priority: P3)

A developer sees the sequence of steps the agent said it would take and where in
that sequence it currently is.

**Why this priority**: Answers "how much longer" better than a task list,
because a plan is ordered. Valuable but secondary to knowing what is happening
right now.

**Independent Test**: Report a plan of several steps with one in progress and
confirm the section shows the sequence, marks the current step, and summarises
position in its header.

**Acceptance Scenarios**:

1. **Given** a reported plan, **When** the section is expanded, **Then** the
   steps are shown in the reported order.
2. **Given** a plan with a step in progress, **When** the developer looks,
   **Then** that step is distinguishable from completed and upcoming ones.
3. **Given** the section is collapsed, **When** the developer looks at its
   header, **Then** position within the plan is still visible.
4. **Given** no plan was reported, **When** the developer looks, **Then** the
   section is absent or empty rather than showing a fabricated plan.

---

### User Story 4 - See what has changed (Priority: P4)

A developer sees which files the agent says it has touched and roughly how much.

**Why this priority**: Lowest of the four, by explicit decision. It is also the
section whose information is most likely to be stale, since it changes only when
the agent reports.

**Independent Test**: Report a set of changed files with change types and
confirm they are listed with a summary in the collapsed header.

**Acceptance Scenarios**:

1. **Given** reported changed files, **When** the section is expanded, **Then**
   each is listed with its path and the kind of change reported.
2. **Given** the section is collapsed, **When** the developer looks at its
   header, **Then** an aggregate summary is visible.
3. **Given** a file the agent flagged as needing attention, **When** it is
   shown, **Then** it is distinguishable from ordinary changes.
4. **Given** the repository is edited outside the agent, **When** the developer
   looks, **Then** the section is unchanged — it shows what was reported, not
   what is on disk.

---

### User Story 5 - Collapse what is not needed right now (Priority: P5)

A developer closes sections they are not watching so the ones they are fit on
screen together.

**Why this priority**: What makes the view work in a narrow panel over a long
session, but the view is useful before it is customisable.

**Independent Test**: Collapse and expand each section, confirm content hides
and reveals, sections below move up, and each collapsed header still summarises.

**Acceptance Scenarios**:

1. **Given** an expanded section, **When** its header is activated, **Then** it
   collapses and the sections below move up.
2. **Given** a collapsed section, **When** its header is activated, **Then** it
   expands again.
3. **Given** any collapsed section, **When** the developer looks, **Then** its
   label and its summary remain visible.
4. **Given** a chosen arrangement, **When** a report arrives, **Then** the
   arrangement is preserved.
5. **Given** every section collapsed, **When** the developer looks, **Then**
   each question is still answered by its header alone.

---

### Edge Cases

- **A report with a current task not present in the task list.** The current
  task is shown as reported rather than discarded for failing to match.
- **Very many tasks in one feature.** The section stays navigable and the
  header summary stays accurate.
- **Very long titles, paths or status text.** Content degrades gracefully;
  identifying information stays readable and full text stays retrievable.
- **A report with no feature at all.** Sections that have nothing to show say so
  rather than rendering empty frames.
- **A status string that differs only in case or spacing from a recognised
  one.** Recognition is insensitive to those differences.
- **A status string resembling but not matching a recognised value.** It is
  treated as unrecognised — a near miss is not a match.
- **Prose containing markup.** Rendered as visible characters, never
  interpreted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The view MUST show the current task the agent reported, visibly
  distinguished from other tasks.
- **FR-002**: The view MUST show, alongside the current task, how long ago it
  was reported, expressed as elapsed time.
- **FR-003**: The view MUST NOT alter the current-task marker's appearance based
  on elapsed time, and MUST NOT remove it because time has passed.
- **FR-004**: The view MUST show the agent's prose about the current task as
  written.
- **FR-005**: The view MUST show the reported feature's identifier and title.
- **FR-006**: The view MUST list reported tasks with identifier, title and
  status.
- **FR-007**: The view MUST display a recognised status using its established
  visual treatment, and MUST recognise a documented set of equivalent terms.
- **FR-008**: The view MUST display an unrecognised status as reported text in a
  neutral treatment, and MUST NOT assign it any treatment that would imply a
  meaning.
- **FR-009**: The view MUST make the full text of any truncated status, title or
  path retrievable.
- **FR-010**: The view MUST show reported plan steps in order, distinguishing
  the current step.
- **FR-011**: The view MUST list reported changed files with path and kind of
  change, distinguishing any flagged as needing attention.
- **FR-012**: The view MUST divide content into sections, each with a label and
  a collapsible header.
- **FR-013**: Every section header MUST carry a summary of that section's
  content, visible whether the section is expanded or collapsed.
- **FR-014**: The view MUST allow each section to be collapsed and expanded
  independently, reflowing the sections below.
- **FR-015**: The view MUST preserve the developer's section arrangement and
  scroll position when a report arrives.
- **FR-016**: The view MUST show only what was reported, and MUST NOT infer,
  derive, or supply any content the agent did not send.
- **FR-017**: The view MUST indicate emptiness for any section with nothing to
  show, rather than rendering an empty frame.
- **FR-018**: The view MUST render all reported text as inert content.
- **FR-019**: The view MUST remain usable at the window's minimum supported
  width without horizontal scrolling.

### Key Entities

- **Section**: A labelled, collapsible division with a summary in its header.
  The organising unit of the view.
- **Current-task marker**: The indication of which task the agent last said it
  was working on, with elapsed time. Distinct from any task's status.
- **Recognised status vocabulary**: The documented set of status terms, and
  their equivalents, that carry established visual treatments. Everything else
  is neutral.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer identifies what the agent is currently working on
  within 3 seconds of looking.
- **SC-002**: With every section collapsed, a developer can still state the
  feature's completion, position in the plan, and volume of change — from
  headers alone.
- **SC-003**: An unrecognised status is displayed with its text intact and no
  colour implying a meaning, in 100% of cases.
- **SC-004**: Section arrangement and scroll position survive an incoming report
  in 100% of cases.
- **SC-005**: The view displays no content that was not reported — verifiable by
  comparing rendered content against the report field by field.
- **SC-006**: Editing the repository outside the agent produces no change in the
  view, in 100% of cases.
- **SC-007**: The view is usable at the minimum supported width with no
  horizontal scrolling and no unreachable content.
- **SC-008**: Text containing markup renders as visible characters and never
  executes, in 100% of cases.
- **SC-009**: A section with 500 tasks remains navigable, with an accurate
  header summary.

## Assumptions

- **This spec covers only agent-reported sections.** The prompt, history and
  in-context sections share this tab but come from a different source and are
  feature 005.
- **The recognised vocabulary is documented and small**, matching the terms the
  design already treats; it can grow without changing this spec, since
  unrecognised statuses have defined behaviour.
- **Recognition ignores case and surrounding whitespace**, because agents will
  not be consistent about either. It does not attempt fuzzy matching — a near
  miss is unrecognised, which fails safe.
- **Section arrangement is not remembered across restarts**, consistent with
  holding no durable state.
- **Ordering within sections is the agent's**, not re-sorted by the board.
- **Only the selected session is shown**; concurrent sessions are feature 008.
