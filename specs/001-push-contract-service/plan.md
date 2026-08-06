# Implementation Plan: Push Contract and Local Service

**Branch**: `001-push-contract-service` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-push-contract-service/spec.md`

## Summary

The spine. An HTTP service bound to localhost accepting a full-snapshot report
per session and appended notes, holding everything in memory, validating every
field, and notifying the window in-process when state changes.

Approach: a `contract` package holding Zod schemas that produce both the runtime
validation and the static types, imported by the service and by both clients so
the three surfaces cannot drift. A `node:http` server over a `Map`-based store
with an `EventEmitter`. No framework, no persistence, no repository access.

This is the first of nine plans; the technical foundation in
[research.md](research.md) is shared and the other eight reference it.

## Technical Context

**Language/Version**: TypeScript 5.x strict, ESM, Node 22 LTS

**Primary Dependencies**: Zod (validation + types); `node:http` (no framework);
Electron (hosts the service in its main process)

**Storage**: None. In-memory only — decision 21 removes persistence entirely

**Testing**: Vitest (unit, integration); Playwright drives Electron end-to-end
from feature 003 onward

**Target Platform**: Windows, macOS, Linux desktop

**Project Type**: npm-workspaces monorepo — `packages/contract`,
`packages/clients` (published), `apps/board` (installed)

**Performance Goals**: Report to rendered update within one frame; zero work
while idle — no timers, no polling anywhere in the system

**Constraints**: Localhost-bound; never writes any file; never reads inside the
reported repository; holds nothing across a restart

**Scale/Scope**: 100 sessions × 500 tasks × 1,000 notes; single user, single
machine

## Constitution Check

*GATE: passed before Phase 0, re-checked after Phase 1.*

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Spec has 5 prioritised stories, explicit non-goals, zero clarification markers; all gaps recorded as assumptions |
| II. Validated trust boundaries | **Pass** | Zod chosen deliberately as the greenfield convention; every field validated; localhost explicitly *not* treated as trust |
| III. Match existing conventions | **Pass** | Greenfield — conventions established here deliberately and recorded in research.md for the other eight to follow |
| IV. Scope discipline | **Pass** | No read endpoint, no auth, no delete/edit path — each named and excluded in the contract |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md) defines the runnable proof, including tests for the two guarantees stated as absences |
| VI. Narrate the reasoning | **Pass** | Decisions carry rationale *and* cost throughout; 28 numbered decisions in STATUS.md |
| VII. Plan whole feature set first | **Pass** | All nine specced; this is plan 1 of 9, and none is implemented until all are planned |
| VIII. Test at the right level | **Pass** | Unit where the logic is (schemas, replace/append), integration for endpoints; E2E deferred to features with a UI |
| IX. Atomic commits, feature branch | **Deferred** | Planning artefacts are on `main` with design docs; implementation moves to `001-push-contract-service` |

**No violations.** Complexity Tracking is therefore empty and omitted.

Principle IX note: specs and plans have been committed to `main` alongside the
design documents, deliberately. Creating nine branches to hold nine planning
documents, then merging all of them before any code exists, would be ceremony
without benefit. The branch is created when implementation starts.

## Project Structure

### Documentation (this feature)

```text
specs/001-push-contract-service/
├── plan.md              # This file
├── research.md          # Phase 0 — shared technical foundation for all nine
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── http-api.md      # Phase 1
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Not yet — /speckit-tasks
```

### Source Code (repository root)

```text
packages/
├── contract/                  # Shared. The reason three surfaces cannot drift
│   ├── src/
│   │   ├── schema.ts          # Zod schemas → runtime validation and types
│   │   ├── caps.ts            # Every length and count limit, one definition
│   │   ├── version.ts         # Contract version, reported by /v1/health
│   │   └── index.ts
│   └── tests/
│       ├── schema.test.ts
│       └── caps.test.ts
│
└── clients/                   # Feature 002. Published; fetched by npx
    └── src/

apps/board/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── store.ts           # Map + EventEmitter. Replace and append
│   │   ├── server.ts          # node:http; three routes
│   │   ├── routes/
│   │   │   ├── push.ts
│   │   │   ├── note.ts
│   │   │   └── health.ts
│   │   ├── port.ts            # Fixed base + fallback range
│   │   └── index.ts
│   ├── preload/               # contextBridge — subscribe to store changes
│   └── renderer/              # Feature 003 onward. Empty for now
└── tests/
    ├── unit/
    │   ├── store.test.ts      # Replace wholesale; append; caps
    │   └── port.test.ts
    └── integration/
        ├── push.test.ts       # Accept, reject, unchanged-on-reject
        ├── note.test.ts
        ├── health.test.ts
        └── no-filesystem.test.ts   # SC-004 and SC-005 — the absence tests
```

**Structure Decision**: npm workspaces with three packages, because one of them
is *published while the others are installed* — `packages/clients` is fetched by
npx and must not drag the Electron app into its dependency tree. That is a
distribution constraint, not a preference. `packages/contract` exists so the
service and both clients share one definition of the payload; without it, the
three-surfaces design drifts on the first change.

This feature writes everything under `packages/contract` and `apps/board/src/main`.
The renderer directory is created but stays empty until feature 003 — which is
also when the owed stack packs (`stacks/vite-react.md`, `stacks/electron.md`)
must be written, since that is the first feature to write framework code.

## Phase 1 design notes

Full detail in [data-model.md](data-model.md) and
[contracts/http-api.md](contracts/http-api.md). Three decisions worth surfacing
here, because each shapes code beyond this feature:

**`status` is `string`, not a union.** Typing it as an enum would make an
unrecognised status a *validation failure* rather than a *display case*, which
inverts decision 25. The recognised vocabulary is a rendering concern and lives
in the renderer.

**`chip` is the only closed enum in the payload**, because it is the sole
channel by which an agent asks for a human (decision 15). Its values must be
exhaustively known for the UI to treat one of them as attention.

**At a cap, reject rather than evict.** Eviction would silently discard a
session someone might be watching, and would be the only place in the product
where something disappears without a restart or a dismissal — which decision 15
and feature 008's FR-017 both forbid.

## Post-design Constitution re-check

Re-evaluated after Phase 1. Still passing, and two principles are now stronger:

- **II** — validation is not merely present but *shared*: one schema definition
  enforced independently by service and clients, with clients treated as
  untrusted regardless.
- **V** — the two guarantees the product rests on have a dedicated test that
  asserts an absence of filesystem calls, rather than being claimed in prose.
  Without it, a future cache file would pass review unnoticed.

No new complexity introduced. Dependencies remain Zod plus the platform.
