# Tasks: Ticket Tab and Openable Links

**Input**: Design documents from `specs/010-ticket-tab-links/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [quickstart.md](quickstart.md), [data-model.md](data-model.md), [contracts/](contracts/)

Features 001–009 are merged, and decision 36 — every tab offered from the first
report — is in place. That ordering matters: this feature's tab is the single
exception to that rule, and a rule has to exist before an exception to it means
anything.

> **Rebased onto feature 011 (2026-08-12), which was built first.** Three things
> in this list changed and are marked *(rebased)* where they occur:
>
> 1. **Six destinations, not five.** The tree is the fifth. T020's floor
>    measurement is the six-destination one 011 recorded as owed.
> 2. **The ticket tab is the fourth conditional destination, not the only one.**
>    011 made the tree, Stories and Tasks conditional on the same principle
>    (a *concept* the session has, never a *count* in a snapshot). T015's comment
>    argues from that rule rather than against decision 36 alone.
> 3. **Decisions 40 and 41, not 37 and 38.** 011 took 37–39.
>
> A session with no ticket and no stories still offers exactly four destinations,
> so T018's absence test is unchanged.

**Tests**: Included, and the weight is somewhere new. Feature 005 tested that
failure was contained; 007 tested that the view does not lie; 008 tested that the
developer is not moved. This one tests that **the board does not do what it is
told** — an address arrives from an agent, on a board any local process may
report to, and the suite's job is to prove the board refuses most of them. There
is no Setup phase because this feature adds no dependency to any package.

## Format: `[ID] [P?] [Story] Description`

---

## What is already built and must not be rebuilt

| Thing | Where | Use it for |
|---|---|---|
| The envelope and the route shape | `main/routes/note.ts` | `/v1/ticket` is the third door and copies the second — same envelope, same 400/413/415/404, same rejection body |
| A single-purpose store writer | `main/store.ts` `putTranscript` | `putTicket` is modelled on it exactly: one method, one branch of `Session`, no merge |
| The status vocabulary | `renderer/lib/vocabulary.ts`, `StatusLabel.tsx` | A ticket's `state` is a status. `tests/source-hygiene.test.ts` **fails the build** if any other file classifies one, so this is enforced rather than reviewed |
| Collapsible sections | `renderer/components/Section.tsx` | The ticket view is a stack of these, not a new container idiom |
| Long externally-authored text | `views/transcript/LastPromptSection.css` | `pre-wrap` + `overflow-wrap: anywhere`, for exactly the two problems a description has: meaningful line breaks and unbroken URLs |
| Shared caps | `packages/contract/src/caps.ts` | New caps go here so a client refuses before a round trip while the service still enforces independently |
| The tab strip and its availability rule | `app/TabStrip.tsx`, `app/App.tsx` | Decision 36 made every tab unconditional. This adds the one conditional back — deliberately, and it must say so |
| The bridge counter | `tests/e2e/read-only.spec.ts` | Asserts **exactly two reads and two local writes** and fails on any unknown member. It goes to three writes by being edited on purpose |
| The content-size resize helper | feature 006's e2e helper | The 380px floor is measured with this, not with a bare `setSize` |
| Elapsed time | `renderer/lib/elapsed.ts` | FR-011. The board's times are elapsed and board-stamped; a tracker's own date is neither |

---

## Three things this feature must not get wrong

**The address rule is the whole safety story.** Parse with the platform URL
parser; require the protocol to be exactly `http:` or `https:`. Not
`startsWith('http')`, which passes `httpx:`, and not any `includes` check, which
`javascript:void(0)//https://example.com` defeats. Both of those live in the
quickstart's table because both are the mistake that actually gets made. Checked
at ingest **and** again in the main process — the second is the one that counts,
because "the renderer only asks for validated addresses" is a claim about the
whole renderer rather than about one function.

**Stickiness must hold by construction, not by memory.** FR-003 is satisfied
because nothing in the report path can reach a ticket. If any task finds itself
adding a retain-across-replace guard inside `putReport`, the separate endpoint
has been abandoned and the plan needs revisiting rather than patching — see
[research.md §1](research.md).

