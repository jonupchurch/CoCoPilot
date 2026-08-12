# Research: Ticket Tab and Openable Links

**Feature**: 010 | **Date**: 2026-08-12

Inherits [001/research.md](../001-push-contract-service/research.md) for the
service and contract, and the renderer conventions established by features
003–008. Only what is new to this feature is recorded here.

---

## 1. How a ticket is reported: its own endpoint, not a field on the report

**Decision**: a third endpoint, `POST /v1/ticket`, which **replaces** the held
ticket for a session. Reports do not carry a ticket and never touch one.

**Rationale**: the spec requires a reported ticket to survive later reports that
say nothing about it (FR-003). Held as a field inside the report snapshot, that
requires retaining a value across a replace — and `Store.putReport` has no merge
path, deliberately, "and deliberately none anywhere else in this file"
(decision 26). Adding one there would be the first.

A separate endpoint removes the problem rather than special-casing it. The ticket
is not part of the snapshot, so nothing needs retaining, and FR-003 is satisfied
by construction instead of by a guard someone has to remember.

The second reason is cost, and it is the same argument decision 20 already made
for notes. Every push is a full snapshot the agent must rebuild and resend
(decision 26), so a ticket inside the report is re-sent on **every** report for
the life of the session. A ticket at the caps below is around half a megabyte;
even an ordinary one is 2–5 kB of context and time on every update, for data
that changed once. Notes got their own endpoint for exactly this reason —
"folding them into the snapshot would force an agent to resend every note it had
ever written to add one" — and a ticket is the same shape of problem.

This also matches the store's existing organisation: `notes` and `transcript` are
already their own branches of `Session`, each written by exactly one path.
`ticket` becomes the third, and the third is not a new idea.

**Alternatives considered**:

- *An optional `ticket` field on `PushRequest`, retained when absent.* Smaller
  surface — no route, no tool, no round trip. Rejected on the two counts above:
  it puts a merge inside `putReport`, and it charges every report for a value
  that changes once. **Worth knowing**: the spec is mechanism-neutral, so this
  alternative satisfies it too. If the added surface is judged not worth it, this
  is the fallback and only the plan changes.
- *Append semantics, like notes.* Wrong shape. A ticket is one current thing, not
  an accumulating log; the second report of a ticket is a correction, not an
  addition.
- *A `DELETE` to clear a ticket.* Rejected as unasked-for scope. A ticket goes
  when its session goes, and nothing in the spec wants it cleared while the
  session lives.

**Cost, accepted**: a third front door to keep in step with the other two, one
more MCP tool, and two round trips when work on a ticket begins. The CLI does
**not** gain a `ticket` command — there is no hook or script use case for
reporting a ticket, and adding one would be surface with no caller.

---

## 2. What counts as an openable address

**Decision**: parse the reported address with the platform URL parser and require
the resulting protocol to be exactly `http:` or `https:`. Anything else is shown
as text and is not openable. Checked **twice** — once when the ticket is
validated, and again in the main process at the moment of opening.

**Rationale**: the address is composed by an agent, and any local process may
report to this board (decision 18). Handing arbitrary strings to the operating
system's URL handler is the one genuinely dangerous thing in this feature:
`file:` reaches the filesystem, and a registered application handler can start a
program. An allowlist of two protocols is the whole mitigation and it is cheap.

Parsing rather than string-matching is load-bearing. `startsWith('http')` passes
`httpx:`, and a `javascript:` payload with `https://` later in the string defeats
any `includes` check. The parser is the only thing that answers "what protocol is
this actually" correctly.

Checking twice is not redundancy for its own sake. The ingest check lets a bad
address be refused early and lets the payload be judged on its own; the check at
the point of opening is the one that matters, because the renderer is where
agent-composed text lives and "the renderer would only ever ask for a validated
address" is a claim about the whole renderer rather than about one function.
This is the posture `store.ts` already takes for session keys and that
`app.ts` already takes for its two existing channels, which validate a key
"even here… but 'only our own window' is a claim about the whole renderer".

