# Quickstart: MCP Server and CLI

**Feature**: [002-mcp-server-cli](spec.md) | **Date**: 2026-08-06

## Prerequisites

- Feature 001 implemented — these clients need a service to talk to
- Node 22 LTS, `npm install` at the repository root

## Run the checks

```bash
npm test --workspace=packages/clients
npm run typecheck
```

## Validation scenarios

### 1. An agent reports without supplying identity (US1)

With a service running, call `cocopilot_report` with `task` and `note` only.

- The service holds a session for the correct repository and branch.
- Neither was passed by the caller.
- A second call updates the same session rather than creating another.

### 2. Tools exist with no board running (US2) — **the one that matters most**

Start an MCP session with **nothing listening**.

- The tool list includes both tools.
- Calling one returns the board-absent message.
- Now start the service. Call again **without restarting the session** — it is
  delivered.

If the client connects during initialisation, this scenario fails and the
failure is invisible in every other test. Run it first.

### 3. Failure is soft and bounded (US3)

With nothing listening:

| Check | Expect |
|---|---|
| Return value | The board-absent constant, verbatim |
| Duration | Under 2 seconds |
| Side effects | Nothing queued, nothing retried, no process launched |

Then start a stub server on 41847 returning `200 {}`:

- The client transmits **nothing** to it.
- It continues to the next port in the range.

This is the test that proves discovery checks identity rather than liveness.

### 4. A hook reports (US4)

Run `cocopilot note "test"` from a shell inside a repository.

- A session appears, marked unattributed.
- Ten more invocations join the *same* session — not eleven sessions.
- With no board running, exit code is **0** and no error is printed that would
  fail a calling hook.

### 5. Rejections survive the trip (US4, FR-013)

Send a note of 4,001 characters.

- The service rejects it naming the field.
- That reason reaches the caller intact — not flattened to "request failed".

### 6. Configuration is path-free (US5)

Inspect the documented configuration entry.

- It contains no filesystem path to the desktop application.
- The same text works on Windows, macOS and Linux.
- It works on a machine where the application was never installed — the tools
  are present and fail soft, rather than being absent.

## Expected outcome

All scenarios pass, and scenario 2 passes **before** any other work is
considered done — it is the behaviour with the least visible failure mode and
the largest consequence.

## Not validated here

- Anything visible on the board — features 003 onward.
- Whether an agent chooses to report often. Out of scope by design; that lives
  in tool descriptions and project instructions.
