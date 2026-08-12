# Implementation Plan: Ticket Tab and Openable Links

**Branch**: `010-ticket-tab-links` | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-ticket-tab-links/spec.md`

## Summary

A fifth destination holding the tracker ticket the work came from, reported on
its own endpoint so that reports and tickets cannot disturb each other, neutral
across trackers via a labelled-value escape hatch, and absent entirely for
sessions that never had a ticket. Its address, and its parent's, open in the
developer's browser through a single new bridge member whose whole contract is a
two-protocol allowlist enforced in the main process.

## Technical Context

Inherits [001/research.md](../001-push-contract-service/research.md) for the
service and contract, [002's client surface](../002-mcp-server-cli/contracts/client-surface.md)
for the MCP tools, and the renderer conventions from features 003–008.

**Primary Dependencies**: None new. No parser, no markup renderer, no tracker
client, no dependency added to any package.

**Storage**: None, as ever.

**Constraints**: Five destinations legible at the 380px floor with no horizontal
scrolling; only `http:` and `https:` ever opened; no text ever truncated; nothing
retained across a restart.

**Scale/Scope**: One ticket per session, up to 50 comments and 30 unmodelled
fields, a 20,000-character description.

## Constitution Check

*GATE: passed before Phase 0, re-checked after Phase 1.*

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Four stories, no clarification markers; the three questions the spec was asked to settle are settled in it, and the mechanism question the spec left open is settled in [research.md §1](research.md) |
| II. Validated trust boundaries | **Pass** | Every field capped in `packages/contract`; addresses parsed and protocol-allowlisted **twice**, the second time in the main process, which is the only side that is not drawing agent-composed text |
| III. Match existing conventions | **Pass** | Third endpoint modelled on `/v1/note`; `putTicket` modelled on `putTranscript`; `pre-wrap` from `LastPromptSection.css`; status through `StatusLabel`, which a test enforces; sections through the existing `Section` |
| IV. Scope discipline | **Pass** | No adapters, no record-keeping, no markup rendering, no CLI command, no clipboard, no openable file paths, no `hasTicket` field. Each named and declined |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md), ten scenarios, with the display-scale caveat stated so a known baseline failure is not read as a regression |
| VI. Narrate the reasoning | **Pass** | Design notes below; [research.md](research.md) carries alternatives and their rejections |
| VII. Plan whole set first | **Pass** | The initial nine are built. This is ordinary feature work under the rule's own exception |
| VIII. Test at the right level | **Pass** | Unit for the URL rule and tab availability; integration for the endpoint and its refusals; E2E for stickiness, the address table, and density at the floor |
| IX. Atomic commits, branch | **Pass** | On `010-ticket-tab-links`; spec and plan committed separately from any code |

**No violations.** Nothing to record in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/010-ticket-tab-links/
├── spec.md
├── plan.md                      # this file
├── research.md                  # six decisions with alternatives
├── data-model.md                # contract, held state, projection
├── contracts/
│   ├── ticket-endpoint.md       # POST /v1/ticket
│   └── link-surface.md          # the bridge member and its rule
├── quickstart.md
└── checklists/requirements.md
```

### Source

```text
packages/contract/src/
├── caps.ts                      # + MAX_RICH_TEXT, MAX_URL, MAX_COMMENTS,
│                                #   MAX_TICKET_LABELS, MAX_EXTRA_FIELDS
├── schema.ts                    # + Ticket, Comment, ExtraField, Parent,
│                                #   TicketRequest
└── url.ts                       # NEW: the one openability rule, shared

packages/clients/src/
├── client.ts                    # + ticket()
└── mcp/tools.ts                 # + cocoapilot_ticket (no CLI command)

apps/board/src/main/
├── routes/ticket.ts             # NEW: POST /v1/ticket
├── store.ts                     # + Session.ticket, ticketReportedAt, putTicket
├── view.ts                      # + ticket, ticketReportedAt on SessionView
├── links.ts                     # NEW: main-process validation before the OS
├── app.ts                       # + the openLink channel
└── window.ts                    # unchanged — deny handlers stay as they are

apps/board/src/preload/index.ts  # + openLink, the third local write

apps/board/src/renderer/src/
├── app/
│   ├── TabStrip.tsx             # + ticket destination, "Stories" relabel
│   └── App.tsx                  # availableTabs gains its one conditional
└── views/ticket/
    ├── TicketView.tsx           # NEW: a stack of existing Sections
    ├── TicketIdentity.tsx       # NEW: key, title, state, link
    ├── CommentList.tsx          # NEW
    └── FieldList.tsx            # NEW: the escape hatch
```

**Structure Decision**: the openability rule lives in `packages/contract/src/url.ts`
because **both** sides need it and two copies would drift — the contract validates
it at ingest, the renderer decides whether to draw a control, and
`apps/board/src/main/links.ts` re-checks before the OS call. One rule, three
callers, no restatement. That mirrors how `caps.ts` is already shared so a client
can refuse before a round trip while the service still enforces independently.

