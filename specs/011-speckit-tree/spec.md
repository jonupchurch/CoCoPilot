# Feature Specification: Spec-Kit Tree

**Feature Branch**: `011-speckit-tree`

**Created**: 2026-08-12

**Status**: Implemented

**Input**: One tab holding the whole shape of the work — reported user stories at the top level, each expanding to the tasks that belong to it, with a pane beside the tree showing the detail and status of whatever is selected. Offered only to a session that has reported stories, because not every project is a Spec-Kit project; and where it is offered, it stands in place of the separate story and task views rather than beside them. A task is placed by its own declaration of which story it serves, with those belonging to no story gathered at the end. A story that says nothing about its own state has its progress counted from the tasks beneath it.

## Context

The board shows stories in one tab and tasks in another. Both are lists of the
same work seen from two ends, and the relationship between them — which tasks
serve which story — is reported by the agent and shown by neither. A developer
who wants it holds it in their head, or scopes the task view to a story one at a
time and remembers what they saw.

The actor is the **developer watching an agent work**, the same actor features
004–008 serve — but this feature is the first to notice that this actor comes in
two kinds. A developer working a specced feature has stories, and the tree is the
right shape for their work. A developer on a project that has never seen Spec-Kit
has tasks and no stories, and a tree whose top level is stories has nothing to
offer them. The board should not present the same navigation to both.

The relationship the tree draws already exists in what agents report, in both
directions and both optional: a task may name the story it serves, and a story
may name the tasks that serve it. **Nothing in the contract changes for this
feature.** What changes is that the board finally draws a relationship it has
been receiving since the beginning, and stops offering two views of it where one
will do.

One thing here is a departure rather than an addition, and it is recorded as such
in Assumptions: the board shows a value nobody reported. That reverses a numbered
requirement of feature 006. It is deliberate, and the spec states its cost.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the shape of the work (Priority: P1)

A developer opens one tab and sees the feature's stories, and under any story
they expand, the tasks that serve it — the decomposition the agent reported,
drawn as the tree it always was.

**Why this priority**: It is the feature. The detail pane has nothing to show
without a selection, and the counted progress has nothing to summarise.

**Independent Test**: Report stories and tasks with the links between them and
confirm each task appears beneath the story it names, once, in the reported
order.

**Acceptance Scenarios**:

1. **Given** stories and tasks that name them, **When** the developer opens the
   tab, **Then** the stories are listed in the order reported.
2. **Given** a listed story, **When** the developer expands it, **Then** the
   tasks that name it appear beneath it in the order reported.
3. **Given** an expanded story, **When** the developer collapses it, **Then** its
   tasks are hidden and the story remains.
4. **Given** a task naming one story while a different story names that task,
   **When** the tree is drawn, **Then** the task appears beneath the story it
   names itself, and beneath no other.
5. **Given** a task naming no story that no story names either, **When** the tree
   is drawn, **Then** it appears in a final group for tasks belonging to no
   story.
6. **Given** no such task, **When** the tree is drawn, **Then** that group is not
   present at all.
7. **Given** a task naming a story that was not reported, **When** the tree is
   drawn, **Then** no story is invented for it and it is placed as though it
   named none.
8. **Given** a story with no tasks beneath it, **When** it is expanded, **Then**
   the view says it has none rather than showing an empty frame.

---

### User Story 2 - Read one thing in full (Priority: P1)

The developer selects a story or a task and reads it in full beside the tree —
the narrative and criteria of a story, the detail and checks of a task — without
losing sight of where it sits in the work.

**Why this priority**: A tree of titles is a table of contents. The reason to
combine the two views is to stop the developer choosing between seeing structure
and seeing content, and that is only true once both are on screen together.

**Independent Test**: Select a story, then a task, and confirm each shows every
field that was reported for it and nothing that was not.

**Acceptance Scenarios**:

1. **Given** the tree, **When** the developer selects a story, **Then** the pane
   shows that story's narrative, its acceptance criteria, its priority and its
   status, and every one of those that was not reported is absent.
2. **Given** the tree, **When** the developer selects a task, **Then** the pane
   shows that task's detail, its checks, its files and its status, each only if
   reported.
