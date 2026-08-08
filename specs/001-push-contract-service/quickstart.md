# Quickstart: Push Contract and Local Service

**Feature**: [001-push-contract-service](spec.md) | **Date**: 2026-08-06

How to prove this feature works. It has no visible surface — the window is
feature 003 — so validation is by exercising the contract and observing the
store, exactly as the spec's testable-not-observable framing intends.

## Prerequisites

- Node 22 LTS
- `npm install` at the repository root (npm workspaces)

## Run the checks

```bash
npm test                      # Vitest — unit and integration
npm run test:unit             # schemas, caps, store semantics
npm run test:integration      # real http server on an ephemeral port
npm run typecheck             # tsc --noEmit across all workspaces
```

Integration tests bind an **ephemeral** port, never the real range, so they
cannot collide with a board running on the same machine.

## Validation scenarios

Each maps to a user story. Run against a service started on a test port.

### 1. A report is held (US1)

Send a complete report, then read the store.

- The session exists, keyed by repo and session identity.
- Its content equals what was sent.
- `receivedAt` is the service's clock, **not** any value in the request.
- Sending a second report for a *different* repo leaves the first untouched.

### 2. A newer report replaces the older (US2)

Send a report with five tasks, then one with three.

- The held report has exactly three tasks. Nothing survives from the first.
- Sending the identical report twice leaves the store as it was after once.

**The check that matters**: no field from the first report is still reachable.
A merge bug is invisible when the second report is a superset, so the second
must be a strict *subset*.

### 3. A bad report changes nothing (US3)

With a good report held, send in turn:

| Sent | Expect |
|---|---|
| A note of 4,001 characters | 400, `field` names the note, held state unchanged |
| 501 tasks | 400, `field` names `tasks` |
| `repo` that does not exist | 400, `field` names `repo` |
| An unknown top-level key | **200**, key stripped, rest applied |
| A client-supplied `receivedAt` | 200, value ignored, service clock used |
| Text containing `<script>` | 200, stored verbatim, returned verbatim |

After every rejection, re-read the store and confirm it is byte-identical to
before (SC-003).

### 4. The service identifies itself (US4)

- `GET /v1/health` returns `app: "cocoapilot"` with a version.
- A stub server returning `200 {}` on the same port is **not** accepted by
  client discovery logic (SC-008).

### 5. Notes append (US5)

Add three notes, then send a new report.

- All three notes are present, in order.
- The new report replaced the reported state but **left the notes alone**.
- A note to a session that does not exist creates it with `report: null`.

### 6. Nothing is written; the repository is never read (SC-004, SC-005)

The two guarantees the whole product rests on, so they get a dedicated test
rather than an assertion in prose.

With `node:fs` spied at module level, run a full exercise of the contract:

- **Zero** calls to any write API — no `writeFile`, `mkdir`, `rm`, `appendFile`,
  `rename`, anywhere, for any request.
- **Zero** read calls against any path *inside* the reported repository. The
  path itself is `stat`-ed, which is expected and is the only permitted touch.

### 7. Nothing survives a restart (SC-009)

Populate several sessions with reports and notes, stop the service, start it
again.

- It holds zero sessions.
- No file was created anywhere to make that true — emptiness is the default,
  not something cleaned up.

## Expected outcome

All of the above pass, `npm run typecheck` is clean, and the contract package
exports the schemas that features 002 onward will import rather than restate.

## Not validated here

- Anything visible. Features 003 onward.
- Client discovery and fail-soft behaviour — feature 002, though scenario 4
  provides the server half it tests against.
- The concrete base port. Decided in feature 002's plan; tests here use an
  ephemeral port and do not depend on it.
