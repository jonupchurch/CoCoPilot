# Quickstart: Packaging and Distribution

**Feature**: [009-packaging-distribution](spec.md) | **Date**: 2026-08-06

**This feature cannot be validated on the machine that built it.** Every
meaningful check needs a clean machine per platform. "It built" is not evidence
that it installs.

## Prerequisites

- Features 001–008 implemented
- Signing credentials: Authenticode (Windows), Developer ID (macOS)
- Clean VMs or machines for Windows, macOS and Linux

## Build

```bash
npm run release -- --version 0.1.0    # all four artefacts, one version
```

## Validation scenarios

### 1. Install and launch (US1)

On a **clean** machine of each platform:

| Check | Windows | macOS | Linux |
|---|---|---|---|
| Installs without an unknown-publisher warning | required | — | n/a |
| Launches with no untrusted/unverified warning | required | required | n/a |
| Opens to the waiting state | required | required | required |
| No runtime installed by hand | required | required | required |
| Uninstalls leaving nothing behind | required | required | required |

The macOS row is the one that fails most often and latest — verify on a machine
that has never seen the certificate, since a build machine trusts its own.

### 2. The configuration entry (US2)

On each clean machine, with the desktop application **not installed**:

- Add the documented entry to an agent configuration.
- Start a session: both tools are present.
- Calling one returns the board-absent message — present and failing soft, not
  missing.
- Install the board, report again: it arrives.
- Confirm the entry text contains **no** filesystem path, and is byte-identical
  across all three platforms.

### 3. Missing prerequisite

On a machine without the runtime the clients need:

- The failure names the missing prerequisite.
- It does not present as "the tools are broken".

### 4. Release integrity (US3)

- One command produced three installers and the client package.
- All four carry the same version.
- A matching board and client report no version disagreement.
- A deliberately mismatched pair **does** report one, plainly, through the health
  endpoint — not as odd behaviour.

### 5. Upgrade and coexistence

- Installing a newer version over an older one succeeds with no migration step
  and no data loss. Trivially true — nothing is stored — but verify it is true
  rather than assumed.
- Launching a second instance while one runs: the second claims another port in
  the range or declines to start a duplicate. It does not disturb the first.

### 6. Offline first use

With no network, on a machine where the client package has never been fetched:

- The failure names the cause.
- It is distinguishable from "the tools are broken".

### 7. Package size

- Inspect the published client package contents against its `files` allowlist.
- Nothing from the Electron app is present in its dependency tree.

## Expected outcome

All checks pass on all three platforms, or any that cannot are **documented**
with what a user will see — per FR-016. An undocumented signing gap is a
failure; a documented one is a known limitation.

## Not validated here

- Automatic updates, telemetry, crash reporting, store distribution — all out of
  scope by design.