3. **Given** a selection, **When** the developer reads the pane, **Then** it is
   evident whether a story or a task is being shown.
4. **Given** no selection, **When** the developer looks at the pane, **Then** it
   says so rather than showing an empty frame.
5. **Given** a selected task, **When** the developer collapses the story above
   it, **Then** the pane goes on showing that task.
6. **Given** any reported text containing markup, **When** it is shown in the
   pane, **Then** it appears as written and none of it is interpreted.

---

### User Story 3 - Work on a project that is not Spec-Kit shaped (Priority: P1)

A developer whose project has no user stories never sees a tree that would have
nothing in it, and goes on using the task view they have always used.

**Why this priority**: Without it the feature makes the board worse for every
project that is not Spec-Kit shaped — a destination that can only ever be empty,
in place of one that worked. It is also what keeps the navigation from growing:
where the tree appears, two destinations leave.

**Independent Test**: Report tasks and no stories, and confirm the tree is not
offered and the story and task views are exactly as they were.

**Acceptance Scenarios**:

1. **Given** a session that has reported no stories, **When** the developer
   looks, **Then** no tree view is offered and the separate story and task views
   are.
2. **Given** such a session, **When** a report carrying stories arrives, **Then**
   the tree view is offered.
3. **Given** a session offered the tree view, **When** the developer looks,
   **Then** the separate story and task views are not offered.
4. **Given** a session where the developer has already opened the story or task
   view, **When** the tree view becomes available, **Then** those views remain
   offered for the rest of that session.
5. **Given** a session offered the tree view, **When** a later report carries no
   stories, **Then** the tree view is still offered.
6. **Given** two held sessions, one with stories and one without, **When** the
   developer switches between them, **Then** each is offered the navigation its
   own reports have earned.

---

### User Story 4 - See how a story is going without opening it (Priority: P2)

A developer scanning collapsed stories sees how much of each is done, counted
from the tasks beneath it, and can tell that the board counted it rather than the
agent having said it.

**Why this priority**: It is what makes a collapsed tree worth collapsing. Held
behind the tree and the pane because it is the one thing here the board computes,
and it is only safe once the tasks it counts are visibly correct.

**Independent Test**: Report a story with no status of its own and tasks in mixed
states; confirm the counted progress matches the tasks and is presented as the
board's own.

**Acceptance Scenarios**:

1. **Given** a story reporting no status whose tasks are in mixed states, **When**
   the developer looks, **Then** progress counted from those tasks is shown.
2. **Given** that counted progress, **When** the developer looks, **Then** it is
   distinguishable from a status the agent reported.
3. **Given** a story that reports its own status, **When** the developer looks,
   **Then** that status is shown exactly as reported.
4. **Given** a story reporting a status that disagrees with the state of its
   tasks, **When** the developer looks, **Then** the board presents no
   disagreement between them.
5. **Given** tasks whose statuses the board does not recognise, **When** progress
   is counted, **Then** those tasks are not counted as any recognised outcome and
   their number is stated.
6. **Given** a story with no reported status and no tasks beneath it, **When** the
   developer looks, **Then** no status and no progress are shown.

---

### User Story 5 - Keep your place while the agent works (Priority: P2)

The developer expands a story, selects a task, reads it — and goes on reading
while report after report arrives.

**Why this priority**: This board's rule is that an agent's report never moves the
human's attention. A tree has more state to lose than a list — expansion,
selection and scroll — so the rule costs more here and is worth its own story.

**Independent Test**: Expand, select and scroll, then send ten reports and confirm
all three are unchanged.

**Acceptance Scenarios**:

1. **Given** an expanded story and a selected task, **When** reports arrive,
   **Then** the expansion, the selection and the scroll position are unchanged.
2. **Given** a report adding a new story or task, **When** it arrives, **Then**
   nothing already on screen moves out from under the reader.
3. **Given** a selected task, **When** a report no longer contains it, **Then**
   the view says the selection is gone rather than silently selecting something
   else.
4. **Given** an expanded story, **When** a report no longer contains it, **Then**
   its disappearance does not collapse or expand any other story.
5. **Given** a developer reading any view, **When** the navigation changes because
   the session became Spec-Kit shaped, **Then** the view they are reading is not
   taken away from them.

