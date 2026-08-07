# Tasks: MCP Server and CLI

**Input**: Design documents from `specs/002-mcp-server-cli/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md),
[contracts/client-surface.md](contracts/client-surface.md),
[quickstart.md](quickstart.md). Feature 001 is merged — `packages/contract`
exports the schemas, caps, `PORT_RANGE`, `HOST` and `isCoCoaPilotHealth`, and
`apps/board` exports `createService()` for integration tests to run a real
service against.

**Tests**: Included. Two behaviours here have failure modes that are invisible
everywhere else — the MCP server touching the network during initialisation, and
discovery degrading to "did something answer" — and neither is caught by any
test that only exercises the happy path.

**Organization**: Grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependency on an incomplete task
- **[Story]**: `[US1]`…`[US5]`
- Every task names its exact file path

## Two contradictions in the design, resolved here

Both surfaced on reading the artefacts together, and both change what gets
built. Stated up front rather than buried in a task.

**1. Identity comes from the filesystem, not from running `git`.**
[client-surface.md](contracts/client-surface.md) says to derive `repo` from
`git rev-parse --show-toplevel`. But FR-011 says the clients "MUST NOT launch
the desktop application **or any other process**", and US3's third acceptance
scenario says "nothing is launched — no window opens and no process starts". A
`git` subprocess on every single call is squarely inside the literal
requirement, and FR-018 explicitly permits *determining the path and current
branch* — it just does not say how.

So identity walks up from the working directory for `.git` and reads `HEAD`
directly. It satisfies FR-011 as written, costs no process spawn on a path that
SC-003 bounds at two seconds, and does not require `git` on `PATH` — which the
MCP server, launched by a host rather than a shell, cannot assume.
`client-surface.md` gets corrected to match.

**2. `@cocoapilot/contract` has to be publishable.** It is currently
`"private": true`, which makes it unresolvable for anyone who installs the
published client from npm. Bundling it into the client build was the
alternative; publishing two packages released together is less machinery and
makes drift between them impossible. The actual publish is feature 009's job —
this feature only has to stop the package from being unpublishable.

## Path conventions

```text
packages/clients/          # Published as @cocoapilot/mcp (decision 27)
├── package.json           # bin: cocoapilot-mcp, cocoapilot
├── src/
│   ├── messages.ts        # The board-absent text, in one place
│   ├── identity.ts        # repo, branch, sessionId — all derived
│   ├── discover.ts        # Probe the range; accept only app === "cocoapilot"
│   ├── transport.ts       # One bounded call budget; soft failure
│   ├── client.ts          # report() and note(), the shared surface
│   ├── mcp/{server,tools}.ts
│   └── cli/index.ts
└── tests/{unit,integration}/
```

`apps/board` is a **devDependency only**, used by integration tests to run a
real service. It must never appear in the published dependency tree — the point
of decision 27 is that the spawnable piece is plain JavaScript with nothing of
the desktop application behind it.

---

## Phase 1: Setup

- [x] T001 Create `packages/clients/package.json` — name `@cocoapilot/mcp` (decision 27's `npx -y @cocoapilot/mcp`), `bin` entries `cocoapilot-mcp` → `dist/mcp/server.js` and `cocoapilot` → `dist/cli/index.js`, dependency on `@cocoapilot/contract` and `@modelcontextprotocol/sdk`, devDependency on `@cocoapilot/board`, `files: ["dist"]`
- [x] T002 [P] Create `packages/clients/tsconfig.json` (src + tests, path mapping for `@cocoapilot/contract` and `@cocoapilot/board`) and `packages/clients/tsconfig.build.json` (emit `dist` from `src` only)
- [x] T003 [P] Drop `"private": true` from `packages/contract/package.json` — a published client cannot depend on an unpublishable package
- [x] T004 Add a `@cocoapilot/board` alias to the root `vitest.config.ts` pointing at `apps/board/src/main/index.ts`, and extend the `unit`/`integration` include globs to reach `packages/clients/tests`
- [x] T005 Run `npm install` at the root and confirm `npm run typecheck` and `npm test` are still clean

---

## Phase 2: Foundational (blocking prerequisites)

**⚠️ CRITICAL**: No user story can begin until this phase completes.

- [x] T006 [P] Create `packages/clients/src/messages.ts` — `BOARD_ABSENT` exactly as `client-surface.md` words it, plus the not-a-repository and version-mismatch messages. Its wording is a behavioural requirement, not copy: an agent reading "continue working, no need to retry" behaves differently from one reading `ECONNREFUSED`
- [x] T007 Create `packages/clients/src/identity.ts` — walk up from a starting directory for `.git` (resolving the `gitdir:` form used by worktrees), read `HEAD` for the branch, fall back to the raw SHA when detached; derive a `sessionId` stable for the process lifetime; return a discriminated result so "not inside a repository" is a value rather than a throw
- [x] T008 Create `packages/clients/src/discover.ts` — probe an ordered port list, `GET /v1/health` on each, accept the first whose body satisfies `isCoCoaPilotHealth`, transmit nothing to anything else, conclude absence when the list is exhausted. Takes the port list and a deadline as parameters so tests do not fight a real board
- [x] T009 Create `packages/clients/src/transport.ts` — one overall call budget for discovery plus delivery, so SC-003's two-second bound holds even when every port black-holes rather than refusing; no caching between calls, no retry, no queue
- [x] T010 Create `packages/clients/src/client.ts` — `report()` and `note()` returning a discriminated result (`delivered` | `no-board` | `rejected` | `not-a-repo` | `version-mismatch`), which is the one surface both binaries wrap
- [x] T011 Create `packages/clients/tests/helpers/harness.ts` — start a real 001 service on a chosen port, start a stub server that answers `200 {}`, and expose the port list to hand to discovery

**Checkpoint**: Both binaries can be built on top of one shared, tested core.

---

## Phase 3: User Story 2 — The tools exist even when the board was closed at startup (Priority: P1) 🎯 MVP

**Taken first, ahead of US1**, though both are P1. [quickstart.md](quickstart.md)
is explicit: "If the client connects during initialisation, this scenario fails
and the failure is invisible in every other test. Run it first." A server that
only works when the board happened to be open first is unreliable in the
ordinary case, because most people start working before they open a dashboard.

**Goal**: The reporting tools are present in an agent's toolset regardless of
whether anything is listening, and start working the moment a board appears.

**Independent Test**: Start an MCP session with nothing listening, confirm both
tools are listed, then start a service and call a tool **without restarting**.

**Covers**: FR-005, FR-006, SC-001, SC-002

### Tests for User Story 2

- [x] T012 [P] [US2] Write `packages/clients/tests/integration/no-board-startup.test.ts` — construct the MCP server with nothing listening anywhere in the range and assert it initialises and lists both tools; assert no network call was made during initialisation
- [x] T013 [P] [US2] Write `packages/clients/tests/integration/late-board.test.ts` — with the same server instance, call a tool (board-absent), then start a service, then call again and assert delivery, with no restart in between
- [x] T014 [P] [US2] Write `packages/clients/tests/unit/discover.test.ts` — finds a board on the first port, on the last port, and reports absence when none answers; a board that has moved between calls is found without intervention

### Implementation for User Story 2

- [x] T015 [US2] Create `packages/clients/src/mcp/tools.ts` — `cocoapilot_report` and `cocoapilot_note` as static definitions with zod input schemas built from `packages/contract`; `repo`, `branch` and `sessionId` are deliberately **not** parameters
- [x] T016 [US2] Create `packages/clients/src/mcp/server.ts` — register tools from T015 and connect stdio, touching the network nowhere in this file; every tool call is an independent attempt
- [x] T017 [US2] Add `#!/usr/bin/env node` to `packages/clients/src/mcp/server.ts` and a `build` script to `packages/clients/package.json`, and confirm `dist/mcp/server.js` runs

