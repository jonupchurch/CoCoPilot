# CoCoaPilot — design round 2 (revision brief)

Run this in Claude Design with the round 1 exports attached: **CoCoPilot
Brand**, **CoCoPilot Design System**, **CoCoPilot Overview Panel**.

This is a revision, not a restart. Round 1 is good and most of it is now
locked. What follows is the short list of things that changed underneath the
design, and why.

## What CoCoaPilot is

A desktop board that sits beside an editor while an AI agent works a GitHub
Spec-Kit repository. The agent reports what it is doing; a human watches. It
holds the information the developer would otherwise be tracking in their head
across a long agent session.

Since round 1, the architecture settled in ways that touch the design:

- **One-way.** Data flows agent → board and never back. The board never sends
  anything to the agent and never writes to the user's repository.
- **The AI drives the screen, and the app never reads the repository.** Not the
  task files, not the specs, not git. Every story, task, criterion and status on
  screen arrived because the agent reported it. The only file the app reads is
  Claude Code's own session transcript, which is where the prompt, history and
  in-context file list come from. The board is a renderer of what it is told.
- **The board never renders a verdict.** It shows elapsed time — "last heard
  from 4m ago" — and never decides an agent is stuck. A healthy agent goes
  quiet for minutes during a typecheck.
- **It is a display panel and owns no durable state.** Nothing survives closing
  the window. Everything on screen is either re-read from disk or was reported
  since launch, so nothing in the design may imply permanence.

## Locked — do not revisit

Round 1 settled these and they are canon. Please carry them through unchanged
rather than re-deriving them:

- **The 5a identity.** Two overlapping discs, blue and teal, mono wordmark with
  `Co` blue and `Co` teal. Terracotta stays out of the identity entirely.
- **The full colour system.** Teal = action, blue = working, ember = attention
  and never decorative. The four greys, the ivory, the three 14% tints. Signal
  colours for fills and 12px+ text only.
- **Type.** Figtree for prose, JetBrains Mono for anything read from the
  codebase, Caprasimo marketing-only and never in the product. 11px uppercase
  mono is the floor.
- **Space, radius, elevation.** The 4px step, 16/12/8/pill radii, and depth as a
  border inside the panel — only the window itself floats.
- **Controls.** 28px standard height, 24px dense, hit targets stay 28px.
- **The subdivided panel.** Sections separated by a 1px rule and an 11px caps
  label, never a card inside a card. Every section header is a click target and
  carries its own summary on the right, so a collapsed section still answers the
  question. This is the single best idea in round 1.
- **The four tabs** — Overview, User Stories, Tasks, Notes — and the tear-off
  `+` that pulls the active view into its own window.

The Design System's buttons, inputs, segmented control and toggle also stay, as
the **style reference** for those elements. See revision 2 for the one thing
that changes about them.

## Revisions

### 1. Task states are open-ended

Round 1's four states — todo, active, blocked, done — are right and stay exactly
as drawn. What changed is that the set is no longer closed: the agent sends
whatever string describes the task, so a status can arrive that none of the four
treatments cover. "needs review", "deferred", "waiting on CI".

So please keep the four as they are, and define the **fallback**: how an
unrecognised status renders. The working assumption is neutral muted grey with
the status text shown as-is, on the reasoning that an arbitrary string cannot
honestly be assigned a signal colour — teal, blue and ember all mean something
specific, and guessing wrong is worse than staying quiet. Confirm or improve
that.

Worth checking while you are in there: a task row now has to display arbitrary
status text rather than an icon alone. Does the row still hold up when the
status is fourteen characters instead of a dot?

### 2. The Design System's "Content blocks" no longer match the product

That section is titled as the four things a panel actually shows, and three of
them are now wrong. The suggestion card with Apply/Skip, and the attention block
with Re-read/Discard, describe a tool that acts on the user's code. CoCoaPilot
does not — it is one-way and read-only.

Please retitle and repopulate that section with what the board really shows:
the section header with its summary, a task row, a file row, the working state,
and the prose note the agent writes for the human.

Keep the button, input and chip specimens themselves somewhere as style
reference — they are still the reference for the few controls that exist
(collapse, expand, copy, dismiss). Just stop presenting them as product surfaces.

### 3. Stories and Tasks need a narrow-width layout

Panel width is now stable and user-owned: the window keeps its width when tabs
change, and only the user resizes it. Round 1 drew Overview at 452px and the
Stories and Tasks tabs at 880px, which means the window jumped on tab click.
That is out.

So Stories and Tasks have to work at whatever width the user chose, including
452px. They are currently master–detail. Please show how that degrades — detail
stacking under the list, or the list collapsing to a picker — and say which you
recommend and why.

### 4. A session switcher, visible only when there is more than one session

The board follows whatever the agent declares: a report carries its own repo and
branch, and there is no folder picker anywhere. Two Claude sessions in two repos
can be reporting at once.

Please design a switcher that is **absent entirely at one session** — the common
case, and the chrome should look exactly as it does today — and appears once a
second session declares itself. Each entry needs a dismiss control; dismissing
only clears the board's copy, and a dismissed session that reports again comes
back.

The hard part is the transition. A control that materialises in the chrome is
jarring if it is not handled deliberately.

### 5. The empty state, which is a routine screen and not a first-run one

A board that has had nothing reported to it yet has no repo, no branch, no spec
and nothing to show. Round 1 has no screen for this.

This matters more than it first appears. Because the app reads nothing from
disk, **every launch starts empty** — not just the first one. Close the window
mid-feature and reopen it and there is nothing there until the agent next
reports. So this is a screen the user sees regularly, not a one-time welcome.

It should make clear that the board is waiting on an agent rather than broken,
and it must not become a setup wizard — there is nothing for the user to
configure, because the AI supplies everything. It should also carry its weight
at the size of a panel that lives beside an editor, rather than assuming a
full window of space for an illustration.

### 6. Notes — now decided, please design it

Round 1 asked what Notes should hold. The answer: **notes the agent writes** —
either because the user asked it to make a note of something, or because the
agent judged something worth recording. The user never types into the board;
they tell the agent, and the agent reports it. That keeps Notes inside the
one-way rule like everything else.

Two properties that shape it:

- **Notes accumulate.** Unlike the rest of the board, where a new report
  replaces the last one, notes add up over a session. So this is a list that
  grows, and it needs an order and a density that survives forty entries.
- **Notes are not permanent, and the design must be honest about that.** The app
  owns no durable state at all — notes clear when the window closes. So no
  "saved" indicator, no archive, no pin, nothing that implies a note will be
  there tomorrow. If the user wants something kept, they ask the agent to write
  it into the repository, which is outside this app entirely.

That second point is the interesting design problem: a notes surface that is
useful within a session while being visibly *not* a permanent store. Getting
that wrong in either direction is bad — implying permanence is a lie, and making
it feel disposable undermines the point of writing a note at all.

## Document shape

Keep round 1's shape, which worked:

- Numbered decisions, each with its rationale **and its cost**. The costs are
  what make the decisions reviewable instead of merely plausible.
- Open questions, each with a recommended default rather than an open shrug.
- An explicit "not designed yet" where that is the truth.
- Future work, named and set aside.
