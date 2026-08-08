# Implementation Plan: Packaging and Distribution

**Branch**: `009-packaging-distribution` | **Date**: 2026-08-06 |
**Re-planned**: 2026-08-07 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-packaging-distribution/spec.md`

## Summary

Two distribution routes over one build. Three npm packages so the product runs
from a single `npx`, and — later, behind credentials — signed installers for
three platforms.

## Technical Context

**Primary Dependencies**: `electron-builder` for the installer route only.
Nothing new for the npm route.

**Constraints**: One application build feeds both routes; published packages
carry build output only; a release publishes in dependency order or not at all.

## Constitution Check

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Four stories; the re-spec resolved the one real ambiguity — whether installers were the only route |
| II. Validated trust boundaries | **Pass** | No new input surface. The release script is maintainer-run, not user-facing |
| III. Match existing conventions | **Pass** | Same workspace layout, same build, same test projects |
| IV. Scope discipline | **Pass** | No auto-update, no telemetry, no store submission, no installer work before certificates exist |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md); the packaging tests already assert the client's shape |
| VI. Narrate the reasoning | **Pass** | Design notes below |
| VII. Plan whole set first | **Pass** | Plan 9 of 9 |
| VIII. Test at the right level | **Pass** | Unit for manifest shape and release ordering; a real pack-and-install for the published artefact |
| IX. Atomic commits, branch | **Deferred** | As 001 |

**No violations.**

## Project Structure

```text
packages/
├── contract/          # published, unchanged
├── clients/           # published, unchanged  →  the MCP + CLI
└── runner/            # NEW. The published board: bin, electron dep, out/
apps/
└── board/             # stays private; electron stays a devDependency
scripts/
└── release.mjs        # NEW. Version, build, verify, publish in order
```

**Structure Decision**: the runnable board is a **separate package** rather than
`apps/board` un-privated, and the reason is a hard constraint rather than a
preference: `electron-builder` requires `electron` to be a devDependency,
because it bundles the runtime itself; the npm route requires the opposite, so
that `npm install` fetches it. One manifest cannot be both. `packages/runner`
declares `electron` as a real dependency and ships the built `out/`, leaving
`apps/board` exactly as it is and able to feed the installer route unchanged.

## Design notes

**The cheap route goes first.** The npm route needs no certificates, no
developer account and no per-platform CI. It is the difference between the
product being available this week and being available after a purchase.

**One build, two packagings.** `electron-vite build` produces `out/`, and both
routes consume it. FR-025 exists so nobody solves a packaging problem by
changing the application.

**Publishing is irreversible, so the release script's job is refusal.** A
version cannot be replaced once published and unpublishing is time-limited, so
the design goal is not recoverability — it is making a bad publish hard. That
means: refuse a dirty working tree, refuse a version that disagrees across
manifests, build from scratch rather than trusting `dist/`, verify the packed
contents, and publish in dependency order so a half-finished release never
leaves a package pointing at one that does not exist.

**Naming is the one decision this feature does not make.** The unscoped name
`cocoapilot` is an npm security holding package and cannot be had, so `npx
cocoapilot` is unavailable whatever else is decided. Beyond that there are two
shapes, and the choice is irreversible in the way publishing is:

| | Scoped — keep `@cocoapilot/*` | Unscoped — `cocoapilot-*` |
|---|---|---|
| Entry point | `npx @cocoapilot/board` | `npx cocoapilot-board` |
| Needs an npm organisation | **Yes**, and its availability could not be verified without a login | No |
| Churn to adopt | None | 52 files import `cocoapilot-contract` |

**Nothing here is built against that choice.** The runner package, the release
script, the manifest hygiene and the tests are all name-agnostic, and the new
package takes the unscoped `cocoapilot-board` because it is a new name with
nothing to rename and is confirmed free. The existing two keep their names until
someone checks whether the organisation can be claimed — which is the first step
of the release runbook, not a build task.

If the organisation turns out to be taken, the fallback is a mechanical rename
to `cocoapilot-contract` / `cocoapilot-mcp`: a find-and-replace across 52 files
that the typechecker verifies completely, plus one assertion in
`packaging.test.ts` and one line in the client README. Recorded so that
discovering it at publish time is an inconvenience rather than a redesign.

**The three packages are not equals.** `contract` is an implementation detail
that exists because two other packages must agree; `clients` is what an agent
fetches and must stay small and runtime-free; `runner` is what a human fetches
and is allowed to be large. FR-004 and SC-003 exist to stop the third
contaminating the second — the existing `packaging.test.ts` already holds that
line and gains a case.

**Nothing is published by this feature.** The work ends at a release script that
would publish, verified by packing and installing locally. The publish itself
needs an account, is irreversible, and is the maintainer's to run.

## Post-design Constitution re-check

Still passing. The interesting one is principle IV: the temptation here is to do
the installer work "while we are in the packaging headspace", when it is gated
on credentials nobody has yet and would be untested against the real signing
path. It is specified and left.

## Phase 0 findings

Recorded rather than researched afresh, because they were established by direct
check on 2026-08-07:

- `cocoapilot` on npm is a **security holding package** (`0.0.1-security`, no
  maintainer). Unavailable.
- `cocoapilot-board`, `cocoapilot-mcp`, `cocoapilot-contract`, `cocoapilot-app`,
  `cocoapilot-cli` and `co-copilot` are all free.
- `cocoapilot-mcp` does not exist; whether the `@cocoapilot` **organisation** is
  free could not be determined without an authenticated session.
- `cocoapilot-mcp` packs to 21.4 kB over 46 files and installs cleanly with both
  binaries working — but only alongside `cocoapilot-contract`, which is pinned
  exactly and unpublished, so installing the client alone fails with a 404.
- No npm credentials are present on the development machine.