**Checkpoint**: The behaviour with the least visible failure mode is proven.

---

## Phase 4: User Story 1 — An agent reports without leaving its workflow (Priority: P1)

**Goal**: An agent supplies only what it composed; everything identifying the
session is filled in for it.

**Independent Test**: With a board running, call the reporting tool with content
only, then confirm the board holds a session naming the correct repository and
branch that the agent never supplied.

**Covers**: FR-001, FR-002, FR-003, FR-004, FR-019

### Tests for User Story 1

- [x] T018 [P] [US1] Write `packages/clients/tests/unit/identity.test.ts` — resolves the repository root by walking up; reads the branch from `HEAD`; handles a detached HEAD and the `gitdir:` worktree form; returns not-a-repository rather than throwing; the session id is stable across calls in one process
- [x] T019 [P] [US1] Write `packages/clients/tests/integration/against-service.test.ts` — a report carrying only `task`, `note` and `chip` reaches a real service with repo and branch filled in; a second call updates the same session rather than creating another; a note is appended; two client instances in one repository produce two sessions
- [x] T020 [P] [US1] Write `packages/clients/tests/unit/tools.test.ts` — the tool schemas expose no `repo`, `branch` or `sessionId`, and both descriptions state the two facts an agent cannot infer: that `needs-you` is the only way to ask for a human, and that notes are cleared when the window closes (FR-019)

