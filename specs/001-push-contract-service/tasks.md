# Tasks: Push Contract and Local Service

**Input**: Design documents from `specs/001-push-contract-service/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/http-api.md](contracts/http-api.md),
[quickstart.md](quickstart.md)

**Tests**: Included, and not optional here. The spec states its acceptance
criteria as **testable rather than observable** because this feature has no
visible surface, and two of them (SC-004, SC-005) are guarantees that can only
be expressed as an asserted *absence*. Constitution principle VIII puts the test
where the risk lives; for this feature that is the schema and the
replace/append semantics.

**Organization**: Grouped by user story so each is independently implementable
and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: `[US1]`…`[US5]`, mapping to the spec's prioritised user stories
- Every task names its exact file path

## Path conventions

npm-workspaces monorepo per [plan.md](plan.md):

- `packages/contract/` — schemas, caps, version, ports. Internal, imported by everything
- `apps/board/` — the service. **This feature writes only `src/main/` and `tests/`**
- `packages/clients/` — **not touched here.** Feature 002
- `apps/board/src/renderer/`, `src/preload/` — **not touched here.** Feature 003

**No Electron dependency is added in this feature.** The service is plain Node
so the suite runs without an app; feature 003 mounts `createService()` in the
Electron main process.

**Deviation from plan.md's file list, stated per rule 3**: `packages/contract`
gains `errors.ts` (the rejection shape and the zod-issue→field-path mapper, which
FR-009 needs in one place) and `ports.ts` (the range constants, shared with
feature 002's prober). `apps/board/src/main` gains `validate.ts`, which holds the
repo-existence check so that `packages/contract` never imports `node:fs` — that
keeps the published client package pure and makes the SC-004/SC-005 absence tests
easier to reason about.

---

## Phase 1: Setup (repository bootstrap)

**Purpose**: There is no product code in this repository yet. This phase creates
the workspace itself.

- [x] T001 Create root `package.json`: npm workspaces (`packages/*`, `apps/*`), `"type": "module"`, `"private": true`, `engines.node >= 22`, and the scripts `test`, `test:unit`, `test:integration`, `typecheck` named in [quickstart.md](quickstart.md)
- [x] T002 [P] Create `tsconfig.base.json`: `strict`, `ES2022`, `moduleResolution: NodeNext`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `declaration`
- [x] T003 [P] Append `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo` to `.gitignore`
- [x] T004 [P] Create `packages/contract/package.json` (name `cocoapilot-contract`, dependency `zod`) and `packages/contract/tsconfig.json` extending the base
- [x] T005 [P] Create `apps/board/package.json` (name `@cocoapilot/board`, workspace dependency on `cocoapilot-contract`, no Electron yet) and `apps/board/tsconfig.json` extending the base
- [x] T006 Create root `vitest.config.ts` defining a `unit` project and an `integration` project, matching the two script names from T001
- [x] T007 Run `npm install` at the root and confirm `npm run typecheck` is clean across the empty workspaces

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The contract package and the two objects every story needs — the
store and the HTTP server. Nothing story-specific lives here.

**⚠️ CRITICAL**: No user story can begin until this phase completes.

- [x] T008 [P] Create `packages/contract/src/caps.ts` — every length and item cap from [data-model.md](data-model.md) as named exported constants (4,000 text; 200 title/status; 500 path; 500 tasks; 200 stories; 100 plan steps; 200 changed files; 50 criteria/checks; 100 files; 1,000 notes; 100 sessions), defined once so service and clients cannot disagree
- [x] T009 [P] Create `packages/contract/src/version.ts` — `APP_NAME = "cocoapilot"`, `APP_VERSION`, `CONTRACT_VERSION = "v1"`, the `HealthPayload` schema, and `isCoCoapilotHealth()` which matches on `app === "cocoapilot"` and **not** on a 200 alone
- [x] T010 [P] Create `packages/contract/src/ports.ts` — `PORT_BASE = 41847`, `PORT_COUNT = 5`, `PORT_RANGE` (41847–41851), fixed by feature 002's plan and shared so the server and the prober walk one list in one order
- [x] T011 Create `packages/contract/src/schema.ts` — `Envelope`, `Feature`, `Story`, `Task`, `PlanStep`, `Focus`, `ChangedFile`, `PushRequest`, `NoteRequest`; caps applied from T008; objects strip unknown keys (FR-013); `status` typed `string` with no enum (decision 25, FR-018); `chip` the one closed enum, defaulting to `thinking` (depends on T008)
- [x] T012 Create `packages/contract/src/errors.ts` — the rejection body `{ ok: false, error, field, message }` and a mapper turning a zod issue into a dotted/indexed field path such as `tasks[3].title` (FR-009, SC-007) (depends on T011)
- [x] T013 Create `packages/contract/src/index.ts` re-exporting caps, version, ports, schema and errors, plus the inferred types (depends on T008–T012)
- [x] T014 Create `apps/board/src/main/store.ts` — `Map<SessionKey, Session>` with `SessionKey = repoPath + "\0" + sessionId`, an `EventEmitter`, and `putReport` / `appendNote` / `getSession` / `listSessions` / `dismiss`; `declaredAt` set once and never updated (feature 008 must not reorder), `lastHeardAt` updated by reports **and** notes (depends on T013)
- [x] T015 Create `apps/board/src/main/server.ts` — `node:http`, bound to `127.0.0.1` only (decision 18, a bind address not a header check), a method+path route table, a JSON body reader with a byte ceiling, and JSON `404`/`405` for anything unrouted (depends on T013, T014)
- [x] T016 Create `apps/board/src/main/index.ts` exporting `createService({ port? })` returning `{ port, store, close() }` — the single surface feature 003 mounts in the Electron main process (depends on T015)
- [x] T017 Create `apps/board/tests/helpers/service.ts` — start a service on an **ephemeral** port (`0`), return its base URL and a close function, so tests never collide with a board running on the developer's machine (depends on T016)

**Checkpoint**: Contract and infrastructure exist. User stories can begin.

---

## Phase 3: User Story 1 — An agent reports what it is doing, and the report is held (Priority: P1) 🎯 MVP

**Goal**: A complete report arrives, is stamped with the service's own clock,
and is held as that session's current state, readable by whatever renders it.

**Independent Test**: Send one report to a running service, read the held state
back, and confirm it matches what was sent with a service-generated arrival time.

**Covers**: FR-001, FR-002, FR-003, FR-004, FR-006, FR-020, SC-001

### Tests for User Story 1

> Write these first and confirm they fail before implementing.

- [x] T018 [P] [US1] Write `packages/contract/tests/schema.test.ts` — a complete valid report parses; every optional field below the envelope may be absent; `chip` defaults to `thinking`; `status` accepts arbitrary text such as `waiting on CI`
- [x] T019 [P] [US1] Write `apps/board/tests/unit/store.test.ts` — first report creates the session; the same `sessionId` under a different `repoPath` is a different session; `declaredAt` survives a second report while `lastHeardAt` moves; a missing `sessionId` yields `sessionId: "unattributed"` with `attributed: false` (FR-004)
- [x] T020 [P] [US1] Write `apps/board/tests/integration/push.test.ts` — `POST /v1/push` returns `200 { ok: true, receivedAt }`; two repos are held independently; a client-supplied `receivedAt` never appears in held state (FR-003)

### Implementation for User Story 1

- [x] T021 [US1] Create `apps/board/src/main/routes/push.ts` — parse the body, validate against `PushRequest`, stamp `receivedAt` from the service clock, call `store.putReport`, respond `200 { ok: true, receivedAt }`
- [x] T022 [US1] Register `POST /v1/push` in the route table in `apps/board/src/main/server.ts`
- [x] T023 [US1] Emit a `changes` event from `apps/board/src/main/store.ts` on every accepted mutation — decision 28's in-process notification, with no timer and nothing running while idle
- [x] T024 [US1] Export the read surface (`getSession`, `listSessions`, `subscribe`) from `apps/board/src/main/index.ts`, satisfying FR-020 in-process with no HTTP read endpoint (contracts/http-api.md is explicit that none exists)

**Checkpoint**: A report can be sent and read back. This is the MVP.

---

## Phase 4: User Story 2 — A newer report completely replaces the older one (Priority: P2)

**Goal**: Held state is always exactly one agent's latest word — no merge path
exists anywhere in the code.

**Independent Test**: Send a report, send a differing report for the same
session, and confirm held state equals the second exactly with nothing surviving
from the first.

**Covers**: FR-001 (replace semantics), SC-002

### Tests for User Story 2

- [x] T025 [P] [US2] Write `apps/board/tests/unit/store-replace.test.ts` — five tasks then three yields exactly three; **the second report must be a strict subset** of the first, because a merge bug is invisible when it is a superset (quickstart scenario 2); the identical report sent twice leaves the store as it was after once
- [x] T026 [P] [US2] Write `apps/board/tests/integration/push-replace.test.ts` — the same over HTTP, plus a report for a different `repo` held separately rather than replacing

### Implementation for User Story 2

- [x] T027 [US2] Implement replace-not-merge in `apps/board/src/main/store.ts` — `putReport` assigns a freshly validated `Report` and never spreads over the previous one, with a comment naming decision 26 so a later change cannot reintroduce merging as a convenience

**Checkpoint**: Snapshot-replace is proven. Idempotence follows from it.

---

## Phase 5: User Story 3 — A bad report is refused without damaging good state (Priority: P3)

**Goal**: Every field is treated as untrusted, every rejection names its field,
and held state is byte-identical after any rejection.

**Independent Test**: Hold a valid report, send the quickstart's table of invalid
requests, and confirm each is refused with a reason while the original is
untouched.

**Covers**: FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-018, SC-003, SC-007, SC-010

### Tests for User Story 3

- [x] T028 [P] [US3] Write `packages/contract/tests/caps.test.ts` — every cap from T008 accepts exactly the limit and rejects limit + 1, **rejecting rather than truncating** (FR-011)
- [x] T029 [P] [US3] Write `packages/contract/tests/errors.test.ts` — a nested zod issue maps to `tasks[3].title`; every rejection carries a non-empty `field` (SC-007)
- [x] T030 [P] [US3] Write `apps/board/tests/integration/reject.test.ts` — the whole scenario-3 table from [quickstart.md](quickstart.md): a 4,001-character note → 400 naming the note; 501 tasks → 400 naming `tasks`; a non-existent `repo` → 400 naming `repo`; an unknown top-level key → **200**, key stripped; a client-supplied `receivedAt` → 200, ignored; text containing `<script>` → 200, stored and returned verbatim (FR-014, SC-010). After each rejection re-read the store and assert it is unchanged (SC-003)
- [x] T031 [P] [US3] Write `apps/board/tests/unit/session-cap.test.ts` — a report creating the 101st session is rejected with `409 session_limit`, while the 100 already held keep accepting reports

### Implementation for User Story 3

- [x] T032 [US3] Create `apps/board/src/main/validate.ts` — check the reported `repo` path with `statSync` on **the path itself only**, never `readdir`, never open, never traverse (FR-012), emitting a contract-shaped issue for `repo` so the rejection body is identical to a schema failure
- [x] T033 [US3] Wire validate-before-mutate into `apps/board/src/main/routes/push.ts` — parse, then refine, and only then touch the store; on failure respond `400 { ok: false, error: "invalid_field", field, message }` having touched nothing (FR-009, FR-010, SC-001)
- [x] T034 [US3] Enforce the session cap in `apps/board/src/main/store.ts` — **reject** a new session with `409 session_limit`, never evict, because eviction would be the only place in the product where something disappears without a restart or a dismissal
- [x] T035 [US3] Comment the inert-text rule at the store boundary in `apps/board/src/main/store.ts` — text is stored verbatim and escaping happens at render, because storing escaped text would break the clipboard fidelity feature 005 requires (FR-014)

**Checkpoint**: The service is safe against any local process, which is what
decision 18 requires now that localhost is explicitly not a trust boundary.

---

## Phase 6: User Story 4 — A client confirms it has found the right board (Priority: P4)

**Goal**: A probing client can tell this service apart from any unrelated
program that merely answered.

**Independent Test**: Ask the service to identify itself and confirm it names the
application and version; confirm the shared guard rejects a bare `200 {}`.

**Covers**: FR-007, FR-019, SC-008

### Tests for User Story 4

- [x] T036 [P] [US4] Write `packages/contract/tests/version.test.ts` — `isCoCoapilotHealth()` accepts the real payload and rejects `{}` and `{ app: "other" }`, which is the server half of SC-008 that feature 002's prober tests against
- [x] T037 [P] [US4] Write `apps/board/tests/unit/port.test.ts` — the base port is claimed when free; an occupied base walks up the range; all five occupied surfaces a named error rather than hanging
- [x] T038 [P] [US4] Write `apps/board/tests/integration/health.test.ts` — `GET /v1/health` returns `200 { app: "cocoapilot", version, contract: "v1" }`

### Implementation for User Story 4

- [x] T039 [US4] Create `apps/board/src/main/routes/health.ts` and register `GET /v1/health` in `apps/board/src/main/server.ts`
- [x] T040 [US4] Create `apps/board/src/main/port.ts` — listen on `PORT_BASE`, walk `PORT_RANGE` on `EADDRINUSE`, report the claimed port; wire it into `createService()` so the claimed port is observable (FR-019)

**Checkpoint**: The board is discoverable, and misidentification is impossible
rather than merely unlikely.

---

## Phase 7: User Story 5 — An agent adds a note without resending everything (Priority: P5)

**Goal**: Notes accumulate — the one exception to snapshot-replace in the whole
system.

**Independent Test**: Add three notes, read them back in order, and confirm the
session's reported state was undisturbed.

**Covers**: FR-005, FR-006

### Tests for User Story 5

- [x] T041 [P] [US5] Write `apps/board/tests/integration/note.test.ts` — three notes append in order; a note to an unknown session creates it with `report: null`; a later report replaces the reported state and **leaves the notes**; the 1,001st note returns `409 note_limit`
- [x] T042 [P] [US5] Write `apps/board/tests/unit/store-notes.test.ts` — `appendNote` moves `lastHeardAt` but not `declaredAt`; `source` is preserved alongside `text`; `receivedAt` is the service's clock

### Implementation for User Story 5

- [x] T043 [US5] Create `apps/board/src/main/routes/note.ts` and register `POST /v1/note` in `apps/board/src/main/server.ts` — validate, stamp, append, `200`/`400`/`409`
- [x] T044 [US5] Implement `appendNote` and the 1,000-note cap in `apps/board/src/main/store.ts`, rejecting rather than dropping the oldest, for the same reason as T034
- [x] T045 [US5] Confirm and lock in that `putReport` leaves `notes` untouched in `apps/board/src/main/store.ts` — the sole accumulating structure must survive every replacement (decision 20)

**Checkpoint**: All five stories are independently functional.

---

## Phase 8: Polish & cross-cutting concerns

- [x] T046 [P] Write `apps/board/tests/integration/no-filesystem.test.ts` — with `node:fs` spied at module level, run a full exercise of the contract and assert **zero** calls to any write API anywhere (SC-004) and **zero** reads of any path *inside* a reported repository, the path's own `stat` being the single permitted touch (SC-005). These are the guarantees the entire product rests on; without a test asserting the absence, a future cache file passes review unnoticed
- [x] T047 [P] Write `apps/board/tests/integration/lifecycle.test.ts` — populate several sessions, stop, restart, and assert zero sessions held with no file created anywhere to make that true (SC-009); hold 20 sessions × 200 tasks × 100 notes without loss (SC-006)
- [x] T048 Run `npm run typecheck` and the full suite, then walk all seven validation scenarios in [quickstart.md](quickstart.md) by hand — principle V distinguishes "I believe this works" from "I checked this works"
- [x] T049 [P] Update `CHANGELOG.md` under `[Unreleased]` and flip the Implementation row in `STATUS.md` from unblocked to feature 001 complete
- [x] T050 Read back the full diff before merging to `main` (rule 5; the `diff-reviewer` subagent is the delegable form), then merge the feature branch

---

## Dependencies & execution order

### Phase dependencies

- **Setup (Phase 1)** — no dependencies
- **Foundational (Phase 2)** — needs Setup. **Blocks every user story**
- **US1 (Phase 3)** — needs Foundational
- **US2 (Phase 4)** — needs US1's push route to exist before replacement can be exercised over HTTP. The store-level tests (T025) do not
- **US3 (Phase 5)** — needs US1. Independent of US2 and US4
- **US4 (Phase 6)** — needs Foundational only. Genuinely parallel with US1–US3; health and port touch no shared file
- **US5 (Phase 7)** — needs Foundational only for the store path; the integration test needs US1's push route to prove notes survive a replacement
- **Polish (Phase 8)** — needs all five, because T046 and T047 exercise the whole contract

### Within each story

- Tests are written first and must fail before implementation
- Contract before store, store before routes, routes before registration
- A story is complete before the next priority starts, unless staffed in parallel

### Parallel opportunities

- T002–T005 in Setup
- T008, T009, T010 in Foundational — three independent files with no shared imports
- Every test task inside a story phase (T018–T020, T025–T026, T028–T031, T036–T038, T041–T042)
- **US4 in its entirety** can run alongside US1–US3. It touches only `version.ts`, `port.ts` and `routes/health.ts`
- T046 and T047 in Polish

**Serialisation to watch**: `apps/board/src/main/store.ts` is touched by T014,
T023, T027, T034, T035, T044 and T045 across five phases, and
`apps/board/src/main/server.ts` by T015, T022, T039 and T043. Neither can be
worked in parallel with itself — this is the main constraint on splitting the
feature across people.

---

## Parallel example: User Story 1

```bash
# All three US1 tests together — different files, no shared state:
Task: "Write packages/contract/tests/schema.test.ts"
Task: "Write apps/board/tests/unit/store.test.ts"
Task: "Write apps/board/tests/integration/push.test.ts"
```

```bash
# Foundational constants, all independent:
Task: "Create packages/contract/src/caps.ts"
Task: "Create packages/contract/src/version.ts"
Task: "Create packages/contract/src/ports.ts"
```

---

## Implementation strategy

### MVP first (User Story 1 only)

1. Phase 1: Setup — the workspace does not exist yet, so this is real work
2. Phase 2: Foundational — blocks everything
3. Phase 3: US1
4. **Stop and validate**: quickstart scenario 1 passes; a report is held and readable
5. There is nothing to demo — the window is feature 003. The MVP proof is the suite

### Incremental delivery

US1 makes the product possible. US2 makes it safe to build on. US3 makes it safe
to expose. US4 makes it findable. US5 adds the one accumulating surface. Each is
a commit-worthy increment that leaves the suite green.

### What is deliberately not here

- Anything visible — features 003 onward
- Client discovery and fail-soft messaging — feature 002, though T036 ships the
  guard it tests against
- The preload bridge and renderer — feature 003, which is also when
  `stacks/vite-react.md` and `stacks/electron.md` start governing
- Any Electron dependency. `createService()` is the seam feature 003 mounts

---

## Notes

- `[P]` means a different file with no dependency on incomplete work
- Commit after each task or coherent group; every commit builds and passes tests (principle IX)
- Confirm each test fails before implementing against it
- The two absence tests (T046, T047) are the ones to protect. Everything else in
  this feature can be re-derived from the spec; those two encode a guarantee
  that erodes silently and cannot be recovered by review
