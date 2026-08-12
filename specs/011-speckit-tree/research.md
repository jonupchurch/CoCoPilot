# Research: Spec-Kit Tree

**Feature**: 011 | **Date**: 2026-08-12

Inherits the renderer conventions established by features 003–008. Only what is
new to this feature is recorded here.

The central fact this feature has to deal with is that **the thing it is
specified to build already exists, built to different rules.**
`state/useSelection.ts` places tasks under stories today, and it is shared by the
two views this feature duplicates. Sections 1 and 2 are about that.

---

## 1. Placement: a second rule, deliberately, with an end date

**Decision**: feature 011 gets its own placement function in its own module.
`buildScopes` in `state/useSelection.ts` is **not touched, not parameterised, and
not extended**.

**Rationale**: the spec requires a task to be placed by its own `storyId`, with a
story's `taskIds` used only for a task that names no story (FR-003), and requires
a task with neither to be withheld and counted (FR-005, FR-007). The existing
`buildScopes` does neither. It unions the two directions — a task appears under
*both* stories when they disagree — and it collects orphans into an `UNASSIGNED`
scope so that every task stays reachable.

Neither of those is a bug. Both are argued in the file, and the argument is the
opposite of this feature's: *"showing it in both places is more honest than
silently picking a winner"*, and the `UNASSIGNED` scope exists precisely to
satisfy feature 006's FR-018.

So this is not a rule to fix. It is a rule this feature supersedes, in a view
that does not exist yet, while the views built on the old rule go on running.
FR-028 and SC-008 require those views to present exactly what they presented
before, which rules out changing the function underneath them.

**Two rules therefore coexist — and they coexist exactly as long as the two
view-sets do.** The spec already gates retiring the Stories and Tasks tabs on
answering what happens to an unplaced task. That same trigger retires
`buildScopes` and `UNASSIGNED` with them. The duplication has an end date and it
is the same end date, which is the difference between drift and a migration.

**Alternatives considered**:

- *Parameterise `buildScopes` with a placement policy.* Rejected, and this is the
  one worth explaining. A policy flag makes both behaviours look like standing
  options at both call sites, when the whole content of this feature's decision
  is that one **supersedes** the other. It would also put the union rule and the
  storyId-wins rule in one function whose tests then have to cover four
  combinations of policy and shape, to describe a state of the world meant to
  last one feature.
- *Change `buildScopes` and let the existing tabs change with it.* Rejected: it
  violates FR-028 and SC-008, and it would silently alter two shipped views —
  including making a task vanish from the Tasks tab — which nobody asked for.
- *Have the new view import `buildScopes` and post-process its output.* Rejected
  as the worst of both: the union is computed and then partly undone, so the real
  rule is spread across two files and neither states it.

**Cost, accepted**: two placement rules in the renderer for as long as the
duplication lasts, and a reader who finds one may not know the other exists. Paid
down by naming the other in both files, and by a test that pins each rule to its
own view so that "fixing" either one fails.

**What is reused is the shape, not the rule.** `Scope` is `{ id, story, tasks }`
— a value, not a policy — and `StoryDetail` and `TaskDetail` take one. This
feature's placement produces `Scope` values of its own and hands them to those
components unchanged. Inheriting the presentation without inheriting
`buildScopes` is the whole trick, and it is available only because `Scope` is a
plain data type.

---

## 2. Resolving a selection, and why `resolve` cannot be reused either

**Decision**: a selection is `{ kind: 'story' | 'task', id }` held as intent and
resolved against the current tree on every render, following the derivation
pattern `useSelection` established. When the selected thing is gone, the view
**says so** and selects nothing.

**Rationale**: the derivation half is settled and this feature copies it
outright — hold the intent, compute the resolution, no effect watching for
reports, nothing to go stale. That is what makes FR-023 through FR-026 cheap.

The fallback half is where this feature differs. `resolve` falls back to the
first item, and argues for it: *"Landing on the first item is obviously a move,
which is the point."* That argument holds for a two-pane list where something
must be shown. It does not hold here, because FR-027 requires the opposite — the
view states the selection is gone rather than selecting something else — and a
tree has a third option a list does not: showing nothing selected is a legible
state when there is a whole tree still on screen to choose from.

**Alternatives considered**:

- *Reuse `resolve` and accept the first-item fallback.* Rejected: it contradicts
  FR-027, and in a tree it would silently expand whichever story holds the new
  first task, moving the reader — the thing FR-026 forbids.
- *Keep the selection "sticky" and show the last known content.* Rejected
  outright: it would show the developer a task that is no longer reported, which
  is the board asserting something it was not told.

---

## 3. Counted progress: counts, never a derived word

**Decision**: a story with no reported status shows **counts over recognised
statuses** — "3 of 7 done" — plus a stated number of tasks whose status the
vocabulary does not recognise. It never shows a single derived status word, and
never a percentage or a bar.

**Rationale**: FR-019 requires the counted value to be distinguishable from a
reported status, and FR-020 forbids classifying an unrecognised status as any
recognised outcome. Counts satisfy both by construction: a reported status is a
word carrying a treatment, and a count is visibly arithmetic. Nothing has to be
styled into looking derived, because a count does not look like a status.

A single rolled-up word fails both. Choosing "active" for a story whose tasks are
blocked, active and todo requires a precedence among them that the board cannot
defend — is a blocked task's story blocked, or active because something else is
moving? — and whatever word came out would be indistinguishable from one the
agent reported, which is exactly what FR-019 forbids.

