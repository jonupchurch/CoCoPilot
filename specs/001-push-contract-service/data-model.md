# Data Model: Push Contract and Local Service

**Feature**: [001-push-contract-service](spec.md) | **Date**: 2026-08-06

Everything here lives in memory and dies with the process (decision 21). There
is no schema migration, no persistence format, and no versioned storage.

---

## Store

The whole of the application's state.

```
Store
  sessions: Map<SessionKey, Session>
  changes:  EventEmitter          // decision 28 — notifies the renderer
```

**SessionKey** is `repoPath + "\0" + sessionId`. The NUL separator cannot occur
in either component, so a crafted `sessionId` cannot forge a key belonging to
another repository.

### Session cap behaviour

At the 100-session cap, a report for a **new** session is **rejected** with a
reason naming the cap. Existing sessions continue to accept reports.

Rejecting rather than evicting is the deliberate choice: eviction would silently
discard a session a developer might be watching, and it would be the only place
in the product where something disappears without either a restart or a
dismissal — which decision 15 and feature 008's FR-017 both forbid. A cap of 100
against a realistic working maximum of a handful means this is a runaway-client
backstop, not a limit anyone reaches.

---

## Session

One agent's work in one repository.

| Field | Type | Notes |
|---|---|---|
| `repoPath` | string | Absolute path. Checked for existence; never opened |
| `sessionId` | string | Client-supplied, or `"unattributed"` |
| `attributed` | boolean | False for script/hook sessions (FR-004) |
| `branch` | string | As reported |
| `declaredAt` | number | First contact. Fixes switcher order (feature 008 FR-004) |
| `lastHeardAt` | number | Most recent contact of any kind. Drives elapsed display |
| `report` | Report \| null | Latest snapshot. Null if only notes have arrived |
| `notes` | Note[] | Append-only, oldest first |

`declaredAt` is set once and never updated — the switcher must not reorder
(feature 008 FR-004), so it cannot be derived from recency.

`lastHeardAt` updates on **both** reports and notes. A session actively adding
notes is being heard from, and showing it as long-quiet would be wrong.

`report` being nullable is load-bearing: a note can create a session before any
report exists (feature 007's edge cases), and a view must distinguish "reported
nothing" from "reported an empty feature".

---

## Report

A complete snapshot. Replaces its predecessor entirely (decision 26) — there is
no merge path anywhere in the code.

| Field | Type | Cap | Notes |
|---|---|---|---|
| `feature` | Feature \| null | — | What is being worked |
| `stories` | Story[] | 200 | Order preserved as reported |
| `tasks` | Task[] | 500 | Order preserved as reported |
| `plan` | PlanStep[] | 100 | Ordered sequence |
| `focus` | Focus \| null | — | What is happening right now |
| `changedFiles` | ChangedFile[] | 200 | Lowest-priority section |
| `receivedAt` | number | — | Service-stamped (FR-003) |

### Feature

| Field | Type | Cap |
|---|---|---|
| `id` | string | 200 |
| `title` | string | 200 |
| `specPath` | string \| null | 500 |

### Story

| Field | Type | Cap |
|---|---|---|
| `id` | string | 200 |
| `title` | string | 200 |
| `priority` | string \| null | 200 |
| `status` | string \| null | 200 |
| `asA` / `want` / `soThat` | string \| null | 4,000 each |
| `criteria` | string[] | 50 items, 4,000 each |
| `taskIds` | string[] | 500 items, 200 each |
| `files` | string[] | 100 items, 500 each |

### Task

| Field | Type | Cap | Notes |
|---|---|---|---|
| `id` | string | 200 | |
| `storyId` | string \| null | 200 | May reference a story not present (feature 006 FR-018) |
| `title` | string | 200 | |
| `status` | string | 200 | **Free text** (decision 25). No enum, ever |
| `detail` | string \| null | 4,000 | |
| `checks` | string[] | 50 items, 4,000 each | |
| `files` | string[] | 100 items, 500 each | |

`status` is deliberately typed `string`, not a union. The recognised-value
vocabulary is a **rendering** concern and lives in the renderer, not here — a
union type would make an unrecognised status a validation failure rather than a
display case.

### PlanStep

| Field | Type | Cap |
|---|---|---|
| `text` | string | 4,000 |
| `status` | string | 200 |
| `detail` | string \| null | 4,000 |

### Focus

| Field | Type | Cap | Notes |
|---|---|---|---|
| `task` | string \| null | 200 | Task id. Need not appear in `tasks` |
| `note` | string \| null | 4,000 | The agent's prose |
| `chip` | enum | — | `idle` \| `watching` \| `thinking` \| `needs-you` |

`chip` is the **only** closed enum in the payload, and deliberately so: it is
the sole channel by which an agent asks for a human (decision 15), so its values
must be exhaustively known for the UI to treat one of them as attention. Every
other status is free text.

Defaults to `thinking` when a report omits it.

### ChangedFile

| Field | Type | Cap |
|---|---|---|
| `path` | string | 500 |
| `change` | string | 200 |
| `added` / `removed` | number \| null | — |
| `note` | string \| null | 200 |

---

## Note

Appends. The only accumulating structure in the system (decision 20).

| Field | Type | Cap | Notes |
|---|---|---|---|
| `text` | string | 4,000 | |
| `source` | string \| null | 200 | Agent's phrasing — "you asked" |
| `receivedAt` | number | — | Service-stamped |

At the 1,000-note cap a session **rejects** further notes, matching the session
cap's reasoning: nothing disappears without a restart or a dismissal.

---

## Envelope

Present on every request. None of it is composed by the model (feature 002
FR-002).

| Field | Type | Cap | Validation |
|---|---|---|---|
| `repo` | string | 500 | Must exist as a path. **Never opened** (FR-012) |
| `branch` | string | 200 | Opaque |
| `sessionId` | string \| null | 200 | Absent → unattributed |

---

## Validation rules

All in `packages/contract`, shared by service and clients.

1. **Reject, never truncate** (FR-011). Any cap breach fails the whole request.
2. **Strip unknown keys** (FR-013), rather than rejecting — so a newer client
   degrades against an older board.
3. **Name the field** (FR-009). Every rejection carries the path of the
   offending field.
4. **Atomic application** (FR-010, SC-001). A request is validated completely
   before the store is touched; there is no partially-applied state.
5. **Server clock only** (FR-003). Any client-supplied timestamp is stripped by
   rule 2 rather than rejected — a client sending one is confused, not hostile.
6. **Path existence only** (FR-012). `stat` the reported path; never `readdir`,
   never open, never traverse.
7. **Text is inert** (FR-014). Stored verbatim; escaping is the renderer's job,
   at the point of display. Storing escaped text would corrupt the copy-to-
   clipboard fidelity feature 005 requires.

---

## State transitions

A session has exactly three transitions, and no timed one anywhere:

```
(absent) --report or note--> Present
Present  --report---------->  Present   (report replaced wholesale)
Present  --note------------>  Present   (note appended)
Present  --dismiss--------->  (absent)  (feature 008; recreated by any later contact)
(all)    --process exit---->  (absent)
```

There is no expiry, no idle transition, and no state the store enters on its
own. Everything a view shows about staleness is computed at render time from
`lastHeardAt` — a display concern, never stored state (decision 15).
