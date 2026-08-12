# Feature Specification: Spec-Kit Tree

**Feature Branch**: `011-speckit-tree`

**Created**: 2026-08-12

**Status**: Draft

**Input**: One tab holding the whole shape of the work — reported user stories at the top level, each expanding to the tasks that belong to it, with a pane beside the tree showing the detail and status of whatever is selected. A task is placed by its own declaration of which story it serves; a story that says nothing about its own state has its progress counted from the tasks beneath it. Additive for now, alongside the two tabs it is meant to replace.

## Context

The board shows stories in one tab and tasks in another. Both are lists of the
same work seen from two ends, and the relationship between them — which tasks
serve which story — is reported by the agent and shown by neither. A developer
who wants it holds it in their head, or scopes the task view to a story one at a
time and remembers what they saw.

The actor is the **developer watching an agent work a specced feature**, the same
actor features 004–008 serve.

The relationship already exists in what agents report, in both directions and
both optional: a task may name the story it serves, and a story may name the
tasks that serve it. Nothing in the contract changes for this feature. What
changes is that the board finally draws the relationship it has been receiving.

Two things about this feature are departures rather than additions, and both are
recorded as such in Assumptions below: it shows **less** than was reported, and
it shows a value **nobody reported**. Each reverses a numbered requirement of
feature 006. Neither is an accident, and the spec states the cost of each and
what must be true before the two tabs it duplicates can be retired.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the shape of the work (Priority: P1)

A developer opens one tab and sees the feature's stories, and under any story
they expand, the tasks that serve it — the decomposition the agent reported,
drawn as the tree it always was.

**Why this priority**: It is the feature. The detail pane (P1) has nothing to
show without a selection, and the rollup (P2) has nothing to summarise.

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
   is drawn, **Then** it does not appear, and the view states how many tasks are
   not shown.
6. **Given** a task naming a story that was not reported, **When** the tree is
   drawn, **Then** no story is invented for it and it is counted among those not
   shown.
7. **Given** a story with no tasks beneath it, **When** it is expanded, **Then**
   the view says it has none rather than showing an empty frame.

---

### User Story 2 - Read one thing in full (Priority: P1)

The developer selects a story or a task and reads it in full beside the tree —
the narrative and criteria of a story, the detail and checks of a task — without
losing sight of where it sits in the work.

**Why this priority**: A tree of titles is a table of contents. The reason to
combine the two tabs is to stop the developer choosing between seeing structure
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

### User Story 3 - See how a story is going without opening it (Priority: P2)

A developer scanning collapsed stories sees how much of each is done, counted
from the tasks beneath it, and can tell that the board counted it rather than
the agent having said it.

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
6. **Given** a story with no reported status and no tasks beneath it, **When**
   the developer looks, **Then** no status and no progress are shown.

---

### User Story 4 - Keep your place while the agent works (Priority: P2)

The developer expands a story, selects a task, reads it — and goes on reading
while report after report arrives.

**Why this priority**: This board's rule is that an agent's report never moves
the human's attention. A tree has more state to lose than a list — expansion,
selection and scroll — so the rule costs more here and is worth its own story.

**Independent Test**: Expand, select and scroll, then send ten reports and
confirm all three are unchanged.

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

---

### User Story 5 - Use the tree in a narrow panel (Priority: P3)

A developer with the board docked beside their editor uses the tree and the
detail together, or one then the other, without the window scrolling sideways.

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
3. **Given** a deeply nested or long-titled entry, **When** it is shown at the
   minimum width, **Then** it degrades legibly and its full value stays
   retrievable.
4. **Given** every destination the board offers, **When** the tab strip is drawn
   at the minimum width, **Then** each remains legible and operable.

---

### Edge Cases

- **Tasks reported with no stories at all.** The tree is empty of stories and
  every task is unlinked — so the tab shows an explicit empty state *and* the
  count of tasks it is not showing. This is the pathological case for placing
  tasks under stories, and the count is what stops it looking like nothing was
  reported.
- **A story naming a task that was not reported.** Named and absent; nothing is
  invented, and the story shows only the tasks that exist.
- **Two tasks reporting the same identifier.** Both are shown where they claim to
  belong; the board does not merge them or pick one.
- **A task naming a story that names it back.** Ordinary agreement — placed once,
  as the disagreement rule would place it anyway.
- **Every task unlinked while stories exist.** Stories list, each says it has no
  tasks, and the withheld count states the rest.