**Refused, not repaired** (FR-022). A `www.example.com` with no protocol is not
promoted to `https://`, and a `file:` is not rewritten. Repairing an address is
guessing what the sender meant — the position decision 32 took when it declined
to sanitise a reported identifier and refused it instead.

**Alternatives considered**:

- *Allow any protocol the OS knows.* Rejected: that is the vulnerability, not a
  feature.
- *A host allowlist as well* (only the tracker's domain). Rejected as unenforceable
  — the board does not know which tracker it is looking at, by design, and the
  agent would have to declare a domain the board then has to trust anyway.
- *Rendering the address as a real anchor and letting the shell handle it.*
  Rejected: the window already denies every window-open request and blocks
  navigation, and that guard is worth keeping intact rather than punching a hole
  in.

**Also decided**: no preview, no redirect resolution, no title fetch. FR-024
forbids the board making any request of its own, and each of those is one.

---

## 3. The caps, and the arithmetic behind them

**Decision**:

| Cap | Value | Applies to |
|---|---|---|
| `MAX_RICH_TEXT` | 20,000 | The ticket description only |
| `MAX_TEXT` (existing) | 4,000 | Comment text, criterion, extra-field value |
| `MAX_LABEL` (existing) | 200 | Key, title, type, state, priority, assignee, sprint, author, label, field name |
| `MAX_URL` | 2,000 | A ticket or parent address |
| `MAX_COMMENTS` | 50 | Comments on one ticket |
| `MAX_TICKET_LABELS` | 30 | Labels on one ticket |
| `MAX_EXTRA_FIELDS` | 30 | Unmodelled fields on one ticket |
| `MAX_CRITERIA` (existing) | 50 | Acceptance criteria |

**Rationale**: `MAX_TEXT` is 4,000 and was sized for prose an agent composes. A
tracker description is not that — it is a document someone else wrote, routinely
with reproduction steps and a table in it, and 4,000 would refuse ordinary
tickets. 20,000 is roughly ten times a typical description and still an amount a
person can scroll. Comment *text* stays at 4,000 because a comment that long is
already unusual; the bound that matters for comments is how many, not how long.

`MAX_URL` at 2,000 is the practical ceiling browsers and trackers observe, and
well under the existing `MAX_PATH` of 500 would have been too small for a real
tracker link with query parameters.

**The arithmetic, done explicitly, because decision 29 exists precisely because
it was not done the first time.** Worst legal ticket, in characters:

| Part | Worst case |
|---|---|
| description | 20,000 |
| criteria | 50 × 4,000 = 200,000 |
| comments | 50 × (4,000 + 200 + 30) = 211,500 |
| extra fields | 30 × (200 + 4,000) = 126,000 |
| labels | 30 × 200 = 6,000 |
| identity, addresses, parent | ≈ 5,000 |
| **total** | **≈ 568,500** |

So a maximal ticket is around 555 kB of ASCII, or more in UTF-8, against a
`MAX_BODY_BYTES` of 1 MiB. **The per-field caps do not bound the request, and
that is not a defect** — decision 29 established that a report legal by every
individual cap may still be refused for total size, and answers 413 naming the
ceiling so the caller can act. The same holds here, and the separate endpoint
(decision 1 above) makes it much less likely to bite: a ticket is weighed on its
own rather than competing for the same megabyte as 500 tasks.

**Alternatives considered**:

- *Raise `MAX_TEXT` globally to 20,000.* Rejected: it would let an agent write
  20,000-character prose into a focus note or a task detail, which is a
  regression in every other view. The larger cap belongs to the one field whose
  content someone else wrote.
- *Truncate an over-long description and mark it truncated.* Rejected outright by
  FR-027 and by the existing rule that caps reject rather than truncate —
  "silently shortening an agent's prose would put words on the board that nobody
  wrote". A shortened description must be the agent's choice, so the refusal
  names the field and the limit and the adapter decides.
- *Lower the caps until the worst case fits in 1 MiB.* Rejected as false comfort:
  it would contort per-field limits to encode a total that the body cap already
  enforces correctly and reports honestly.

---

## 4. Where the tab sits, and how five fit at 380px

**Decision**: the ticket destination sits **second**, after Overview. The
existing "User Stories" label shortens to "Stories".

**Rationale for second**: the active destination falls back to the first
available one, so putting the ticket first would silently change which view a
ticket-driven session lands on. Overview stays the landing view for every
session, and the reading order becomes source → plan → decomposition → log,
which is the order the work actually happened in.

**Rationale for the rename**: at the 380px minimum the strip shrinks tabs rather
than scrolling — the window never scrolls horizontally at any supported size — and
five labels have to share roughly 364px. "User Stories" is the longest by a wide
margin and the view's own heading has always said "Stories", so the tab has been
the odd one out. Shortening it costs no information and buys most of the room the
fifth destination needs.

**This is measured, not asserted.** The quickstart drives the window to 380px
with a ticket held and requires every label legible and every destination
operable, with no horizontal scrolling — the same way feature 008 verified six
pills at the floor rather than trusting the arithmetic.

**Alternatives considered**:

- *Horizontal scroll on the strip.* Forbidden — no view scrolls sideways at any
  supported width.
- *Icons instead of labels past four tabs.* Rejected: an unlabelled destination
  is a guess, and this product has no icon vocabulary to draw on.
- *An overflow menu.* Rejected: a second navigation idiom for one extra
  destination, and it hides exactly the tab that is only present when it matters.
- *Shorten every label.* Rejected as unnecessary; one label is the outlier.

**Design revision owed**: the exports show four destinations. Per decision 8 the
exports are canon for look and feel, so the fifth tab and the shortened label are
a revision this feature owes rather than a licence to improvise. The bar it has
to clear is FR-006 and SC-008.

---

## 5. Rendering the ticket's text

**Decision**: the description and comment bodies use `white-space: pre-wrap` with
`overflow-wrap: anywhere`, as text nodes. The status uses the existing
`StatusLabel`/`StatusDisc` components.

**Rationale**: the precedent exists and is exact. `LastPromptSection.css` renders
the other long, multi-line, externally-authored text on the board with precisely
those two properties, for the stated reason that "a prompt often contains a long
unbroken path". A flattened ticket description has the same two problems —
meaningful line breaks, and unbroken tokens like URLs and stack frames.

The status is not a free choice: `tests/source-hygiene.test.ts` fails the build
if any file outside `vocabulary.ts` and `StatusLabel.tsx` contains a quoted
status synonym or classifies a status itself. A ticket state is a status, so it
goes through those components. This is a convention enforced by a test rather
than by review, and it is the right answer anyway — a tracker's *Done* should
look like every other *Done* on the board, and its *Ready for QA* should fall
back to neutral like any other unrecognised word.

**Sections**: the existing `Section` component supplies the collapsible header
with its own summary, which is how every Overview section already works. The
ticket view is a stack of those rather than a new container idiom.

**No `Availability` wrapper.** The three-state `available | empty | unreadable`
pattern exists for sources the board *reads* and can fail to read. A ticket is
either reported or the destination is absent, so there is no unreadable state to
model. The distinction the spec draws is between *no ticket concept* (no tab) and
*a field not reported* (field absent), and neither needs the wrapper.

---

## 6. Multiple sessions

**Decision**: the destination follows the selected session, appearing and
disappearing as the developer switches.

**Rationale**: every view shows one session, and this one is no different. A
developer switching from a ticket-driven session to a Spec-Kit one loses the
destination — but that is *their own action*, not a report reaching into their
attention, which is the distinction decision 36 turns on. FR-005 requires the
ticket shown to be the selected session's and no other.

The switcher's pills are **not** given ticket information. `SessionSummary`
carries only what a pill draws, deliberately, and widening it to serve one view
is the thing its own comment argues against.
