# Implementation Plan: MCP Server and CLI

**Branch**: `002-mcp-server-cli` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-mcp-server-cli/spec.md`

## Summary

Two thin clients over feature 001's contract, published as one package fetched
on demand. An MCP server the AI tool spawns per session, and a CLI for hooks and
scripts. Neither holds state; both derive session identity, forward composed
content, and translate failure into a message that tells an agent to carry on.

Approach: one package, two entry points, sharing a discovery-and-post module and
importing `packages/contract` so the payload cannot drift from the service's.

## Technical Context

Inherits the shared foundation in
[001/research.md](../001-push-contract-service/research.md). Feature-specific:

**Primary Dependencies**: `@modelcontextprotocol/sdk` for the MCP server;
`packages/contract` for schemas and caps; nothing else. No CLI framework — two
subcommands do not warrant one.

**Distribution**: Published to npm, fetched by `npx`. This is why it is a
separate package (decision 27) and why its dependency tree must stay small — it
is downloaded on first use in every session.

**Constraints**: Must start with no board running; must never block; every call
bounded at 2 seconds including full discovery failure.

**Base port**: `41847`, with the fallback range `41847–41851`. Left open by
001's research and decided here. In the IANA dynamic range, not a documented
default for anything common, and memorable enough to grep for.

## Constitution Check

*GATE: passed before Phase 0, re-checked after Phase 1.*

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Five prioritised stories, no clarification markers |
| II. Validated trust boundaries | **Pass** | Clients validate before sending *and* the service revalidates — a client is not a trust boundary |
| III. Match existing conventions | **Pass** | Follows 001's conventions; imports its contract rather than restating it |
| IV. Scope discipline | **Pass** | No buffering, no retry, no auto-spawn, no prompt engineering — each named and excluded |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md); the board-absent path is tested, not assumed |
| VI. Narrate the reasoning | **Pass** | Rationale and cost recorded throughout |
| VII. Plan whole set first | **Pass** | Plan 2 of 9; nothing implemented yet |
| VIII. Test at the right level | **Pass** | Unit for discovery and identity; integration against a real service; a stub-server test for the misidentification case |
| IX. Atomic commits, branch | **Deferred** | As 001 — planning on `main`, branch at implementation |

**No violations.**

## Project Structure

```text
packages/clients/
├── package.json           # bin: cocoapilot-mcp, cocoapilot
├── src/
│   ├── discover.ts        # Probe 41847–41851; accept only app === "cocoapilot"
│   ├── transport.ts       # POST; bounded timeout; soft failure
│   ├── identity.ts        # repo via git toplevel, branch, sessionId
│   ├── messages.ts        # The board-absent text, in one place
│   ├── mcp/
│   │   ├── server.ts      # Starts unconditionally; connects per call
│   │   └── tools.ts       # cocoapilot_report, cocoapilot_note
│   └── cli/
│       └── index.ts       # report, note
└── tests/
    ├── unit/
    │   ├── discover.test.ts
    │   ├── identity.test.ts
    │   └── messages.test.ts
    └── integration/
        ├── against-service.test.ts   # real 001 service
        ├── no-board.test.ts          # nothing listening
        └── wrong-responder.test.ts   # a 200 that is not us
```

**Structure Decision**: One package, two binaries. They share discovery,
transport and identity entirely — splitting them would duplicate the three
things that must behave identically, for the sake of a boundary nothing needs.

## Design notes

**The MCP server starts unconditionally and connects per call.** This is the
single most important behaviour in the feature and the easiest to get wrong.
The AI tool discovers a server's tool list once, at session start; a server that
exits or errors during startup because nothing is listening leaves an agent with
no reporting ability for that entire session, including after the board opens.
So: register tools from a static definition, never touch the network during
initialisation, and treat every tool call as an independent attempt.

**Discovery runs per call, with no caching.** A cached port is stale the moment
the board restarts on a different one. Five local connection attempts resolve in
single-digit milliseconds, so the cache would buy nothing and cost correctness.

**Failure is soft, and the wording is a shared constant.** The board-absent
message lives in `messages.ts` because it is a behavioural requirement, not
copy — an agent reading "continue working, no need to retry" behaves
differently from one reading "ECONNREFUSED". Testing it means asserting on a
constant, not a string literal scattered across call sites.

**Only the wrong-responder test proves the identity check.** A test against a
real service passes whether or not the client checks `app`. The stub server
returning `200 {}` is the one that fails if someone simplifies discovery to "did
it answer".

**Session identity**: MCP derives it once per process, matching one agent
session. The CLI uses the literal `unattributed`, which the service maps to a
per-repository shared session (001 FR-004) — so repeated hook invocations group
rather than creating a session each.

**Tool descriptions carry two facts an agent cannot infer** (FR-019): that
`needs-you` is the only way to request a human, and that notes are not durable
storage. Both follow from decisions elsewhere, and an agent ignorant of them
behaves wrongly no matter how correct the code is.

## Post-design Constitution re-check

Still passing. Principle IV is worth restating: the temptations here are all
additive — buffer the undelivered report, retry with backoff, spawn the board if
absent, cache the port. Every one is excluded deliberately, and each exclusion
is a named requirement rather than an omission, so adding one later fails a
test.