`classify` already returns `todo | active | blocked | done | unrecognised` and
already refuses to guess: no prefix matching, no stemming, no edit distance,
because *"a wrong match paints a signal colour on something the board does not
understand"*. Counting is a second reader of that same table and inherits the
refusal for free — an unrecognised status is counted as unrecognised and said so,
not folded into "not done".

**Alternatives considered**:

- *A percentage.* Rejected: it implies a precision that counting free-text
  statuses does not have, and 66% reads as a measurement rather than as four of
  six.
- *A progress bar.* Rejected: a bar is a claim about proportion of *effort*, and
  the board knows only a count of items.
- *Counting unrecognised statuses as "not done".* Rejected: it is the exact
  inference `classify` was written to refuse, and it would make a story of five
  tasks with idiosyncratic status words read as 0 of 5 done when the board simply
  does not know.
- *Showing counts even when the story reported its own status.* Rejected by
  FR-017 and FR-022: the reported status wins, and putting a count beside it
  invites the reader to notice a disagreement the board is forbidden to present.

---

## 4. Expansion state: hold the deviation, not the state

**Decision**: hold the set of story ids the developer has **toggled**, and derive
whether a story is open as `default(story) XOR toggled.has(story.id)`, where the
default is open for the story containing the currently reported task and closed
for every other.

**Rationale**: the obvious design — hold a set of open ids — breaks the default.
The default depends on the report (which story holds the current task), so when
the agent moves to a new story the default changes; with a set of open ids there
is no way to tell "the developer closed this" from "this was never opened", and
either the default stops working after the first report or a developer's collapse
is undone by the next one. Both are FR-026 violations.

Holding the deviation makes both requirements one expression. Nothing watches for
reports, nothing is initialised from the first one, and there is no effect —
which is the same reason `useSelection` holds intent rather than resolution, and
the reason feature 007's `useUnread` derives rather than observes.

**Alternatives considered**:

- *A set of open ids, initialised once from the first report.* Rejected: "once"
  needs an effect and a has-it-happened flag, and at mount there may be no report
  to initialise from.
- *Everything open by default.* Rejected: a 50-story tree opens to 500 rows and
  the current task is no easier to find than in a flat list, which is what the
  tree was for.
- *Everything closed by default.* Viable, and the fallback if the XOR proves
  confusing in review. Rejected as the primary because the thing being worked on
  right now is the thing the developer opened the board to see.

---

## 5. Six destinations, and the measurement that decides it

**Decision**: the tab sits **last**, labelled "Spec-Kit", and the density claim is
settled by measurement in the quickstart rather than by argument here.

**Rationale for last**: the active destination falls back to the first available,
so anything placed before an existing tab risks changing which view a session
lands on — the trap feature 010 identified when it placed the ticket tab second
rather than first. This tab duplicates two that already exist, so it has the
weakest claim to prominence and the strongest reason not to disturb the order.

**This is the feature's real risk and it is not resolvable on paper.** Feature 010
takes the strip to five and had to shorten "User Stories" to "Stories" to do it;
this takes it to six. The spec's position (FR-029, SC-009) is that the floor does
not move. If six will not fit, the answer is to bring the retirement of the
Stories and Tasks tabs forward — which removes two destinations and lands at
four — rather than to relax the floor or introduce a second navigation idiom.

That escalation is deliberately *not* taken pre-emptively. Retiring those tabs
requires answering what happens to an unplaced task, which the spec gates and
does not answer, and it would be poor practice to force that answer to satisfy a
layout constraint that has not yet been measured to fail.

**Alternatives considered**:

- *An overflow menu past five.* Rejected for the reason feature 010 gave: a
  second navigation idiom for one extra destination.
- *Icons past five.* Rejected: an unlabelled destination is a guess, and this
  product has no icon vocabulary.
- *Retire the two tabs now, in this feature.* Rejected as scope: the spec makes
  retirement conditional on an unanswered question, and answering it under
  layout pressure is how a product decision gets made for the wrong reason.

**Design revision owed**: the exports draw four destinations and are canon for
look and feel (decision 8). The tree, the detail pane and a sixth tab are all
revisions this feature owes.

---

## 6. Withholding honestly

**Decision**: the count of withheld tasks is shown in the view itself, always
when it is greater than zero, including the case where no stories were reported
and every task is withheld.

**Rationale**: this is the first place the board deliberately shows less than it
was told, and the mitigation has to be visible rather than architectural. The
precedent is `commentsOmitted` in feature 010, where the board states what it is
not showing rather than presenting a partial list as a whole one — with the
difference that here the board *can* count it itself, so unlike `commentsOmitted`
there is no dependence on the agent to be honest.

The degenerate case is the one that matters. An agent reporting tasks and no
stories produces a tree with nothing in it; without the count, that is
indistinguishable from a session that reported nothing at all, and the developer
would reasonably conclude the board was broken. With it, the view says there are
tasks it cannot place — which is true, actionable, and points at the agent's
report rather than at the board.

**Alternatives considered**:

- *An "Unassigned" group, as `buildScopes` has.* This is what the existing rule
  does and it is a perfectly good answer — it was rejected at the specification
  stage, not here, and it remains the obvious candidate if the gate in §1 is ever
  resolved that way.
- *Saying nothing.* Rejected: it makes the board quietly lossy, and the
  degenerate case above reads as a fault in the product.