### Implementation for User Story 1

- [x] T021 [US1] Wire the `cocoapilot_report` handler in `packages/clients/src/mcp/tools.ts` to `client.report()`, merging derived identity with model-composed content
- [x] T022 [US1] Wire the `cocoapilot_note` handler in `packages/clients/src/mcp/tools.ts` to `client.note()`
- [x] T023 [US1] Return a confirmation the agent does not have to act on, and never content that invites a follow-up call

**Checkpoint**: The path essentially every report takes works end to end.

---

## Phase 5: User Story 3 — A failed report never derails the work (Priority: P2)

**Goal**: An absent board costs the agent nothing — not a retry, not a turn, not
an investigation into a failure that is not its problem.

**Independent Test**: With nothing listening, report and confirm the response
states the board is absent and directs the caller to continue.

**Covers**: FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, SC-003, SC-004, SC-005

### Tests for User Story 3

- [x] T024 [P] [US3] Write `packages/clients/tests/unit/messages.test.ts` — `BOARD_ABSENT` says all three things it has to: the board is absent, this is not a failure of your work, and retrying will not help
- [x] T025 [P] [US3] Write `packages/clients/tests/integration/no-board.test.ts` — the return value is the `BOARD_ABSENT` constant verbatim; the call completes well under two seconds; nothing is queued and no second attempt is made
- [x] T026 [P] [US3] Write `packages/clients/tests/integration/wrong-responder.test.ts` — a stub answering `200 {}` on the first port receives **zero** POSTs, and discovery continues to the next port. This is the only test that fails if someone simplifies discovery to "did it answer"
- [x] T027 [P] [US3] Write `packages/clients/tests/integration/rejection.test.ts` — a note of 4,001 characters is rejected by the service and the reason reaches the caller intact, naming the field, rather than flattened into "request failed" (FR-013, SC-008)

### Implementation for User Story 3

- [x] T028 [US3] Enforce the overall call budget in `packages/clients/src/transport.ts` so a black-holed port cannot blow SC-003's bound, and assert it with a deliberately unresponsive listener
- [x] T029 [US3] Map every failure to a soft result in `packages/clients/src/client.ts` — no throw reaches a tool handler, and no failure path launches, queues or retries anything

**Checkpoint**: The product is safe to leave installed.

---

## Phase 6: User Story 4 — A hook or script reports without an agent (Priority: P3)

**Goal**: Mechanical events reach the board from a shell, without failing the
hook that ran them.

**Independent Test**: Run the command inside a repository with a board running,
and confirm a session appears attributed as a script rather than as an agent.

**Covers**: FR-014, FR-015, SC-006

### Tests for User Story 4

- [x] T030 [P] [US4] Write `packages/clients/tests/integration/cli.test.ts` — `report` and `note` reach a real service with repo and branch filled in from the working directory; the session is the unattributed one; eleven invocations produce exactly one session, not eleven (SC-006)
- [x] T031 [P] [US4] Write `packages/clients/tests/unit/cli-args.test.ts` — argument parsing for both subcommands, and that unknown flags and a missing note argument are usage errors
- [x] T032 [P] [US4] Write `packages/clients/tests/integration/cli-exit-codes.test.ts` — 0 when delivered, **0 when no board is running**, 1 for invalid usage or outside a repository, 2 for a service rejection with the reason on stderr

### Implementation for User Story 4

- [x] T033 [US4] Create `packages/clients/src/cli/index.ts` — `report [--task ID] [--note TEXT] [--chip STATE]` and `note TEXT [--source TEXT]` using `node:util`'s `parseArgs`; no CLI framework, because two subcommands do not warrant one
- [x] T034 [US4] Send the literal `unattributed` session id from the CLI, which the service maps to one shared session per repository — so a hook firing per tool call groups rather than filling the switcher with one-shot entries
- [x] T035 [US4] Exit 0 when the board is absent, deliberately, and print the absence to stdout rather than stderr — a hook that failed because a dashboard was closed would be a monitoring tool breaking the work it monitors