---

### User Story 6 - Use the tree in a narrow panel (Priority: P3)

A developer with the board docked beside their editor uses the tree and the detail
together, or one then the other, without the window scrolling sideways.

**Why this priority**: The board is a panel beside an editor as often as it is a
window. Behind the rest because a tree that is correct and unreadable at the
minimum width is still a tree that can be fixed.

**Independent Test**: Drive the window to the minimum supported width with a full
tree and a selection, and confirm both remain usable with no horizontal scroll.

**Acceptance Scenarios**:

1. **Given** the minimum supported width, **When** the developer uses the tab,
   **Then** the tree and the detail are both reachable and neither is truncated
   into uselessness.
2. **Given** any supported width, **When** the developer uses the tab, **Then**
   nothing scrolls horizontally.
3. **Given** a long-titled entry, **When** it is shown at the minimum width,
   **Then** it degrades legibly and its full value stays retrievable.
4. **Given** every destination the board offers, **When** the tab strip is drawn
   at the minimum width, **Then** each remains legible and operable.

---

### Edge Cases

- **Tasks reported with no stories at all.** Not a Spec-Kit session: the tree is
  not offered and the task view serves it, exactly as before this feature.
- **The first report of a session already carries stories.** The tree is offered
  from the beginning and the separate views never appear, which is the ordinary
  case for a Spec-Kit project.
- **Stories arrive while the developer is reading the task view.** They have used
  it, so it stays for the life of the session. Nothing is taken from under them.
- **Stories arrive for a developer who has never opened either view.** Those
  destinations go, and nothing they were reading is affected.
- **A session that reported stories then reports none.** The tree stays. A report
  is not allowed to withdraw a destination, and a session that has been Spec-Kit
  shaped stays that way until it goes.
- **A story naming a task that was not reported.** Named and absent; nothing is
  invented, and the story shows only the tasks that exist.
- **Two tasks reporting the same identifier.** Both are shown where they claim to
  belong; the board does not merge them or pick one.
- **Every task belonging to no story.** All of them gather in the final group and
  the stories above list none, which is a legible state rather than an empty one.
- **A status the board's vocabulary does not recognise.** Shown as written,
  treated as no recognised outcome, and counted separately in any progress.
- **A story with fifty tasks, and fifty stories.** Remains scrollable and legible;
  expansion does not become the only way to find anything.
- **Selecting a task, then collapsing its story.** The selection survives the
  collapse — collapsing hides rows, it does not deselect.
- **A restart.** Nothing is held, like everything else on this board.

## Requirements *(mandatory)*

### Functional Requirements

**When the tree is offered, and what it displaces**

- **FR-001**: The application MUST offer the tree view for a session that has
  reported at least one story.
- **FR-002**: The application MUST NOT offer the tree view for a session that has
  reported no stories.
- **FR-003**: The application MUST continue to offer the tree view for the life of
  a session once it has been offered, including when a later report carries no
  stories.
- **FR-004**: The application MUST NOT offer the separate story and task views for
  a session that is offered the tree view.
- **FR-005**: The application MUST continue to offer the separate story and task
  views for the life of a session in which the developer has opened either of
  them, even once the tree view is offered.
- **FR-006**: The application MUST decide which views a session is offered from
  that session's own reports and the developer's own use of that session.
- **FR-007**: The application MUST NOT take away a view the developer is currently
  reading.

**The tree and how it is built**

- **FR-008**: The application MUST present reported stories as the tree's top
  level, in the order reported.
- **FR-009**: The application MUST allow each story to be expanded to reveal the
  tasks belonging to it, and collapsed again.
- **FR-010**: The application MUST place a task beneath the story the task itself
  names, and MUST use a story's own list of tasks to place only a task that names
  no story.
- **FR-011**: The application MUST show any task at most once in the tree.
- **FR-012**: The application MUST gather tasks belonging to no reported story
  into a final group, so that every reported task is reachable.
- **FR-013**: The application MUST omit that group entirely when no task belongs
  to it.
- **FR-014**: The application MUST treat a task naming a story that was not
  reported as though it named none, and MUST NOT create a story for it.
- **FR-015**: The application MUST list tasks within a story in the order
  reported.