- **A status the board's vocabulary does not recognise.** Shown as written,
  treated as no recognised outcome, and counted separately in any progress.
- **A story with fifty tasks, and fifty stories.** Remains scrollable and legible;
  expansion does not become the only way to find anything.
- **Selecting a task, then collapsing its story.** The selection survives the
  collapse — collapsing hides rows, it does not deselect.
- **A restart.** Nothing is held, like everything else on this board.
- **A session with no reported stories or tasks.** The tab is offered, per
  decision 36, and says it has nothing.

## Requirements *(mandatory)*

### Functional Requirements

**The tree and how it is built**

- **FR-001**: The application MUST present reported stories as the tree's top
  level, in the order reported.
- **FR-002**: The application MUST allow each story to be expanded to reveal the
  tasks belonging to it, and collapsed again.
- **FR-003**: The application MUST place a task beneath the story the task itself
  names, and MUST use a story's own list of tasks to place only a task that names
  no story.
- **FR-004**: The application MUST show any task at most once in the tree.
- **FR-005**: The application MUST NOT show a task that names no story and that
  no story names.
- **FR-006**: The application MUST treat a task naming a story that was not
  reported as unplaced, and MUST NOT create a story for it.
- **FR-007**: The application MUST state how many reported tasks are not shown
  whenever that number is greater than zero.
- **FR-008**: The application MUST list tasks within a story in the order
  reported.
- **FR-009**: The application MUST say a story has no tasks rather than showing
  an empty container for them.

**The detail pane**

- **FR-010**: The application MUST show, beside the tree, the full detail of the
  selected story or task.
- **FR-011**: The application MUST show for a selected story its narrative, its
  acceptance criteria, its priority and its status, omitting each that was not
  reported.
- **FR-012**: The application MUST show for a selected task its detail, its
  checks, its files and its status, omitting each that was not reported.
- **FR-013**: The application MUST make it evident whether the pane is showing a
  story or a task.
- **FR-014**: The application MUST state that nothing is selected rather than
  presenting an empty pane.
- **FR-015**: The application MUST continue to show a selected task whose story
  has been collapsed.

**Status, and the one derived value**

- **FR-016**: The application MUST display a recognised status in its established
  treatment, and an unrecognised status as reported text with no recognised
  treatment.
- **FR-017**: The application MUST show a story's reported status exactly as
  reported.
- **FR-018**: The application MUST show, for a story that reports no status,
  progress counted from the tasks placed beneath it.
- **FR-019**: The application MUST present that counted progress as the board's
  own, distinguishable from any status an agent reported.
- **FR-020**: The application MUST NOT count a task whose status it does not
  recognise as any recognised outcome, and MUST state how many such tasks a count
  covers.
- **FR-021**: The application MUST show no status and no progress for a story
  that reports no status and has no tasks placed beneath it.
- **FR-022**: The application MUST NOT present any disagreement between a story's
  reported status and the state of its tasks.

**Keeping the developer's place**

- **FR-023**: The application MUST preserve which stories are expanded across
  reports.
- **FR-024**: The application MUST preserve the selection across reports.
- **FR-025**: The application MUST preserve the scroll position across reports.
- **FR-026**: The application MUST NOT change expansion, selection or scroll
  position as a consequence of a report arriving.
- **FR-027**: The application MUST state that a selection is gone when a report
  no longer contains it, rather than selecting something else in its place.

**Coexistence and the rest**

- **FR-028**: The application MUST leave the existing story and task views
  unchanged and reachable.
- **FR-029**: The application MUST keep every navigation destination legible and
  operable at the window's minimum supported width, without horizontal scrolling.
- **FR-030**: The application MUST show only reported content, with the counted
  progress of FR-018 as the single exception, and MUST NOT infer, derive, or
  supply anything else the agent did not send.
- **FR-031**: The application MUST render all reported text as plain, inert
  content, and MUST NOT interpret any part of it as markup.
- **FR-032**: The application MUST be read-only, offering no way to alter
  reported content and sending nothing to any agent.
- **FR-033**: The application MUST retain no tree state across a restart.

### Key Entities

- **Story node**: A reported user story as the tree draws it — its identifier,
  title, priority, reported status, narrative, criteria, and the tasks placed
  beneath it. It owns no task; it is where tasks are drawn.
- **Task node**: A reported task as the tree draws it — its identifier, title,
  status, detail, checks and files, and the story it claims. A task claims its
  story; a story does not own its tasks.
