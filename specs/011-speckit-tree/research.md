# Research: Spec-Kit Tree

**Feature**: 011 | **Date**: 2026-08-12

Inherits the renderer conventions established by features 003–008. Only what is
new to this feature is recorded here.

Two facts shape everything below. **The thing this feature draws already exists,
built to a different rule** — `state/useSelection.ts` places tasks under stories
today, for the two views this one displaces. And **presence is now a property of
a session's history**, which no view can derive from the report in front of it.

---

## 1. Placement: one rule differs, and it is the conflict rule

**Decision**: feature 011 gets its own placement function in its own module.
`buildScopes` in `state/useSelection.ts` is **not touched, not parameterised, and
not extended**.

**Rationale**: the two rules now agree about far more than they did. Both gather
tasks belonging to no story into a final group rather than dropping them —
`buildScopes` calls it `UNASSIGNED`, FR-012 requires it here, and feature 006's
FR-018 is the reason in both cases. The divergence is down to a single question:
**what happens when the two link directions disagree.**

`buildScopes` unions them, and argues for it: *"showing it in both places is more
honest than silently picking a winner."* FR-010 and FR-011 require the opposite —
the task's own `storyId` wins, and a task appears at most once.

That is not a bug to fix. It is a rule this feature supersedes, in a view that
does not exist yet, while the views built on the old rule go on running for every
session that is not Spec-Kit shaped (FR-002) and every session whose developer has
already used them (FR-005). Those views must present exactly what they presented
before (SC-003), which rules out changing the function underneath them.

**The exactly-once property is what the new rule is for.** It is what makes
"every reported task appears exactly once" (SC-002) a single countable assertion,
and it is what a tree needs and a pair of scoped lists does not: in a tree, one
task drawn under two parents reads as two tasks.

**Alternatives considered**:

- *Parameterise `buildScopes` with a conflict policy.* Rejected. A policy flag
  makes both behaviours look like standing options at both call sites, when the
  content of the decision is that one **supersedes** the other. It also puts two
  rules in one function whose tests then cover four combinations of policy and
  shape, to describe a state of the world meant to last one feature.
- *Change `buildScopes` and let the existing views change with it.* Rejected: it
  violates SC-003 and would silently alter two shipped views for the sessions
  that still use them.
- *Now that only the conflict rule differs, share the rest.* Rejected as the worst
  of both: a shared "gather orphans" helper and a divergent conflict step spreads
  one rule across two files, and neither states it whole. The rule is small enough
  that stating it twice is cheaper than assembling it from parts.

**Cost, accepted**: two placement rules in the renderer for as long as both view
sets exist, and a reader who finds one may not know the other exists. Paid down by
naming the other in both files, and by a test that pins each rule to its own view
so that "fixing" either one fails loudly.

**What is reused is the shape, not the rule.** `Scope` is `{ id, story, tasks }` —
a value, not a policy — and `StoryDetail` and `TaskDetail` take one. This feature's
placement emits `Scope` values and hands them to those components unchanged.
Inheriting the presentation without inheriting `buildScopes` is the whole trick,
and it is available only because `Scope` is a plain data type. The existing
`UNASSIGNED` sentinel and its `scopeKey` helper are reused as-is for the final
group, because a second sentinel meaning the same thing is a second thing to keep
in step.

---

## 2. Presence is a fact about a session, and the store has to hold it

**Decision**: `Session` gains `everReportedStories: boolean`, set by `putReport`
when a report carries at least one story and **never cleared**. It is projected on
`SessionView`. This is the feature's only change outside the renderer.

**Rationale**: FR-001 offers the tree to a session that has reported stories, and
FR-003 keeps offering it when a later report carries none. Reports replace
wholesale (decision 26), so `stories` being empty in the report on screen says
nothing about whether this session has ever had them. Something must remember, and
the question is only where.

The store is where. This is a fact about a session's history, which is exactly
what the main process holds and the renderer derives from — and it is the same
shape of problem feature 010 solved when it held a ticket outside the report so
that later reports could not disturb it. One boolean, one write path, no merge.

Doing it in the renderer was the alternative, and it is worse in a specific way:
the renderer would have to notice "this render carried stories, remember that",
which is an effect watching for report arrivals or a ref mutated during render.
Both are the pattern this codebase has twice argued against — `useSelection` holds
intent and derives, `useUnread` derives from a count rather than observing
arrivals. A boolean in the store needs no observer at all.

**This makes the feature not renderer-only**, which the first draft of this plan
claimed. It is one field, one assignment and one projected line, and it is worth
the correction rather than the contortion.

**Alternatives considered**:

- *Derive presence from the report on screen.* Rejected: it is FR-003's exact
  violation, and it recreates decision 36's complaint — a destination withdrawn
  because a report happened to carry nothing.
- *A renderer `Set` of session ids that have had stories.* Rejected per above: it
  needs an observer, and it would be a second place session history lives.
- *An explicit field an agent sets.* Rejected as a contract change the feature does
  not need, and as something every existing agent would have to learn.

---

## 3. "Once used" is renderer state, and the two halves belong apart

**Decision**: which views a developer has opened is held in the **renderer**, keyed
by session, as a set of session ids in which the story or task view has been
opened. It is not projected, not stored, and dies with the window.

**Rationale**: this is not a fact about the work — no agent reported it and no
other window would agree about it. It is a fact about one person's use of one
window, which is what the renderer is for. Putting it in the store would make the
main process hold something it can never be authoritative about.

The split is the point: `everReportedStories` is history and lives in the store;
`usedOldViews` is behaviour and lives in the renderer. FR-006 requires both to be
per-session, and FR-039 requires both to die on restart — which the store's own
lifetime already guarantees for the first.