- **FR-016**: The application MUST say a story has no tasks rather than showing an
  empty container for them.

**The detail pane**

- **FR-017**: The application MUST show, beside the tree, the full detail of the
  selected story or task.
- **FR-018**: The application MUST show for a selected story its narrative, its
  acceptance criteria, its priority and its status, omitting each that was not
  reported.
- **FR-019**: The application MUST show for a selected task its detail, its
  checks, its files and its status, omitting each that was not reported.
- **FR-020**: The application MUST make it evident whether the pane is showing a
  story or a task.
- **FR-021**: The application MUST state that nothing is selected rather than
  presenting an empty pane.
- **FR-022**: The application MUST continue to show a selected task whose story
  has been collapsed.

**Status, and the one derived value**

- **FR-023**: The application MUST display a recognised status in its established
  treatment, and an unrecognised status as reported text with no recognised
  treatment.
- **FR-024**: The application MUST show a story's reported status exactly as
  reported.
- **FR-025**: The application MUST show, for a story that reports no status,
  progress counted from the tasks placed beneath it.
- **FR-026**: The application MUST present that counted progress as the board's
  own, distinguishable from any status an agent reported.
- **FR-027**: The application MUST NOT count a task whose status it does not
  recognise as any recognised outcome, and MUST state how many such tasks a count
  covers.
- **FR-028**: The application MUST show no status and no progress for a story that
  reports no status and has no tasks placed beneath it.
- **FR-029**: The application MUST NOT present any disagreement between a story's
  reported status and the state of its tasks.

**Keeping the developer's place**

- **FR-030**: The application MUST preserve which stories are expanded across
  reports.
- **FR-031**: The application MUST preserve the selection across reports.
- **FR-032**: The application MUST preserve the scroll position across reports.
- **FR-033**: The application MUST NOT change expansion, selection or scroll
  position as a consequence of a report arriving.
- **FR-034**: The application MUST state that a selection is gone when a report no
  longer contains it, rather than selecting something else in its place.

**The rest**

- **FR-035**: The application MUST keep every navigation destination legible and
  operable at the window's minimum supported width, without horizontal scrolling.
- **FR-036**: The application MUST show only reported content, with the counted
  progress of FR-025 as the single exception, and MUST NOT infer, derive, or
  supply anything else the agent did not send.
- **FR-037**: The application MUST render all reported text as plain, inert
  content, and MUST NOT interpret any part of it as markup.
- **FR-038**: The application MUST be read-only, offering no way to alter reported
  content and sending nothing to any agent.
- **FR-039**: The application MUST retain no tree state and no record of which
  views were used across a restart.

### Key Entities

- **Story node**: A reported user story as the tree draws it — its identifier,
  title, priority, reported status, narrative, criteria, and the tasks placed
  beneath it. It owns no task; it is where tasks are drawn.
- **Task node**: A reported task as the tree draws it — its identifier, title,
  status, detail, checks and files, and the story it claims. A task claims its
  story; a story does not own its tasks.
- **Placement**: The decision of where a task is drawn, from the task's own claim
  first and a story's list second. A task with neither is drawn in the final
  group, so placement never loses one.
- **Counted progress**: The board's own arithmetic over the statuses of the tasks
  placed beneath one story, shown only where the story reported no status of its
  own, and never presented as something the agent said.
- **Selection**: The one story or task whose detail the pane shows. Survives
  reports and collapses; does not survive its subject going away.
- **Session shape**: Whether a session has ever reported a story, and whether the
  developer has ever opened its story or task view. Together these decide which
  destinations that session offers. Both are one-way: neither ever becomes false
  again while the session lives.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can say which tasks serve a given story without leaving
  the tab or changing any scoping control, in 100% of cases where the agent
  reported the links.
- **SC-002**: Every reported task appears exactly once in the tree — verifiable by
  counting against the report, including tasks belonging to no story.
- **SC-003**: A session that has reported no stories presents exactly the
  navigation it presented before this feature — verifiable by comparison.
- **SC-004**: A session offered the tree, whose developer has never opened the
  story or task view, offers the same number of destinations as before this
  feature — one gained and two gone.
- **SC-005**: No view is ever removed from a developer who has opened it in that
  session, across any sequence of reports.