**Checkpoint**: The contract has a second consumer, which is what keeps it honest.

---

## Phase 7: User Story 5 — Installation needs no path or platform knowledge (Priority: P4)

**Goal**: The documented configuration entry works unchanged on all three
platforms, on a machine where the desktop application was never installed.

**Independent Test**: Inspect the documented entry for any filesystem path to the
application; confirm the tools appear and fail soft on a machine with no board.

**Covers**: FR-016, FR-017, SC-007

### Tests for User Story 5

- [x] T036 [P] [US5] Write `packages/clients/tests/unit/version.test.ts` — a board reporting a different contract version yields the version-mismatch message naming both versions, rather than an obscure failure; a matching version proceeds
- [x] T037 [P] [US5] Write `packages/clients/tests/unit/packaging.test.ts` — `packages/clients/package.json` declares both bins, ships only `dist`, carries no dependency on `@cocoapilot/board` outside `devDependencies`, and the documented configuration entry in the README contains no filesystem path

### Implementation for User Story 5

- [x] T038 [US5] Surface a contract-version mismatch in `packages/clients/src/discover.ts` as a distinct result rather than treating the board as absent — decision 27 accepts that a published client can drift from the installed app, and drift is only worth accepting if it is detectable
- [x] T039 [US5] Write `packages/clients/README.md` with the `.mcp.json` entry (`npx -y @cocoapilot/mcp`), the CLI usage, the exit-code table, and an explicit note that no path to the desktop application is involved

---

## Phase 8: Polish & cross-cutting concerns

- [x] T040 [P] Write `packages/clients/tests/integration/no-writes.test.ts` — across a full exercise of both clients, zero filesystem writes anywhere and zero reads inside the reported repository other than the `.git` metadata identity needs (SC-009). Mirrors feature 001's absence test, and is checked for teeth the same way
- [x] T041 [P] Correct `specs/002-mcp-server-cli/contracts/client-surface.md` — identity comes from the filesystem, not from `git rev-parse`, for the reason stated at the top of this file
- [x] T042 Run `npm run typecheck`, the full suite, and `npm run build`, then walk all six scenarios in [quickstart.md](quickstart.md) by hand — scenario 2 first
- [x] T043 [P] Update `CHANGELOG.md` and `STATUS.md` for feature 002, recording the two contradictions and how they were resolved
- [x] T044 Exercise the built binaries end to end against a real board on the real port range, outside the test harness
- [x] T045 Read back the full diff, then merge the feature branch

---

## Dependencies & execution order

- **Setup (Phase 1)** — no dependencies
- **Foundational (Phase 2)** — needs Setup. Blocks every story
- **US2 (Phase 3)** — needs Foundational. Deliberately first
- **US1 (Phase 4)** — needs US2's tool definitions to exist before handlers can be wired to them
- **US3 (Phase 5)** — needs Foundational; the rejection test also needs US1's handlers
- **US4 (Phase 6)** — needs Foundational only. Genuinely parallel with US1–US3: the CLI touches no file the MCP server touches
- **US5 (Phase 7)** — needs US2 and US4 to exist before packaging can assert on their bins
- **Polish (Phase 8)** — needs all five

### Parallel opportunities

- T002, T003 in Setup
- T006 alone in Foundational; T007–T010 form a chain (`client` needs `transport` needs `discover` needs nothing but `messages`)
- Every test task inside a story phase
- **US4 in its entirety** alongside US1–US3

**Serialisation to watch**: `packages/clients/src/mcp/tools.ts` is touched by
T015, T021 and T022, and `packages/clients/src/client.ts` by T010 and T029.

---

## Implementation strategy

### MVP

Setup → Foundational → **US2**. At that point the tools exist unconditionally
and fail soft, which is the property the whole feature is built to protect. US1
then makes them actually deliver.

### What is deliberately not here

- Buffering, queueing, retrying, or caching the discovered port. Every one is an
  additive temptation and every one is excluded by a named requirement, so
  adding it later fails a test rather than passing review
- Launching the board when it is absent
- Publishing to npm — feature 009. This feature only has to make it possible
- Prompting agents to report well. Out of scope by design; that lives in tool
  descriptions and project instructions

---

## Notes

- Commit after each task or coherent group; every commit builds and passes tests
- The two tests worth protecting are T012 (no network at initialisation) and
  T026 (a 200 is not identification). Both guard behaviour that looks fine in
  every other test right up until it matters
