# Contract: `POST /v1/ticket`

**Feature**: 010 | **Date**: 2026-08-12

The third endpoint, alongside [`/v1/push` and `/v1/note`](../../001-push-contract-service/contracts/http-api.md).
Why it is an endpoint rather than a field on a report: [research.md §1](../research.md).

---

## Semantics

**Replaces.** The reported ticket becomes the session's ticket, wholesale. Not a
merge, not an append.

Three verbs now, and each is different on purpose:

| Endpoint | Semantics | Because |
|---|---|---|
| `/v1/push` | Replaces the whole report | Idempotent and self-healing; a dropped push costs nothing |
| `/v1/note` | Appends | Resending every note to add one would be absurd |
| `/v1/ticket` | Replaces, independently of the report | One current thing that changes rarely, while reports change constantly |

The consequence that matters is the one the spec asks for: **a report cannot
disturb a ticket, and a ticket cannot disturb a report.** FR-003 is a property of
the wiring rather than a rule to be observed.

## Request

The standard envelope — `repo`, `branch`, `sessionId`, `transcriptId` — plus a
`ticket` object. Envelope fields are derived by the client from its working
directory and process, never composed by a model, exactly as on the other two
endpoints.

Shape and every cap: [data-model.md](../data-model.md).

```
POST /v1/ticket
content-type: application/json

{
  "repo": "<absolute path that exists>",
  "branch": "<label>",
  "sessionId": "<label|null>",
  "transcriptId": "<label|null>",
  "ticket": {
    "key": "PROJ-1234",
    "title": "Board shows the ticket you are working from",
    "url": "https://example.atlassian.net/browse/PROJ-1234",
    "system": "Jira",
    "type": "Story",
    "state": "In Progress",
    "priority": "High",
    "assignee": "...",
    "reporter": "...",
    "sprint": "Sprint 41",
    "description": "<plain text, already flattened>",
    "criteria": ["..."],
    "labels": ["..."],
    "comments": [{ "author": "...", "text": "...", "at": "12 Aug 2026" }],
    "commentsOmitted": 0,
    "fields": [{ "label": "Area Path", "value": "Web\\Board" }],
    "parent": { "key": "PROJ-1000", "title": "...", "url": "https://..." }
  }
}
```

## Responses

Matching the existing endpoints exactly — same codes, same rejection body, same
field-naming.

| Code | When |
|---|---|
| 200 | Held. Body as the other endpoints return |
| 400 | A cap exceeded or a required field missing. Names the offending field and the limit (FR-026) |
| 413 | Body over `MAX_BODY_BYTES`, checked before parsing. Names the ceiling |
| 415 | Not `application/json` |
| 404 | Any other path |

**A ticket carrying an address the board will not open is a 200.** The address is
kept and shown as text; it is simply not offered as openable. Only a length
violation on the address is a 400. See [link-surface.md](link-surface.md) and
[data-model.md](../data-model.md).

Unknown keys are stripped rather than rejected, so an agent reporting a field a
newer contract defines degrades against an older board instead of failing.

## Versioning

`/v1`, and the health endpoint already returns a version, so a client newer than
the board can say so rather than failing obscurely (decision 27). A client that
reports a ticket to a board predating this feature gets a 404 on the path — which
is the same shape as "the board is not running" and **must fail soft in exactly
the same way**: the agent is told to carry on, not to retry.

## Client surface

Extends [002's client surface](../../002-mcp-server-cli/contracts/client-surface.md).

**MCP: one new tool, `cocoapilot_ticket`.** Its input is the `ticket` object and
nothing else — `repo`, `branch` and `sessionId` are filled in by the client, for
the same reason they are absent from the other two tools: three more chances for
a model to get identity wrong mid-task, for no benefit.

Three things the description must say, because they are what an agent gets wrong
and cannot infer from the schema:

1. **Report the ticket once**, when work on it begins or when it changes — not on
   every update. Reports and tickets are separate.
2. **Flatten the tracker's formatting to plain text before sending.** The board
   shows text and will not interpret markup, so unflattened markup arrives as
   visible characters.
3. **Send the ticket's real address; never build one.** And if you leave comments
   out, say how many in `commentsOmitted`.

**CLI: no new command.** There is no hook or script that reports a ticket, and a
subcommand with no caller is surface for its own sake.

**Failure is soft**, as everywhere else: no board running means the agent is told
"continue working, no need to retry" and nothing is an error. A 400 *is* an error,
because that is the caller's own malformed call and a corrected retry is the right
response.