- **Placement**: The decision of where a task is drawn, from the task's own claim
  first and a story's list second. A task with neither is unplaced, counted, and
  not drawn.
- **Counted progress**: The board's own arithmetic over the statuses of the tasks
  placed beneath one story, shown only where the story reported no status of its
  own, and never presented as something the agent said.
- **Selection**: The one story or task whose detail the pane shows. Survives
  reports and collapses; does not survive its subject going away.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can say which tasks serve a given story without leaving
  the tab or changing any scoping control, in 100% of cases where the agent
  reported the links.
- **SC-002**: Every reported task that names a story, or is named by one, appears
  exactly once in the tree — verifiable by counting against the report.
- **SC-003**: The number of reported tasks not shown is stated whenever it is
  greater than zero, in 100% of cases, including the case where no stories were
  reported at all.
- **SC-004**: Expansion, selection and scroll position are unchanged after ten
  consecutive reports.
- **SC-005**: A story or task reported with only its required fields displays
  with no empty rows, no "unknown", and no value the board supplied.
- **SC-006**: Counted progress is distinguishable from a reported status by
  inspection alone, without reference to the payload.
- **SC-007**: A story whose tasks carry statuses the board does not recognise
  reports those tasks separately rather than counting them as done or not done.
- **SC-008**: The existing story and task views present exactly what they
  presented before this feature — verifiable by comparison.
- **SC-009**: Every navigation destination remains legible and operable at the
  minimum supported width with no horizontal scrolling, with this tab among them.
- **SC-010**: A tree of 50 stories and 500 tasks remains scrollable and legible
  at the minimum supported width.
- **SC-011**: Markup in any reported text is visible as characters and never
  acted on — verifiable across every field the tree and the pane draw.
- **SC-012**: No control anywhere on the tab alters reported content or sends
  anything to an agent — verifiable by inspection of the whole view.

## Assumptions

- **This view shows less than was reported, and that reverses feature 006's
  FR-018**, which requires every reported task to be reachable "including one
  belonging to no reported story". A tree whose top level is stories has nowhere
  to put a task that belongs to none, and the choice recorded here is to withhold
  it rather than to invent a group for it. **The cost is paid down two ways**: the
  count of withheld tasks is stated (FR-007), so the view never silently shows
  less than it was given; and the existing task view still shows every task, so
  no reported task is unreachable *on the board* while this tab is additive.
- **Retiring the two existing tabs is therefore gated**, and this is the
  feature's main open question rather than a detail. The moment the task view
  goes, FR-018 is violated product-wide and unplaced tasks become unreachable.
  Before that happens, either agents must be relied upon to link every task, or
  this view must gain somewhere to put an unplaced one. That decision is out of
  scope here and is owed before replacement.
- **The board counts a story's progress, and that reverses feature 006's
  FR-016**, which forbids the views to "infer, derive, re-order or supply
  anything the agent did not send". Counting is the one derivation this feature
  admits, it is arithmetic over reported facts rather than a judgement about
  them, and FR-019 requires it to look like the board's own work. A reported
  status always wins where one exists (FR-017), and the board never says the two
  disagree (FR-022).
- **The status vocabulary is the existing one.** Recognised statuses keep their
  established treatment and unrecognised ones show as written — this feature
  introduces no new status words and no new colour meanings.
- **The tree opens with every story collapsed**, except the story containing the
  task the agent reports as current, which opens so that the thing being worked
  on is visible without hunting. This is a presentation default rather than a
  claim about the data.
- **A sixth destination is a real cost to the tab strip.** Feature 010 adds a
  fifth and already had to shorten a label to fit five at the minimum supported
  width; this feature makes six. FR-029 and SC-009 hold the bar, and if six cannot clear it,
  that is an argument for bringing the replacement of the two duplicated tabs
  forward rather than for relaxing the floor. A design revision is owed either
  way, since the exports draw four.
- **Nothing in the contract changes.** The links this tree draws are already
  reported in both directions, and no new field, endpoint or client tool is
  needed. If the tree turns out to need something the payload cannot supply, that
  is a finding for the planning phase and not an assumption to build on.
- **One feature's worth of work at a time.** The tree draws what the current
  report holds; comparing across reports, remembering a previous shape, or
  showing history is not part of this.
- **Nothing is retained across a restart**, consistent with the rest of the
  product.
- **Out of scope**: editing, reordering or filtering the tree; searching it;
  drag-and-drop; grouping by anything other than story; showing the plan or
  changed files in this tree; and the eventual removal of the two tabs this one
  duplicates.
