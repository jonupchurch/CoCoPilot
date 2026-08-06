# CoCoPilot — design round 2 (revision brief)

Run this in Claude Design with the round 1 exports attached: **CoCoPilot
Brand**, **CoCoPilot Design System**, **CoCoPilot Overview Panel**.

This is a revision, not a restart. Round 1 is good and most of it is now
locked. What follows is the short list of things that changed underneath the
design, and why.

## What CoCoPilot is

A desktop board that sits beside an editor while an AI agent works a GitHub
Spec-Kit repository. The agent reports what it is doing; a human watches. It
holds the information the developer would otherwise be tracking in their head
across a long agent session.

Since round 1, the architecture settled in ways that touch the design:

- **One-way.** Data flows agent → board and never back. The board never sends
  anything to the agent and never writes to the user's repository.
- **The AI drives the screen.** The window never refreshes itself — no polling,
  no watching the repo. It follows the agent's reports and Claude Code's own
  session transcript, which is where the prompt, history and in-context file
  list come from.
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

### 1. Tasks have two states, not four

A Spec-Kit checkbox carries checked or unchecked and nothing else, so *active*
and *blocked* have no source and are being dropped from the data model. The
agent's prose carries what is actually happening instead.

Please rework the Stories tab, the Tasks tab and the Overview *Spec* section so
a task is only ever **done** or **not done**. The blue in-progress dot and the
ember blocked treatment on task rows both go.

**Do not over-apply this.** These are session state, not task state, and they
stay exactly as they are:

- The panel status chips — Idle, Watching, Thinking, Needs you.
- The *Plan* section, including its progress bar and its live
  `editing src/hooks/useSession.ts` line.

The open question for you: with two states, task rows lose most of their colour.
Does the list still read at a glance, or does something else need to carry the
"this is the one being worked on right now" signal? That signal is worth keeping
even though the *state* is gone.

### 2. The Design System's "Content blocks" no longer match the product

That section is titled as the four things a panel actually shows, and three of
them are now wrong. The suggestion card with Apply/Skip, and the attention block
with Re-read/Discard, describe a tool that acts on the user's code. CoCoPilot
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

### 5. The empty state

A board that has been opened but has had nothing reported to it yet has no repo,
no branch, no spec and nothing to show. Round 1 has no screen for this, and it
is the first thing every new user sees.

It should make clear that the board is waiting on an agent rather than broken,
without turning into a setup wizard — there is nothing for the user to
configure, because the AI supplies everything.

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