- **SC-006**: Expansion, selection and scroll position are unchanged after ten
  consecutive reports.
- **SC-007**: A story or task reported with only its required fields displays with
  no empty rows, no "unknown", and no value the board supplied.
- **SC-008**: Counted progress is distinguishable from a reported status by
  inspection alone, without reference to the payload.
- **SC-009**: A story whose tasks carry statuses the board does not recognise
  reports those tasks separately rather than counting them as done or not done.
- **SC-010**: Every navigation destination remains legible and operable at the
  minimum supported width, in every combination of destinations this feature can
  produce.
- **SC-011**: A tree of 50 stories and 500 tasks remains scrollable and legible at
  the minimum supported width.
- **SC-012**: Markup in any reported text is visible as characters and never acted
  on — verifiable across every field the tree and the pane draw.
- **SC-013**: No control anywhere on the tab alters reported content or sends
  anything to an agent — verifiable by inspection of the whole view.

## Assumptions

- **The board counts a story's progress, and that reverses feature 006's FR-016**,
  which forbids the views to "infer, derive, re-order or supply anything the agent
  did not send". Counting is the one derivation this feature admits, it is
  arithmetic over reported facts rather than a judgement about them, and FR-026
  requires it to look like the board's own work. A reported status always wins
  where one exists (FR-024), and the board never says the two disagree (FR-029).
  This is the only requirement of an earlier feature that this one reverses.
- **Feature 006's FR-018 is upheld, not reversed.** Every reported task remains
  reachable, including one belonging to no reported story, because FR-012 gathers
  those into a final group. An earlier draft of this spec withheld them; that was
  abandoned once the tree began to displace the task view, since a task reachable
  nowhere is a different proposition from one reachable in the other tab.
- **This is the second and third conditional destination**, one week after
  decision 36 established that every tab is offered from the first report.
  Feature 010 added the first. All three gate on the same kind of thing decision
  36 left room for: whether the session has the *concept* at all — a ticket, a
  story — rather than on whether a snapshot happens to carry content. A session
  that has reported stories keeps the tree even when a later report carries none
  (FR-003), which is what keeps this a statement about the session rather than
  about a snapshot.
- **"Once used, always offered" is what makes FR-007 hold by construction rather
  than by care.** A developer who has never opened the story or task view cannot
  be reading it when it goes, and one who has opened it keeps it. There is no
  moment at which a destination is withdrawn from a reader, so decision 36's
  original complaint — a tab withdrawn mid-read, with the active-tab fallback
  moving the developer to Overview — cannot recur here.
- **The navigation does not grow in the ordinary case, and can in one case.** For
  a Spec-Kit session whose developer never opened the old views, one destination
  arrives and two leave. For a developer who did open them, all three are present
  at once and the strip is at its widest. That case is real and FR-035 and SC-010
  hold the same bar for it as for any other; it is also transient, ending when the
  session does.
- **Retiring the separate story and task views entirely is out of scope**, and is
  now a smaller question than it was: with FR-012 in place, the tree reaches every
  reported task, so the remaining reason those views exist is the non-Spec-Kit
  session, which FR-002 already serves. What is left to decide is whether a
  developer who prefers them should keep the choice.
- **The status vocabulary is the existing one.** Recognised statuses keep their
  established treatment and unrecognised ones show as written — this feature
  introduces no new status word and no new colour meanings.
- **The tree opens with every story collapsed**, except the story containing the
  task the agent reports as current, which opens so that the thing being worked on
  is visible without hunting. This is a presentation default rather than a claim
  about the data.
- **Nothing in the contract changes.** The links this tree draws are already
  reported in both directions, and no new field, endpoint or client tool is
  needed. If the tree turns out to need something the payload cannot supply, that
  is a finding for the planning phase and not an assumption to build on.
- **Nothing is retained across a restart**, consistent with the rest of the
  product — including which views a developer had used, so a restarted session
  offers what its reports earn and nothing more.
- **Out of scope**: editing, reordering or filtering the tree; searching it;
  drag-and-drop; grouping by anything other than story; showing the plan or
  changed files in this tree; a developer-facing setting to choose between the
  tree and the old views; and any change to what agents report.