**Why "once used" is the right rule and not merely the chosen one.** It makes
FR-007 hold by construction. A developer who has never opened the task view cannot
be reading it when it goes; a developer who has opened it keeps it. There is no
moment at which a destination is withdrawn from a reader, so decision 36's
original complaint — a tab withdrawn mid-read, with the active-tab fallback moving
the developer to Overview — has no way to recur. No timing, no transition, nothing
to get right.

**Alternatives considered**:

- *Carry the reader across to the equivalent node in the tree.* Rejected as more
  moving parts for a worse guarantee: it still moves the developer, and it needs a
  mapping from a task in one view to a node in another that must be right at the
  exact moment the strip changes.
- *Decide the strip once, from a session's first report.* Rejected: a Spec-Kit
  session whose first report has not yet gathered its stories would be stuck with
  the old views for its whole life.

---

## 4. Counted progress: counts, never a derived word

**Decision**: a story with no reported status shows **counts over recognised
statuses** — "3 of 7 done" — plus a stated number of tasks whose status the
vocabulary does not recognise. Never a single derived status word, never a
percentage, never a bar.

**Rationale**: FR-026 requires the counted value to be distinguishable from a
reported status, and FR-027 forbids classifying an unrecognised status as any
recognised outcome. Counts satisfy both by construction: a reported status is a
word carrying a treatment, and a count is visibly arithmetic. Nothing has to be
styled into looking derived, because a count does not look like a status.

A single rolled-up word fails both. Choosing "active" for a story whose tasks are
blocked, active and todo requires a precedence among them that the board cannot
defend — is a blocked task's story blocked, or active because something else is
moving? — and whatever word came out would be indistinguishable from one the agent
reported, which is exactly what FR-026 forbids.

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
- *Counting unrecognised statuses as "not done".* Rejected: the exact inference
  `classify` was written to refuse, and it would make a story of five tasks with
  idiosyncratic status words read as 0 of 5 done when the board simply does not
  know.
- *Showing counts even when the story reported its own status.* Rejected by FR-024
  and FR-029: the reported status wins, and putting a count beside it invites the
  reader to notice a disagreement the board is forbidden to present.

---

## 5. Expansion state: hold the deviation, not the state

**Decision**: hold the set of story ids the developer has **toggled**, and derive
whether a story is open as `default(story) XOR toggled.has(story.id)`, where the
default is open for the story containing the currently reported task and closed
for every other.

**Rationale**: the obvious design — hold a set of open ids — breaks the default.
The default depends on the report (which story holds the current task), so when
the agent moves to a new story the default changes; with a set of open ids there
is no way to tell "the developer closed this" from "this was never opened", and
either the default stops working after the first report or a developer's collapse
is undone by the next one. Both are FR-033 violations.

Holding the deviation makes both requirements one expression. Nothing watches for
reports, nothing is initialised from one, and there is no effect — the same reason
`useSelection` holds intent rather than resolution.

**Alternatives considered**:

- *A set of open ids initialised once from the first report.* Rejected: "once"
  needs an effect and a has-it-happened flag, and at mount there may be no report.
- *Everything open by default.* Rejected: a 50-story tree opens to 500 rows and the
  current task is no easier to find than in a flat list.
- *Everything closed by default.* Viable, and the fallback if the XOR proves
  confusing in review. Rejected as primary because the thing being worked on right
  now is what the developer opened the board to see.

---

## 6. Resolving a selection, and why `resolve` cannot be reused

**Decision**: a selection is `{ kind: 'story' | 'task', id }` held as intent and
resolved against the current tree on every render. When the selected thing is
gone, the view **says so** and selects nothing.

**Rationale**: the derivation half is settled and this feature copies it outright.
The fallback half differs. `resolve` falls back to the first item and argues for
it: *"Landing on the first item is obviously a move, which is the point."* That
holds for a two-pane list where something must be shown. FR-034 requires the
opposite here, and a tree has a third option a list does not — nothing selected is
legible when the whole tree is still on screen to choose from.

Reusing `resolve` would also silently expand whichever story holds the new first
task, moving the reader, which FR-033 forbids.

---

## 7. The navigation, which now shrinks in the ordinary case

**Decision**: the tab sits where the story view sat, labelled "Spec-Kit". The
density claim is settled by measurement in the quickstart.

**Rationale for the position**: the active destination falls back to the first
available, so the strip's order matters for which view a session lands on. Placing
the tree where the story view was keeps the reading order — overview, then the
work, then the log — and means the ordinary Spec-Kit session sees a strip the same
length as before with one entry renamed in place.

**The density problem is now mostly gone, and the residue is nameable.** The
earlier draft added a sixth destination outright, on a strip that feature 010 had
already stretched to five. Displacing two views changes that:

| Session | Destinations |
|---|---|
| Not Spec-Kit shaped | Unchanged from today |
| Spec-Kit, old views never opened | One arrives, two leave — **shorter than today** |
| Spec-Kit, old views opened this session | All three present — the widest case |

Only the third row is a new density risk, it is transient, and it requires the
developer to have deliberately visited a view. FR-035 and SC-010 hold the same bar
for it as for any other, and the quickstart measures that row specifically rather
than the easy ones.

**Alternatives considered**:

- *Hide the old views unconditionally.* Rejected: it is FR-007's violation and
  decision 36's complaint, and "once used" costs one set of session ids.
- *Never hide them.* Rejected: it is what the earlier draft did, and it makes six
  destinations the ordinary case rather than the rare one.

**Design revision owed**: the exports draw four destinations and are canon for
look and feel (decision 8). The tree, the detail pane and a strip whose membership
varies are all revisions this feature owes.
