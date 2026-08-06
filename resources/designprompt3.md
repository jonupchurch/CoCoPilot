# CoCoPilot — design round 3 (revision brief)

Run this in Claude Design with the round 2 exports attached: **CoCoPilot Brand**,
**CoCoPilot Design System**, **CoCoPilot Overview Panel**, **CoCoPilot Round 2**.

A short round. Round 2 was good and nearly all of it stands. Three things need
revising, and one of them is only necessary because the architecture moved while
round 2 was being drawn.

## The architecture change

**The app never reads the user's repository.** Not `tasks.md`, not `specs/`, not
`.specify/feature.json`, not git. Every story, task, criterion, title and status
on the board arrived because the agent reported it. The only file the app reads
is Claude Code's own session transcript, which feeds the prompt, history and
in-context sections.

This lands on round 2's decision 01, which reasoned that a task is done or not
done *because a Spec-Kit checkbox carries one bit*. That premise is gone — there
is no checkbox in the picture any more. Statuses now arrive as free-form strings
chosen by the agent.

Everything else in round 2 is unaffected.

## Locked — do not revisit

Both previous rounds are canon now. Carry them through unchanged:

- **Everything from round 1** — the two-disc identity, the colour system with
  teal as action, blue as working and ember as attention, Figtree and JetBrains
  Mono with Caprasimo staying out of the product, the 4px step, the radii, depth
  as a border, 28px controls, and the subdivided panel with its rule-plus-caps-
  label sections whose headers carry their own summary.
- **Round 2's 640px breakpoint** — Stories collapsing its list into a picker,
  Tasks stacking above the detail. Including the reasoning for why they differ.
- **Round 2's session row** — absent at one session, sliding in over 220ms when
  a second declares itself, with the arriving pill holding a blue tint for a
  beat. Pills sit in **order of declaration**, never recency.
- **Round 2's dismiss** — the `×` stays, with "clears this board's copy" in the
  tooltip. A dismissed session reappears when it reports again; that is correct.
- **Round 2's empty state** and its hidden tabs. One correction to its framing:
  because nothing is read from disk, **every** launch starts empty, not only the
  first. It is a routine screen.
- **Round 2's Notes** — newest first, flat rows, relative-time gutter, source
  line in the agent's voice, dashed footer stating that closing the window
  clears everything. Plus a muted unread dot on the tab, no count.
- **Round 2's `focus`-versus-status split.** See revision 1 — this is the part
  that survives hardest.

## Revisions

### 1. Task status is a free string

Round 2 collapsed status to `done ? teal : grey`. That needs to open back up,
but not by returning to a fixed set of four.

The agent sends whatever text describes the task. Often it will be one of
`todo`, `active`, `blocked`, `done` — but it can equally be `needs review`,
`deferred`, or `waiting on CI`.

Please define:

- **The recognised values.** `todo`, `active`, `blocked` and `done` keep their
  round 1 treatments — the blue in-progress dot and the ember blocked state come
  back. Say which synonyms map in.
- **The fallback.** An unrecognised status renders neutral, in muted grey, with
  its text shown as-is. The reasoning is that teal, blue and ember each mean
  something specific, and guessing a signal colour for an arbitrary string is
  worse than staying quiet. Confirm or improve that.
- **The row at arbitrary width.** A task row now displays status *text*, not
  just a dot. Does it hold up at fourteen characters? At the 452px panel width?
  This is the part most likely to break.

**Round 2's decision 02 stays exactly as it is.** Separating *which* task is
being worked on — the `focus` flag, teal left rule, mono tag — from *what state*
it is in was the right call, and free-form statuses make it more necessary, not
less. There is now no status string the board can reliably read "this is the
current one" out of, so the marker is the only thing carrying it.

### 2. The `now` tag carries its own elapsed time

Round 2 proposed muting the tag after ten minutes. We are not doing that: a
threshold is a judgement about work the board cannot see, and this product does
not make those. The same reasoning already killed the 45s/3m and 60s thresholds
in earlier rounds.

Instead the tag states elapsed time. While the agent's most recent report names
this task, it reads `now`; after that it reads `4m`, `12m`, `2h`, counting from
that report. No mute, no colour change, no threshold — the teal rule stays put
throughout, because where the agent was last seen remains real information.

The design question is typographic: `now` is a word and `12m` is a measurement,
and they need to occupy the same tag without it feeling like two different
components. There is a related question of whether this duplicates the title
bar's `heard 40s ago` badly when both are on screen and both are counting.

### 3. Session pills carry their own chip and elapsed time

Round 2 drew the pills as labels. They need to carry live state, because of a
hole that only shows up when you combine two earlier decisions: the status chip
is the *only* mechanism by which an agent can ask for attention — the board
never escalates on its own — and the board shows one selected session at a time.
So a `needs-you` raised on an unselected session is currently an ask that never
arrives.

Each pill needs its own chip state and its own elapsed time. Constraints:

- It has to work at two, three and four sessions inside that 37px row, at panel
  widths down to 452px. This is a real density problem, and it is the reason
  this is a design task rather than an implementation note.
- A `needs-you` on an **unselected** pill has to be noticeable without hijacking
  the panel. Ember is legitimate here — this is exactly the attention state it
  exists for — but it is competing with a board the user is actively reading.
- Pills must not reorder. Declaration order is locked, so the signal has to work
  without movement.

## Optional, if there is room

Not owed, and easy to say no to — but it is the largest gap round 2 named
itself, and it affects a product that lives in a narrow panel beside an editor:

**Overflow.** Every view so far is drawn at a comfortable height. What happens
to five open sections in a 500px-tall window is undesigned, as are scrolling,
sticky section headers, and where "Show all 18" actually goes. If the density
work in revision 3 makes you look at cramped layouts anyway, this is the natural
companion to it.

## Document shape

Keep the shape both previous rounds used — it is working:

- Numbered decisions, each with its rationale **and its cost**.
- Open questions, each with a recommended default rather than an open shrug.
- An explicit "not designed yet" where that is the truth.
- Future work, named and set aside.