**Nothing learns what Jira is.** `system` is a label the board prints and never
branches on. No base URL, no field schema, no link construction. The moment the
board can build a Jira address it must be taught Azure DevOps next, and FR-012's
escape hatch is what makes a second tracker an adapter instead of a release.

## Path conventions

```text
packages/contract/src/
packages/clients/src/
apps/board/src/main/
apps/board/src/renderer/src/views/ticket/
apps/board/tests/e2e/
```

---

## Phase 1: Foundational

**Purpose**: Everything that can hold, carry and refuse a ticket — none of it
drawing one. No user story can begin until a ticket can exist.

- [x] T001 [P] Add `MAX_RICH_TEXT` (20,000), `MAX_URL` (2,000), `MAX_COMMENTS` (50), `MAX_TICKET_LABELS` (30) and `MAX_EXTRA_FIELDS` (30) to `packages/contract/src/caps.ts`, alongside the existing ones. **Do not raise `MAX_TEXT`** — [research.md §3](research.md) rejects it explicitly, because 20,000 characters of agent prose in a focus note is a regression in every other view
- [x] T002 Create `packages/contract/src/url.ts` — the one openability rule, exported for three callers. Parse with the platform URL parser; require the parsed protocol to be exactly `http:` or `https:`. No string matching, no protocol added, no address rewritten (FR-022). Say in the file why parsing rather than matching is load-bearing, so nobody optimises it into a `startsWith`
- [x] T003 [P] Write `packages/contract/src/url.test.ts` — **one case per row** of [quickstart.md §4](quickstart.md)'s table, including the two a naive check lets through: `httpx://example.com` and `javascript:void(0)//https://example.com`. Also `www.example.com`, which must be refused and **not promoted**. Teeth-check the suite by replacing the parse with `startsWith('http')` and confirming it fails
- [x] T004 Add `Ticket`, `Comment`, `ExtraField`, `Parent` and `TicketRequest` to `packages/contract/src/schema.ts` per [data-model.md](data-model.md) — `key` and `title` required, every other field optional, **no format rule on `key`** (the contract has never had one for an identifier and must not gain one here), unknown keys stripped rather than rejected
- [x] T005 [P] Extend the contract's schema tests — every cap refuses at limit+1 **naming the field and the limit** (FR-026); nothing is ever truncated (FR-027); a ticket carrying a `file:` or `javascript:` address parses successfully, because an unopenable address is not an invalid ticket; an over-length `url` *is* refused, because that is a size limit rather than a judgement about content
- [x] T006 Add `ticket` and `ticketReportedAt` to `Session` in `apps/board/src/main/store.ts` with `putTicket`, modelled on `putTranscript` — opens or finds the session, **replaces** the ticket wholesale, stamps `ticketReportedAt`, moves `lastHeardAt`, announces `{ type: 'ticket', key }`. **`putReport` is not touched**
- [x] T007 [P] Extend `apps/board/tests/unit/store.test.ts` — `putTicket` replaces rather than merges; **ten `putReport` calls leave `ticket` and `ticketReportedAt` untouched**, which is FR-003 as a unit fact and asserts that the report path has no reach rather than that someone remembered a guard; dismissal takes the ticket with the session
- [x] T008 Add `ticket` and `ticketReportedAt` to `SessionView` in `apps/board/src/main/view.ts`, listed field by field rather than spread, as the projection's own comment requires. **Do not add `hasTicket`** — the renderer decides availability from `ticket !== null`, and a second field meaning the same thing is a second thing to keep in step. Leave `SessionSummary` unchanged
- [x] T009 [P] Extend `apps/board/tests/unit/view.test.ts` — a held ticket projects exactly as held; a session with none projects `null`; and `SessionSummary` still carries **no** ticket information, so a pill cannot start drawing one
- [x] T010 Create `apps/board/src/main/routes/ticket.ts` — `POST /v1/ticket`, modelled on `routes/note.ts`, with the same envelope handling and the same response codes per [contracts/ticket-endpoint.md](contracts/ticket-endpoint.md)
- [x] T011 [P] Write the endpoint's integration tests in `apps/board/tests/` — 200 holds the ticket; 400 names the offending field and its limit; 413 is decided before parsing; 415 on a wrong content-type; **a ticket carrying an unopenable address is a 200** and the address is kept
- [x] T012 [P] Add `ticket()` to `packages/clients/src/client.ts`, failing soft exactly as the other two calls do — no board running means "carry on, no need to retry", while a 400 *is* an error because it is the caller's own malformed call
- [x] T013 Add `cocoapilot_ticket` to `packages/clients/src/mcp/tools.ts`, taking the `ticket` object only — `repo`, `branch` and `sessionId` are filled in by the client, as on the other two tools. Its description must say the three things in [contracts/ticket-endpoint.md](contracts/ticket-endpoint.md): report once rather than per update, flatten formatting to plain text first, and send the real address while counting any comments left out. **Add no CLI command** — there is no hook or script that reports a ticket, and a subcommand with no caller is surface for its own sake