The view is a directory of small components rather than one file, matching
`views/overview/` and `views/tasks/`.

## Design notes

**The ticket gets its own endpoint, and that is the plan's main decision.** Held
as a field on the report it would need retaining across a snapshot replace, which
means a merge inside `putReport` — a method whose own comment says there is no
merge path there "and deliberately none anywhere else in this file". It would also
re-send the whole ticket on every report for the life of the session, which is the
exact cost decision 20 cited when it gave notes their own endpoint. A separate
endpoint makes FR-003 a property of the wiring instead of a rule to remember.
Full reasoning and the rejected alternative — an optional field plus a retain
exception, which also satisfies the spec — in [research.md §1](research.md).

**Three verbs, three semantics, each argued.** `/v1/push` replaces the report,
`/v1/note` appends, `/v1/ticket` replaces the ticket independently. A reader
should be able to say why each is different, and now can.

**The spec was corrected by this plan.** Three of its acceptance scenarios said
"a report carrying a ticket", which presumed the mechanism the research then
rejected. They now say "a ticket is reported", which is what a specification
should have said in the first place. Worth noting as a pattern rather than an
incident: this is the fourth feature running where the phase after the spec found
something the spec had over-specified.

**Only `http:` and `https:`, parsed rather than matched, checked twice.** The
addresses are agent-composed and any local process may report (decision 18), so
handing a string to the OS URL handler is the one genuinely dangerous act in this
feature. `startsWith('http')` admits `httpx:`; an `includes('https://')` admits
`javascript:void(0)//https://example.com`. Both are in the quickstart's table
because both are the mistake that actually gets made. The main-process check is
the one that counts — the renderer is where agent-composed text lives, and "the
renderer only asks for validated addresses" is a claim about the whole renderer.

**Refused, never repaired** (FR-022). `www.example.com` is not promoted to
`https://`; a `file:` is not rewritten. Repairing an address guesses what the
sender meant, which is the position decision 32 already declined for a reported
identifier.

**A bad address does not spoil a good ticket.** An unopenable address is a 200 —
kept, shown as text, not offered as a control. Discarding a whole ticket over one
field would serve nobody. Only a length violation is a rejection, because that is
a size limit rather than a judgement about content.

**The fifth destination is the only conditional one**, one week after decision 36
removed every other conditional. It gates on whether the session has a ticket
*concept* rather than on whether a snapshot happens to carry one — a Spec-Kit
session never has a ticket however long it runs. That is decision 33's
empty-versus-unavailable distinction applied a level up, and the spec's checklist
notes say so out loud so a later reader does not read it as a regression.

**It sits second, and that is a functional choice rather than an aesthetic one.**
The active destination falls back to the first available, so a ticket destination
placed first would quietly change which view a ticket-driven session lands on.
Overview stays the landing view for every session.

**The description is the only field with a larger cap.** 20,000 characters, for
the one field whose content someone else wrote. Raising `MAX_TEXT` globally would
let 20,000 characters of agent prose into a focus note, which is a regression
everywhere else. And over the cap the request is refused naming the field, never
truncated — so a shortened description is always the agent's own choice, which it
can say it made.

**`commentsOmitted` is reported, not derived**, because the board cannot know a
ticket had 200 comments when it was sent 50. This is a place the board is
honestly dependent on the agent; the alternative was presenting 50 as all of
them.

**Nothing learns what Jira is.** `system` is a label the board prints and never
branches on. No base URL, no field schema, no link construction. The moment the
board can build a Jira address it has to be taught Azure DevOps next, and FR-012's
escape hatch is what makes the second tracker an adapter instead of a release.

**`read-only.spec.ts` is extended, not relaxed.** Its bridge count goes from two
local writes to three, and it must still fail on a fourth member. A test that
counts is exactly the kind that should have to be edited on purpose.

## Post-design Constitution re-check

Still passing, and Phase 1 tightened two things rather than loosening any.

The separate endpoint removed a violation that would otherwise have been real:
retaining a ticket across snapshot-replace was going to be the first merge inside
`putReport`, and it would have had to be argued for in Complexity Tracking. The
endpoint means there is nothing to argue.

Sharing the openability rule from `packages/contract` removed the other: the
first sketch had the renderer deciding openability and the main process deciding
again, in two places, which is the drift `source-hygiene.test.ts` exists to catch
for the status vocabulary. One rule, imported three times.

**Ready for `/speckit-tasks`.** Two things a task list should keep hold of: the
stickiness scenario belongs in the end-to-end suite rather than a unit test,
because the failure it catches is a tab disappearing under a reader; and the
address table in [quickstart.md §4](quickstart.md) should become one test case per
row, since the two interesting rows are the ones a plausible implementation lets
through.
