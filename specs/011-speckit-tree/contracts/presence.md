# Contract: which destinations a session offers

**Feature**: 011 | **Date**: 2026-08-12

The second of the feature's two new surfaces. It is small, and it is the part
that touches decision 36 — so it is written down rather than left implicit in a
conditional.

---

## The rule

Two booleans, both one-way, both per session.

```
tree     = session.everReportedStories
oldViews = !tree || usedOldViews.has(session.key)
```

| | Offered |
|---|---|
| `tree` | The Spec-Kit tree view |
| `oldViews` | The separate story view and task view, together |

- `everReportedStories` is held in the store, set by `putReport` when a report
  carries at least one story, and **never cleared** while the session lives.
- `usedOldViews` is held in the renderer, keyed by session, and a session id is
  only ever **added** — never removed.

Every other destination — Overview, Notes, and feature 010's ticket view — is
unaffected by this contract and keeps whatever rule it already has.

### Both directions are one-way, and that is the whole safety argument

Neither boolean can go from true to false while a session lives. Therefore no
destination this contract governs can go from offered to not-offered while a
session lives, **except** the story and task views at the single moment `tree`
first becomes true — and at that moment `usedOldViews` decides, so they go only
for a developer who has never opened them.

A developer who has never opened a view cannot be reading it. So there is no state
of the world in which a destination is taken from a reader. FR-007 is structural
rather than careful: there is no timing to get right and no transition to animate.

This matters because it is exactly what decision 36 was raised about. That decision
records the count-gated strip withdrawing the Tasks tab from a developer mid-read,
"whereupon the active-tab fallback moved them to Overview". The rule above cannot
produce that sequence.

### Relationship to decision 36

Decision 36 says every tab is offered from the first report, whether or not its
view has content. This contract adds the second and third conditional
destinations, after feature 010 added the first, and it is consistent with what
decision 36 actually argued rather than merely with its sentence.

FR-009 — the rule decision 36 superseded — gated a tab on a **count**: a report
carrying no tasks withdrew the Tasks tab. This contract gates on whether a session
has ever had the *concept*: a project with no user stories is not a Spec-Kit
project, and a session that has had stories keeps the tree even when a later
report carries none (FR-003). No count gates anything here, and no report can
remove a destination.

The board still never offers a destination whose view would be a dead end: the
tree is offered only where there are stories to draw, and every other destination
states its own emptiness as decision 36 requires.

---

## What this rule does not do

| Not this | Why |
|---|---|
| Let an agent choose the developer's navigation | An agent's report makes a session Spec-Kit shaped; it never un-makes it, and it never reaches a view the developer has opened |
| Offer a setting to pick between the tree and the old views | Not asked for, and out of scope. "Once used" already gives a developer who wants the old views a way to keep them |
| Remember across a restart | FR-039. A restarted session offers what its reports earn, and `usedOldViews` starts empty |
| Put `usedOldViews` in the store | No other window would agree about it, and the main process cannot be authoritative about what one person opened |
| Add a field an agent sets | The contract does not change; presence is inferred from the stories already reported |
| Show a pill or badge about which shape a session is | `SessionSummary` is untouched |

---

## Verification this surface owes

- A session reporting only tasks: no tree, both old views offered, and the strip
  identical to today's.
- A session whose first report carries stories: tree offered, old views never
  present.
- A session that reports no stories, then does: tree appears; old views go **only**
  if neither was opened.
- The same, where the developer opened the task view first: all three remain, for
  the rest of that session.
- A session that reports stories, then reports none: tree still offered.
- A dismissed and re-reporting session: starts over, because the session did.
- Two concurrent sessions, one of each shape: each offers its own destinations, and
  switching between them does not leak either way.
- After a restart: nothing remembered, on either boolean.
- Across every sequence above: **no destination ever disappears from a developer
  who had opened it** — the assertion that stands in for FR-007.