**Checkpoint**: A ticket can be reported, held, projected and refused, with nothing yet drawing one.

---

## Phase 2: User Story 1 — Read the ticket you are working from (Priority: P1) 🎯 MVP

**Goal**: The ticket the work came from, on the board: what it is called, what
state it is in, what it asks for, and what it will be accepted against.

**Covers**: FR-001 – FR-011, FR-014, FR-018; SC-001, SC-002, SC-008, SC-009

**Independent test**: Report a ticket and confirm a tab appears carrying every
field that was reported, with nothing shown that was not.

- [x] T014 [US1] Add the ticket destination to `apps/board/src/renderer/src/app/TabStrip.tsx` **second, after Overview**, and shorten the existing "User Stories" label to "Stories". Second is functional rather than aesthetic: the active destination falls back to the first available, so a ticket tab placed first would silently change which view a ticket-driven session lands on ([research.md §4](research.md))
- [x] T015 [US1] *(rebased)* Add the conditional to `availableTabs` in `apps/board/src/renderer/src/app/App.tsx`, gated on `ticket !== null`. **Write the reason in the comment**: it gates on whether the session has a ticket *concept* rather than on whether a snapshot carries content, which is decision 33's empty-versus-unavailable distinction applied a level up, and is the same principle as 011's three. Decision 36 forbids gating on a *count*, so that no snapshot can withdraw a destination from a reader; this does not. It stays here rather than in `usePresence`, which says so itself. A later reader must not be able to mistake it for the regression it resembles
- [x] T016 [P] [US1] Create `apps/board/src/renderer/src/views/ticket/TicketIdentity.tsx` and its CSS — key, title, and the state through the existing `StatusLabel`/`StatusDisc`, never classified locally. The address is drawn as text here whether or not it is openable; the control that opens it is T023
- [x] T017 [US1] Create `apps/board/src/renderer/src/views/ticket/TicketView.tsx` and its CSS — a stack of existing `Section` components. Description and criteria use `pre-wrap` with `overflow-wrap: anywhere`, per `LastPromptSection.css`. Every unreported field is **omitted**, never blank, never "unknown", never invented (FR-008). **No `Availability` wrapper** — a ticket is either reported or the destination is absent, so there is no unreadable state to model ([research.md §5](research.md))
- [x] T018 [P] [US1] Write `apps/board/tests/e2e/ticket.spec.ts` — start with **the absence test**: a session with no ticket offers four destinations with their empty views and **no fifth**, which is the comparison SC-002 turns on. Then a ticket is reported and the destination appears; Overview is still the landing view; every reported field is shown and every unreported one absent; elapsed time is present with no assessment of whether it is current (FR-011)
- [x] T019 [US1] **The stickiness test**, in the same spec — report a ticket, then send **ten** ordinary reports that say nothing about it: the destination is still offered and still shows it (SC-009). Then report a *different* ticket and confirm it replaces rather than accumulates. This is the scenario that fails if the ticket is ever folded into the report snapshot, and it is end-to-end rather than a unit test because the failure it catches is a tab withdrawn from under a reader
- [x] T020 [P] [US1] *(rebased)* **The density test** — with a ticket held *and* a story reported *and* the old views kept, drive the window to 380px using feature 006's content-size helper: **six** destinations, every label legible, every one operable, **no horizontal scrolling** (SC-008). This is the six-destination measurement feature 011 recorded as owed in `docs/design/revisions-owed.md`; 011 measured five and held. Measure the baseline on the parent commit *first* rather than assuming the six known display-scale failures — they did not occur on this machine at 100% scale, and an assumed failure is as misleading as an unnoticed one

