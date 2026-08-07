# Contract: Local HTTP API

**Feature**: [001-push-contract-service](../spec.md) | **Version**: `v1`

The one interface every surface wraps. Bound to `127.0.0.1` only — no auth, no
TLS (decision 18). Shapes are defined in
[data-model.md](../data-model.md); this document defines the wire behaviour.

The narrative rationale lives in
[docs/design/push-schema.md](../../../docs/design/push-schema.md).

---

## `GET /v1/health`

Identifies the application so a probing client cannot mistake unrelated
software for the board (FR-007).

**200**
```json
{ "app": "cocoapilot", "version": "0.1.0", "contract": "v1" }
```

Clients **must** match on `app === "cocoapilot"`. A 200 alone means only that
something answered. This is the whole point of the endpoint.

---

## `POST /v1/push`

A full snapshot, replacing whatever was held for this session (FR-001).

**Request**
```json
{
  "repo": "D:\\Codelib\\example",
  "branch": "feat/session-hook",
  "sessionId": "a1b2c3",

  "feature": { "id": "002", "title": "Share one session fetch", "specPath": "specs/002/spec.md" },
  "stories": [ { "id": "US-002", "title": "…", "criteria": ["…"], "taskIds": ["T012"] } ],
  "tasks":   [ { "id": "T012", "storyId": "US-002", "title": "…", "status": "waiting on CI", "checks": [], "files": [] } ],
  "plan":    [ { "text": "Read the call sites", "status": "done" } ],
  "focus":   { "task": "T012", "note": "blocked — the harness never sets the cookie", "chip": "needs-you" },
  "changedFiles": [ { "path": "src/api/client.ts", "change": "modified", "added": 21, "removed": 18 } ]
}
```

Every field below the envelope is optional. `sessionId` omitted → the
unattributed session for that repository (FR-004).

**200** — accepted.
```json
{ "ok": true, "receivedAt": 1786000000000 }
```

**400** — rejected. Held state is untouched (FR-010).
```json
{
  "ok": false,
  "error": "invalid_field",
  "field": "tasks[3].title",
  "message": "exceeds maximum length of 200 characters"
}
```

`field` is required on every rejection (FR-009) — a caller must be able to
correct the request from the response alone (SC-007).

**409** — the session cap is reached and this would create a new session.
```json
{ "ok": false, "error": "session_limit", "message": "100 sessions held; dismiss one to make room" }
```

**413** — the body exceeds `MAX_BODY_BYTES` (1 MiB), checked before parsing.
```json
{ "ok": false, "error": "payload_too_large", "field": "(body)", "message": "request body exceeds 1048576 bytes" }
```

The per-field and per-collection caps do not bound a request on their own: 500
tasks each carrying 50 checks of 4,000 characters is legal by every individual
cap and still around 127 MB. This ceiling is what makes the spec's "a report
cannot be enormous while every field is legal" actually true. Added during
implementation of feature 001.

**415** — the request did not declare `content-type: application/json`.
```json
{ "ok": false, "error": "unsupported_media_type", "field": "(headers)", "message": "content-type must be application/json" }
```

Requiring the content type is what forces a browser to send a CORS preflight
before it can reach this service cross-origin, and nothing here answers a
preflight. Decision 18 accepts that any *local process* may report; it does not
accept that any page the user happens to have open may. Also added during
implementation.

---

## `POST /v1/note`

Appends. Does not replace anything (FR-005).

**Request**
```json
{
  "repo": "D:\\Codelib\\example",
  "branch": "feat/session-hook",
  "sessionId": "a1b2c3",
  "text": "The auth middleware expects a cookie the test harness never sets.",
  "source": "you asked"
}
```

**200** — appended. **400** — rejected, same shape as above. **409** — note cap
reached for this session.

Creates the session if it does not exist (FR-006), with `report: null`.

---

## Reading state

Held state is read by the renderer **in-process**, not over HTTP (decision 28).
The store exposes a read interface and an event; the window subscribes through
the preload bridge. FR-020 is satisfied without a network hop.

No HTTP read endpoint exists. Adding one later would mean deciding who may
read agent prompt text over a socket, which nothing currently requires.

---

## Behaviour required of every endpoint

| Rule | Requirement |
|---|---|
| Validate before mutating | FR-009, FR-010 — no partially-applied requests |
| Strip unknown keys | FR-013 — a newer client degrades, it does not fail |
| Ignore client timestamps | FR-003 — stripped as unknown, not rejected |
| Stat the repo path only | FR-012 — never opened, never traversed |
| Store text verbatim | FR-014 — escaping happens at render |
| Reject, never truncate | FR-011 |
| Localhost only | Decision 18 — bind address, not a header check |
| Require a JSON content type | Not reachable from a browser page without a preflight |
| Cap the body before parsing | The field caps alone do not bound a request |

---

## What this contract deliberately lacks

- **No authentication.** Any local process may report. Accepted: nothing is
  written and nothing is executed, so the blast radius is misleading text.
- **No delete or edit of individual items.** Reports replace wholesale; there
  is no partial-update path to keep consistent.
- **No subscription over HTTP.** In-process only.
- **No enum on `status`.** Free text by decision 25. Only `chip` is closed, and
  only because it is how an agent asks for a human.
