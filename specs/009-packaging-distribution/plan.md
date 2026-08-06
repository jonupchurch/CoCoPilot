# Implementation Plan: Packaging and Distribution

**Branch**: `009-packaging-distribution` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-packaging-distribution/spec.md`

## Summary

Installers for three platforms, the client package published to npm, and one
path-free configuration entry that works everywhere. Signing where credentials
exist; documented honestly where they do not.

## Technical Context

Inherits [001/research.md](../001-push-contract-service/research.md).

**Primary Dependencies**: `electron-builder` for the three installers; npm for
the client package.

**Signing**: An Authenticode certificate for Windows; an Apple Developer ID plus
notarisation for macOS; Linux unsigned, which is normal for that platform.

**Constraints**: The client package must stay light — it is fetched on first use
in every session. Nothing to migrate between versions, because nothing is
stored.

## Constitution Check

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Three stories, no clarification markers |
| II. Validated trust boundaries | **Pass** | Platform signing *is* the trust boundary here, and is a requirement rather than an aspiration |
| III. Match existing conventions | **Pass** | `electron-builder` is the stack's standard; npm publishing is conventional |
| IV. Scope discipline | **Pass** | No auto-update, telemetry, crash reporting or store distribution |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md) validates on clean machines, not developer machines |
| VI. Narrate the reasoning | **Pass** | Design notes below |
| VII. Plan whole set first | **Pass** | Plan 9 of 9 — the set is now planned |
| VIII. Test at the right level | **Pass** | Unit tests add no signal here; validation is installing on clean machines, deliberately rather than silently |
| IX. Atomic commits, branch | **Deferred** | As 001 |

**No violations.** Principle VIII's "skip deliberately, not silently" is invoked
explicitly: a unit test of an installer configuration asserts that a file says
what it says. The real check is a clean machine.

## Project Structure

```text
electron-builder.yml            # three targets, signing config
.github/workflows/release.yml   # build all four artefacts from one procedure
packages/clients/package.json   # published; bin entries; files allowlist
docs/install.md                 # the configuration entry, and platform caveats
scripts/
└── release.ts                  # version stamping across all packages
```

**Structure Decision**: One release procedure produces all four artefacts —
three installers and the client package — from a single version input. Separate
procedures per artefact is how a board and a client ship with mismatched
versions, which is the exact failure the health endpoint's version field exists
to report.

## Design notes

**The clients being fetched on demand is why signing is tractable.** Decision 27
put the spawnable piece outside the signed artefact entirely, so only the
Electron app faces platform trust. That was the point of the decision, and it is
worth restating here where the cost would otherwise land.

**A first-launch security warning is a defect.** For a tool that watches an AI
agent work inside your repository, the operating system saying it cannot verify
the publisher is the worst available first impression. FR-003 and FR-004 treat
it as a requirement rather than a nicety, because otherwise it is deferred
indefinitely.

**Where signing is unavailable, document what the user will see** (FR-016).
Credentials have to be obtained and may not be, per platform. The honest failure
is a documented caveat; the dishonest one is silence and a confused user.

**Version stamping is mechanical and shared.** All four artefacts take the same
version from one place. A client and board that disagree say so through the
health endpoint — the mechanism already exists, and this feature is what makes
disagreement possible in the first place, since the two are distributed
separately.

**The client package needs a `files` allowlist.** Published packages default to
including more than intended, and this one is downloaded on first use in every
session. Keeping it small is a user-facing latency concern, not tidiness.

**Nothing to migrate, and that is worth noticing.** Installing over a previous
version cannot lose data because there is no data. This is the one place the
no-durable-state decision does not merely simplify a job — it deletes migration,
versioned storage and recovery paths outright.

## Post-design Constitution re-check

Still passing. Principle V is the operative one: this feature cannot be verified
on the machine that built it. Every meaningful check requires a clean machine per
platform, which is stated in the quickstart rather than left as an assumption
that "it built, so it installs".