---

## Phase 3: User Story 2 — Open the ticket in your own browser (Priority: P2)

**Goal**: The ticket's address, and its parent's, open in the browser the
developer is already signed in to.

**Covers**: FR-019 – FR-025; SC-003, SC-004, SC-005

**Independent test**: Report a ticket carrying an ordinary web address, activate
it, and confirm the browser opens it while the application's own window goes
nowhere and nothing is sent to any agent.

- [x] T021 [US2] Create `apps/board/src/main/links.ts` — on receiving a URL: it must be a string (anything else dropped silently, as the two existing channels already do with a non-string key), it must parse, and its protocol must be exactly `http:` or `https:`, using the **shared rule from T002**. Only then is it handed to the OS. Nothing is logged and no failure is reported back to the renderer
- [x] T022 [US2] Add the `openLink` channel in `apps/board/src/main/app.ts` and the `openLink` member to `apps/board/src/preload/index.ts` — fire-and-forget like `select` and `dismiss`, carrying a URL string and nothing else, returning nothing. `window.ts` is **unchanged**: `setWindowOpenHandler` still denies every window-open request and `will-navigate` stays blocked
- [x] T023 [US2] Draw the control in `TicketIdentity.tsx` for openable addresses only, deciding openability with the **same shared rule** so a control never appears for an address the main process would drop. The address stays visible as text either way (FR-021), which is also what satisfies FR-025 — the developer sees where it leads because it is on screen, not via a hover affordance they have to discover
- [x] T024 [P] [US2] Extend `apps/board/tests/e2e/read-only.spec.ts` — the bridge goes from two local writes to **three**, and it must still fail if a fourth member appears. Teeth-check that by adding a fourth and confirming the failure. A test that counts is exactly the kind that should have to be edited on purpose
- [x] T025 [US2] **The safety test**, in `ticket.spec.ts` — one case per row of [quickstart.md §4](quickstart.md)'s address table, each confirmed a 200 on the endpoint and not openable in the view. For an ordinary `https` address: the system browser opens it, the application's own window navigates nowhere and opens no additional window (FR-023), and there are **zero** outbound requests from the application and nothing to any agent (SC-005, FR-024) — no title fetch, no redirect resolution, no preview. A parent's address opens the same way (FR-020)

---

## Phase 4: User Story 3 — Read the ticket's discussion (Priority: P3)

**Goal**: The comments — the clarification that never made it into the
description.

**Covers**: FR-015, FR-016, FR-017

**Independent test**: Report a ticket with comments and confirm they are listed
with their authors in the order reported, and that a ticket with more comments
than the board holds says how many are missing.

- [x] T026 [US3] Create `apps/board/src/renderer/src/views/ticket/CommentList.tsx` and its CSS — **oldest first**, as reported, because a discussion reads forward (this differs from notes, which are newest first, because notes are a log and a discussion is a thread). Author where supplied; `at` rendered as the **label it is** and never parsed into a time, since the board's own times are elapsed and board-stamped and it cannot vouch for a tracker's. `pre-wrap` on the body
- [x] T027 [US3] Show the overflow line in `CommentList.tsx` from `commentsOmitted` — "50 shown, 150 not included" (FR-016). It is **reported, not derived**: the board cannot know a ticket had 200 comments when it was sent 50. A ticket with no comments **says so**; the section is present rather than omitted (FR-017)
- [x] T028 [P] [US3] Extend `ticket.spec.ts` — order preserved, authors shown, the omitted count stated rather than 50 presented as all of them, the explicit no-comments statement, and markup in a comment visible as characters

---

## Phase 5: User Story 4 — Work from a tracker the board has never heard of (Priority: P3)

**Goal**: A ticket from Azure DevOps or something in-house shows in full, without
anything in the board having been taught about it.

**Covers**: FR-012, FR-013, FR-014; SC-010

**Independent test**: Report a ticket whose fields are entirely ones the board
does not model, and confirm all of them are displayed.

