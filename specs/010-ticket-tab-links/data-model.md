# Data Model: Ticket Tab and Openable Links

**Feature**: 010 | **Date**: 2026-08-12

What this feature adds to the contract, to held state, and to the window's
projection. Nothing here is stored anywhere; all of it dies with the process.

---

## Contract entities (`packages/contract`)

New caps, alongside every other in `caps.ts` so a client can refuse before a
round trip. Values and the arithmetic behind them: [research.md §3](research.md).

```
MAX_RICH_TEXT       20_000   the description, and nothing else
MAX_URL              2_000   a ticket or parent address
MAX_COMMENTS            50
MAX_TICKET_LABELS       30
MAX_EXTRA_FIELDS        30
```

### `Ticket`

Every field optional except `key` and `title` — a ticket the developer cannot
name is not usable, and everything else varies by tracker.

| Field | Type | Cap | Notes |
|---|---|---|---|
| `key` | required | `MAX_LABEL` | `PROJ-1234`, `45678`. **No format rule** — the contract has never had one for an identifier and must not gain one here |
| `title` | required | `MAX_LABEL` | |
| `url` | nullable | `MAX_URL` | Reported, never derived (FR-009). Openability is decided at display, not here |
| `system` | nullable | `MAX_LABEL` | `Jira`, `Azure DevOps`. For honest labelling only; **nothing branches on it** |
| `type` | nullable | `MAX_LABEL` | Story, Bug, Product Backlog Item |
| `state` | nullable | `MAX_LABEL` | Free text, classified for colour by the existing vocabulary. Named `state` rather than `status` so it is never confused with a task's |
| `priority` | nullable | `MAX_LABEL` | |
| `assignee` | nullable | `MAX_LABEL` | |
| `reporter` | nullable | `MAX_LABEL` | |
| `sprint` | nullable | `MAX_LABEL` | Sprint, iteration, milestone — one slot, whatever the tracker calls it |
| `description` | nullable | `MAX_RICH_TEXT` | Flattened to plain text by the agent before it arrives |
| `criteria` | array | `MAX_CRITERIA` × `MAX_TEXT` | Same shape as a story's, deliberately |
| `labels` | array | `MAX_TICKET_LABELS` × `MAX_LABEL` | |
| `comments` | array | `MAX_COMMENTS` × `Comment` | Oldest first, as reported |
| `commentsOmitted` | nullable int ≥ 0 | — | How many the agent left out. See below |
| `fields` | array | `MAX_EXTRA_FIELDS` × `ExtraField` | The escape hatch (FR-012) |
| `parent` | nullable | `Parent` | A reference, never a nested ticket |

### `Comment`

| Field | Type | Cap |
|---|---|---|
| `author` | nullable | `MAX_LABEL` |
| `text` | required, min 1 | `MAX_TEXT` |
| `at` | nullable | `MAX_LABEL` — the tracker's own rendering of when, as a string |

`at` is a **label, not a timestamp**. The board's own times are elapsed and
board-stamped; a tracker's comment date is neither, and parsing it into one would
invite the board to compute an age it cannot vouch for. It is shown as the
tracker wrote it or not at all.

### `ExtraField`

| Field | Type | Cap |
|---|---|---|
| `label` | required, min 1 | `MAX_LABEL` |
| `value` | required | `MAX_TEXT` |

Order is meaningful and preserved: the agent decides what matters most.

### `Parent`

| Field | Type | Cap |
|---|---|---|
| `key` | nullable | `MAX_LABEL` |
| `title` | required, min 1 | `MAX_LABEL` |
| `url` | nullable | `MAX_URL` |

Flat by design. A parent's parent is not modelled — an epic hierarchy is the
tracker's business, and one level up is what a developer needs to see.

### `commentsOmitted` carries FR-016, and it has to be reported

The board cannot know a ticket had 200 comments when it was sent 50. Only the
agent knows, so the count is reported rather than derived — and the view says
"50 shown, 150 not included" from it. This is a place where the board is
honestly dependent on the agent, and the alternative was worse: showing 50
comments as though they were all of them.

Guidance for the adapter belongs in the tool description: if you drop comments,
say how many.

---

## Held state (`apps/board/src/main/store.ts`)

```
Session {
  ...existing
  ticket: Ticket | null          // its own branch, like notes and transcript
  ticketReportedAt: number | null // board-stamped, for elapsed time (FR-011)
}
```

Written by exactly one method, mirroring `putTranscript`:

```
putTicket(request: TicketRequest, receivedAt): StoreResult<Session>
```

- Opens or finds the session, exactly as `putReport` and `appendNote` do.
- **Replaces** `ticket` wholesale. No merge, no field-level update.
- Sets `ticketReportedAt = receivedAt`.
- Moves `lastHeardAt` — reporting a ticket is the agent saying something.
- Announces a `{ type: 'ticket', key }` change.

`putReport` is **not touched**. That is the point of the separate endpoint: FR-003
holds because nothing in the report path can reach the ticket, rather than because
someone remembered to preserve it. See [research.md §1](research.md).

Cleared only by the session going — dismissal or restart (FR-028). No expiry, no
timer, consistent with everything else.

---

## Projection (`apps/board/src/main/view.ts`)

```
SessionView {
  ...existing
  ticket: Ticket | null
  ticketReportedAt: number | null
}
```

Listed field by field like every other, not spread — the projection's own comment
requires each new field to be argued for rather than arriving by widening.

`SessionSummary` is **unchanged**. Pills draw identity, chip and elapsed time and
nothing else; see [research.md §6](research.md).

`hasTicket` is deliberately **not** added: the renderer decides tab availability
from `ticket !== null`, and a second field meaning the same thing is a second
thing to keep in step.

---

## Validation

Per rule 2 and decision 18 — being a local process is not authorisation.

| Rule | Where | Failure |
|---|---|---|
| Envelope (`repo` exists, `branch`, `sessionId`, `transcriptId`) | Existing shared path | As today |
| Every cap above | `packages/contract` | 400, naming the field and the limit (FR-026) |
| Body ≤ `MAX_BODY_BYTES`, before parsing | Existing | 413 naming the ceiling |
| `content-type: application/json` | Existing | 415 |
| Unknown keys | Existing | Stripped, not rejected — a newer agent degrades against an older board |
| `url` / `parent.url` parse to `http:` or `https:` | Contract, then again in main at open time | Not openable; still shown as text (FR-021) |
| Nothing truncated, ever | Everywhere | Refusal instead (FR-027) |

**A malformed address is not a rejected ticket.** A ticket carrying a `file:`
address is still a valid, useful ticket — the address is simply not openable. The
alternative would let one bad field discard a whole ticket, which serves nobody.
The cap on `url` length *is* enforced as a rejection, because that is a size
limit rather than a judgement about content.

---

## What is deliberately not modelled

- **Attachments.** Binary content, a fetch to display, and no way to show one as
  plain text.
- **Watchers, vote counts, work-log entries.** No reader for them; `fields` is
  the escape hatch if one ever matters.
- **A comment's own identifier.** Comments never reorder or update in place — they
  arrive as a list and are replaced as a list — so position is identity, exactly
  as it is for a report's tasks.
- **Nested parents.** One level up. See `Parent`.
- **Anything about the tracker beyond its name.** No base URL, no project
  metadata, no field schema. The board that knows how to build a Jira link is a
  board that has to be taught Azure DevOps next.
