# Tasks: Packaging and Distribution

**Input**: Design documents from `specs/009-packaging-distribution/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [quickstart.md](quickstart.md)

Features 001–008 are merged and the product works. Nothing is published.

**Tests**: Included. The weight is different again, and this time it is about a
**one-way door**: a published version cannot be replaced, and unpublishing is
time-limited. So the tests are almost all about refusing to publish the wrong
thing — a stale build, a version disagreement, a package with sources in it, a
client that drags a browser runtime behind it.

## Format: `[ID] [P?] [Story] Description`

---

## The one thing this feature does not do

**It does not publish.** The work ends at a release script that *would*, verified
by packing and installing locally. Publishing needs an account nobody has yet,
is irreversible, and is the maintainer's to run — see the runbook in
[quickstart.md](quickstart.md).

## What is already true and must not be undone

| Thing | Where | Why it matters here |
|---|---|---|
| The client is runtime-free | `packages/clients/tests/unit/packaging.test.ts` | Already asserts no `@cocopilot/board` and nothing that could pull in Electron. FR-004 and SC-003 extend it rather than replacing it |
| Both binaries have shebangs | `dist/cli/index.js`, `dist/mcp/main.js` | Verified 2026-08-07; `bin` entries do not work without them |
| `files: ["dist"]` | Both published manifests | Already ships build output only. FR-005 makes it a test |
| The board builds to `out/` | `apps/board` `electron-vite build` | The input to both routes. FR-025 says neither route may change it |
| Soft failure with no board | `packages/clients` | FR-011 is already true and tested |

---

## Phase 1: Foundational — the manifests can be published at all

**Purpose**: Everything that makes `npm publish` succeed and ship the right
bytes. No new packages yet.

- [x] T001 Add `publishConfig: { "access": "public" }` to `packages/contract/package.json` and `packages/clients/package.json` — **scoped packages default to restricted**, and without this the first publish fails with a 402 asking for a paid plan. The single most common first-publish failure and invisible until the moment it matters
- [x] T002 Add `prepublishOnly` build hooks to both manifests so `dist/` cannot be stale or absent at publish time (FR-017, SC-006) — `files: ["dist"]` ships whatever is on disk, including nothing
- [x] T003 [P] Add `repository`, `homepage`, `bugs` and `keywords` to both manifests, and a `LICENSE` file per published package — npm renders these on the package page and their absence is the difference between a package that looks maintained and one that looks abandoned
- [x] T004 Write the root `README.md`, which does not exist — what the product is, the one command from US1, the configuration entry, and **the first-download size stated before the command that triggers it** (FR-007, SC-010)
- [ ] T005 [P] Extend `packages/clients/tests/unit/packaging.test.ts` — `publishConfig.access` is public on every published manifest, `prepublishOnly` exists, and the packed file list contains no source, test or config file (FR-005, SC-005)

---

## Phase 2: User Story 1 — Run the whole product with one command (Priority: P1) 🎯 MVP

**Goal**: `npx cocopilot-board` opens the board on a machine with nothing
installed.

**Covers**: FR-001, FR-002, FR-003, FR-006, FR-025

**Independent test**: Pack every package, install the runner into a clean
directory, run its binary, and confirm the board starts.

- [x] T006 [US1] Create `packages/runner/` — `cocopilot-board`, depending on `electron` and on the client package, with `files: ["bin", "out"]`. **A separate package rather than un-privating `apps/board`**, because `electron-builder` requires `electron` to be a devDependency and this route requires it to be a dependency; one manifest cannot be both. Say that in the manifest's own comment or the package README, since it looks like duplication until you know
- [x] T007 [US1] Write `packages/runner/bin/cocopilot-board.mjs` — resolves the `electron` binary and spawns it on the bundled `out/`, forwarding the exit code, with **no logic of its own**. It also checks the Node version and fails naming the requirement (FR-006), because failing inside a dependency's syntax is the worst version error there is
- [x] T008 [US1] Wire the runner's build to copy `apps/board/out` rather than rebuilding it (FR-025) — one build feeds both routes, and a second build path is a second thing that can differ
- [ ] T009 [P] [US1] Write `packages/runner/tests/unit/packaging.test.ts` — the manifest declares `electron` as a real dependency and the client package with it; the bin is listed and exists; `engines.node` is declared; and the packed contents carry `out/` and the bin and nothing else
- [x] T010 [US1] Write `scripts/pack-check.mjs` and an npm script that packs every publishable package into a scratch directory, installs the runner from those tarballs into a clean directory, and asserts both binaries resolve — the local stand-in for a publish, and the only way to find out that a package does not install without publishing it to find out

---

## Phase 3: User Story 2 — The reporting tools stay small (Priority: P1)

**Goal**: An agent fetching the tools does not fetch a browser.

**Covers**: FR-004, FR-011, FR-012; SC-003

**Independent test**: Install only the client package into a clean directory and
confirm no Electron anywhere in the tree.

- [ ] T011 [US2] Extend `packages/clients/tests/unit/packaging.test.ts` for the new neighbour — the client must not depend on `cocopilot-board` either, directly or transitively. The runner depends on the client; the moment that arrow reverses, an agent starts downloading a browser to report a task
- [x] T012 [P] [US2] Extend `scripts/pack-check.mjs` to install the **client alone** into its own clean directory and assert `electron` appears nowhere in the installed tree (SC-003), then run its CLI and confirm the soft failure with no board running (FR-011)
- [ ] T013 [US2] Update `packages/clients/README.md` for the two-package world — the configuration entry unchanged (FR-008, FR-010), and a line saying which package to install when you want only the tools

---

## Phase 4: User Story 3 — Produce a release (Priority: P2)

**Goal**: One command produces every artefact, or refuses.

**Covers**: FR-013, FR-014, FR-015, FR-016, FR-017; SC-004, SC-006, SC-007

**Independent test**: Run the release script in dry-run mode against a dirty
tree, a version disagreement and a clean tree, and confirm it refuses the first
two.

- [x] T014 [US3] Write `scripts/release.mjs` with a **dry run by default** — refuses a dirty working tree, refuses when the manifests disagree about version, builds from scratch, runs the pack-check, and prints the publish commands in dependency order. Publishing requires an explicit flag, because a release script whose default is to publish is a release script that publishes by accident
- [ ] T015 [US3] Make the version single-sourced — one place sets the version for every published manifest, so FR-013's "versions agree" is true by construction rather than by discipline. The contract is pinned exactly by the client, so a drift is a broken install rather than a warning
- [ ] T016 [P] [US3] Write `scripts/tests/release.test.ts` — the refusals are the feature, so each is tested: dirty tree, mismatched versions, missing build. Plus the publish order is contract before client before runner, asserted against the dependency graph rather than a hand-written list
- [x] T017 [US3] Document the release runbook in `quickstart.md` — the account, the organisation check, the naming fallback, and the fact that a published version is permanent

---

## Phase 5: Polish

- [ ] T018 [P] Assert the two routes cannot diverge (FR-025) — the runner ships the same `out/` the installer route would package, verified by comparing what the runner packs against what `apps/board/out` contains
- [x] T019 Run the build, typecheck, both suites and the pack-check, then walk [quickstart.md](quickstart.md), correcting it where it turns out to be wrong
- [x] T020 [P] Update `CHANGELOG.md` and `STATUS.md` — and record in STATUS that the installer half is **specified and deferred**, not dropped
- [ ] T021 Read back the full diff, then merge

---

## Phase 6: Deferred — the desktop installers (Priority: P3)

**Not built.** Gated on credentials that cost money and take time: an Apple
developer account for notarisation, and a Windows code-signing certificate.
Specified in [spec.md](spec.md) as FR-018 through FR-024 and left there
deliberately, so that the deferral is visible rather than an omission.

When the certificates exist: `electron-builder` over the same `apps/board/out`,
one artefact per platform, a CI matrix that builds macOS on macOS, and FR-024's
documentation of any platform whose trust requirements are still unmet.

---

## Dependencies

Foundational → US1 → US2 → US3 → Polish.

T006 blocks T007–T010. T010 blocks T012 and T014. Everything marked `[P]` is
genuinely independent.

## What is deliberately not here

Publishing anything. Automatic updates, telemetry, crash reporting and update
checks. Platform store submission, whose requirements would reach back into the
application's design. Installer work before there are certificates to test it
against. Renaming the existing packages, which is a decision the maintainer
makes when they discover whether the organisation is available.