- [x] T029 [US4] Create `apps/board/src/renderer/src/views/ticket/FieldList.tsx` and its CSS — labelled values **in the order reported**, because the agent decides what matters most and the order is the only signal it has for saying so
- [x] T030 [US4] Show `system` in `TicketView.tsx` where it was reported and **name nothing where it was not** (FR-013). Assert in the file's own comment that nothing branches on this value — it is printed and never read
- [x] T031 [P] [US4] Extend `ticket.spec.ts` — a ticket whose only recognised fields are `key` and `title`, everything else in `fields`, displays in full and in order (SC-010); a `state` of `Ready for QA` shows exactly as written and falls back to neutral, while `Done` takes the same colour as a task's `done` (FR-014)

---

## Phase 6: Polish

- [x] T032 [P] Extend `apps/board/tests/e2e/only-reported.spec.ts` with a ticket-tab subtraction block — the elapsed time, the section headings, the comment-overflow line and the empty-comments sentence are all board text and each has to be declared. This is the sixth tab and the sixth copy, for the reason the second one gives
- [x] T033 [P] **The markup test** (SC-012) in `ticket.spec.ts` — a ticket carrying `<script>`, `<img src=x onerror=…>` and an ADF fragment in the description, every criterion, every label, every comment and every extra field. All of it visible as characters, no element created, no handler run, and line breaks in the description preserved
- [x] T034 Extend `ticket.spec.ts` for sessions and lifetime — two sessions, one ticket-driven and one not, with the destination offered for the first and not the second and only the selected session's ticket shown (FR-005); pills carrying no ticket information; a dismissed session taking its ticket with it and bringing it back on reporting again; and **no ticket held after a restart** (SC-011, FR-028)
- [x] T035 Walk the `stacks/vite-react.md` checklist over `views/ticket/` — stable keys, no colour literals outside `tokens.css`, no `useEffect` computing what could be derived, and no timer refreshing data
- [x] T036 *(rebased)* Record the design revision this feature owes by **appending to `docs/design/revisions-owed.md`**, which feature 011 created for exactly this — the exports draw four destinations and are canon for look and feel (decision 8), so the sixth tab and the shortened "Stories" label are a revision rather than a licence to improvise. Discharge 011's owed six-destination measurement in the same edit. The bar is FR-006 and SC-008, which T020 measures
- [x] T037 Run `npm run build --workspace @cocoapilot/board`, `npm run typecheck`, `npm test` and `npm run test:e2e`, then walk the ten scenarios in [quickstart.md](quickstart.md) — correcting the quickstart where it turns out to be wrong rather than leaving it agreeing with itself
- [x] T038 [P] *(rebased)* Update `CHANGELOG.md` and `STATUS.md` — decisions **40 and 41** (011 took 37–39) belong to the two this feature settled: **the ticket gets its own endpoint** rather than a field on the report, and **only `http:` and `https:` are ever opened, parsed rather than matched and checked twice**. Also flip `specs/010-ticket-tab-links/spec.md`'s `Status` from `Draft`, which the checklist has already passed
- [ ] T039 Read back the full diff, then merge

---

## Dependencies

Foundational → US1 → US2 → US3 → US4 → Polish.

T002 blocks T003, T021 and T023 — the openability rule has exactly one
implementation and three callers, and writing any caller before it exists is how
the second copy gets made. T004 blocks T006; T006 blocks T008; T008 blocks every
view task, because no view can draw what the projection does not carry. T014
blocks T015. T016 blocks T023. Everything marked `[P]` is genuinely independent.

US2 depends on US1 only for somewhere to put the control — the main-process rule
(T021) and the bridge test (T024) can be written the moment T002 exists.

## What is deliberately not here

The agent-side adapters that read Jira or Azure DevOps: they are instructions
rather than product surface, and they could not be written usefully until the
shape of a reported ticket was fixed, which is what this feature fixes. Any
record of past tickets. Rendering a tracker's markup. A `DELETE` to clear a
ticket — it goes when its session goes. A `ticket` CLI command, which would have
no caller. Copy-to-clipboard, worth having and separately. Openable addresses
anywhere other than the ticket and its parent — changed-file paths and
specification paths stay text, and making them openable is its own work.
