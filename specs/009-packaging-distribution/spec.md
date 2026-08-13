# Feature Specification: Packaging and Distribution

**Feature Branch**: `009-packaging-distribution`

**Created**: 2026-08-06 | **Re-specified**: 2026-08-07

**Status**: Draft

**Input**: Getting the product onto machines, by **two routes that share one
build**. A published package so a developer can run the whole product with a
single `npx` and no install, bringing the board and the reporting tools
together; and, later, signed installers for Windows, macOS and Linux for people
who want a real desktop application. Plus the documented configuration entry
someone adds to make the tools available to their agent.

## Context

The last feature, and the one that decides whether anyone else can run this.

Two actors: the **developer installing** the product for the first time, and the
**maintainer** producing a release.

**Why this was re-specified.** The original spec had one route — signed
installers — and made them a hard requirement. That put the product's
availability behind credentials that cost money and take time to obtain: an
Apple developer account for notarisation, and a Windows code-signing
certificate. Meanwhile the audience for this product already runs `npx` to
configure MCP servers, and the application is an Electron app that npm can carry
perfectly well.

So there are two routes now, and the cheap one goes first. Nothing about the
application changes for either: both consume the same build.

The shape of the client half follows from an earlier decision. The AI tool
spawns the reporting client itself, so something must be launchable
independently of the desktop application. Publishing that as a fetched-on-demand
package rather than a bundled binary removes it from the signing story entirely.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the whole product with one command (Priority: P1)

A developer with Node installed runs a single command and has the board open and
the reporting tools available, without installing anything by hand and without
knowing what an Electron is.

**Why this priority**: It is the shortest path from nothing to a working
product, it requires no credentials from the maintainer, and it serves the
audience the product already assumes — someone who configures MCP servers.

**Independent Test**: On a clean machine with Node, run the documented command
and confirm the board opens and shows its waiting state.

**Acceptance Scenarios**:

1. **Given** a clean machine with a supported Node version, **When** the
   developer runs the published command, **Then** the board opens and shows its
   waiting state.
2. **Given** that command, **When** it is run on Windows, macOS or Linux,
   **Then** it is the same command and works unchanged on each.
3. **Given** the package, **When** it is installed, **Then** the reporting
   tools arrive with it rather than needing a second install.
4. **Given** an unsupported Node version, **When** the command is run, **Then**
   the failure names the required version rather than failing inside a
   dependency.
5. **Given** a first run, **When** the package is fetched, **Then** the size and
   the one-time nature of the download are documented, because it is large
   enough to be surprising.
6. **Given** a machine with no network, **When** the command is run for the
   first time, **Then** the failure names the cause rather than presenting as
   broken tooling.

---

### User Story 2 - Make the reporting tools available to an agent (Priority: P1)

A developer adds one documented configuration entry, starts an agent session,
and the reporting tools are there — without knowing where anything is installed
or which platform they are on.

**Why this priority**: Equal to P1 because a board with nothing reporting to it
is an empty window. Both halves are required for the product to do anything.

**Independent Test**: On each platform, add the documented entry to a clean
agent configuration, start a session, and confirm the tools are present and can
reach a running board.

**Acceptance Scenarios**:

1. **Given** the documented configuration entry, **When** it is added and a
   session starts, **Then** the reporting tools are available.
2. **Given** the same entry text, **When** it is used on Windows, macOS or
   Linux, **Then** it works unchanged on each.
3. **Given** the entry, **When** a developer reads it, **Then** it contains no
   filesystem path specific to where anything was installed.
4. **Given** the board has never been run, **When** the entry is used, **Then**
   the tools are still available and fail soft because no board is running — not
   because they are missing.
5. **Given** a machine lacking the runtime the clients need, **When** a session
   starts, **Then** the failure names the missing prerequisite.
6. **Given** a developer who wants only the reporting tools, **When** they
   install them, **Then** they receive a package that does not carry the desktop
   application or anything that would pull in a browser runtime.

---

### User Story 3 - Produce a release (Priority: P2)

A maintainer publishes a version, with every published piece agreeing about what
version it is.

**Why this priority**: Required for anyone but the author to have the product,
but only once there is something worth releasing.

**Independent Test**: Run the release process for a version and confirm every
artefact is produced, is marked with that version, and that a board and a client
from the same release agree.

**Acceptance Scenarios**:

1. **Given** a version to release, **When** the maintainer runs the release
   process, **Then** every published package is produced and marked with that
   version.
2. **Given** packages that depend on one another, **When** a version is
   released, **Then** they are published in an order that leaves no published
   package referring to one that does not exist.
3. **Given** a released board and its matching client, **When** they interact,
   **Then** neither reports a version disagreement.
4. **Given** a released board and a client from a different release, **When**
   they interact, **Then** any incompatibility is stated plainly rather than
   failing obscurely.
5. **Given** a release, **When** it is published, **Then** the documented
   configuration entry does not change between versions.
6. **Given** a published package, **When** anyone inspects it, **Then** it
   contains only build output and documentation — no sources, tests, or
   development configuration.

---

### User Story 4 - Install the board as a desktop application (Priority: P3)

A developer downloads an installer for their platform, installs it the way they
install anything, opens it, and sees the waiting state — with no security
warning to override.

**Why this priority**: The better experience, and the one a non-technical user
would need, but it is gated on credentials that cost money and take time to
obtain. Deferring it is what lets the product be usable before then; **it is
not cancelled**, and the requirements below stand unchanged from the original
specification.

**Independent Test**: On a clean machine of each platform, install from the
published artefact, launch, and confirm the waiting state appears without a
trust warning.

**Acceptance Scenarios**:

1. **Given** a clean Windows machine, **When** the developer installs and
   launches, **Then** the application opens and shows its waiting state.
2. **Given** a clean macOS machine, **When** the developer installs and
   launches, **Then** the application opens without the system refusing to run
   it or warning that it is untrusted.
3. **Given** a clean Linux machine, **When** the developer installs and
   launches, **Then** the application opens and shows its waiting state.
4. **Given** any platform, **When** the developer installs, **Then** no
   additional runtime must be installed by hand for the application to run.
5. **Given** an installed application, **When** the developer removes it,
   **Then** it uninstalls cleanly and leaves nothing behind.
6. **Given** installing a newer version over an older one, **When** it happens,
   **Then** it succeeds with nothing to migrate.

---

### Edge Cases

- **A first run with no network.** Fails naming the cause, rather than
  presenting as broken tooling.
- **A very large first download.** Documented rather than discovered: the
  package carries a browser runtime and is tens of times the size of the client
  package beside it.
- **A developer who wants only the reporting tools.** Served by a package that
  carries neither the application nor a browser runtime.
- **Two boards running at once.** The second finds the first has claimed an
  address and either claims another in the range or declines to start.
- **A client older or newer than the board it reaches.** Version disagreement is
  stated, not silently tolerated.
- **A platform where signing is unavailable to the maintainer.** The
  consequence — a warning at first launch, or an unsigned runtime — is
  documented rather than discovered by users.
- **A published version that turns out to be wrong.** It cannot be replaced; a
  new version is the only remedy. The release process must make a bad publish
  hard rather than recoverable.

## Requirements *(mandatory)*

### Functional Requirements

**The published packages**

- **FR-001**: The product MUST be runnable by a single documented command on a
  machine with a supported runtime and no prior installation.
- **FR-002**: That command MUST be identical on Windows, macOS and Linux.
- **FR-003**: The package that command fetches MUST bring both the board and the
  reporting tools.
- **FR-004**: The reporting tools MUST also be installable on their own, in a
  package that carries neither the desktop application nor a browser runtime.
- **FR-005**: Every published package MUST contain only build output and
  documentation.
- **FR-006**: Every published package MUST declare the runtime versions it
  supports, and MUST fail naming the requirement when run on an unsupported one.
- **FR-007**: The size of the first download and its one-time nature MUST be
  documented where a developer will see it before running the command.

**The configuration entry**

- **FR-008**: The documented configuration entry MUST work unchanged on all
  three platforms.
- **FR-009**: It MUST contain no filesystem path specific to an installation.
- **FR-010**: It MUST remain stable across versions.
- **FR-011**: The reporting tools MUST be usable whether or not the board is
  running or installed.
- **FR-012**: A missing prerequisite MUST produce a message naming it.

**Releasing**

- **FR-013**: Every published artefact MUST carry the version it belongs to, and
  those versions MUST agree across artefacts released together.
- **FR-014**: The release process MUST publish interdependent packages in an
  order that never leaves a published package referring to one that does not
  exist.
- **FR-015**: The release process MUST produce every artefact for a version from
  one command.
- **FR-016**: A board and a client that disagree about contract version MUST say
  so plainly rather than failing obscurely.
- **FR-017**: The release process MUST make publishing an unbuilt or stale
  artefact impossible rather than merely unlikely.

**The desktop installers — WITHDRAWN 2026-08-13 (decision 42)**

> **npx is the only distribution route.** These seven requirements were
> specified and parked behind signing credentials; they are now **out of scope**,
> not pending. A developer already has Node and already runs `npx`, and a
> board that watches an AI agent work is for developers — installers exist to
> reach people who would not run a command, which is not this product's audience.
>
> Kept here struck through rather than deleted, because the reasoning is what a
> future reader needs if the audience ever changes. Reopening them costs
> credentials and `electron-builder` configuration, not redesign: FR-025 already
> requires the npm route to ship the exact `out/` an installer would package.

- ~~**FR-018**: The desktop application MUST be distributable as an installable
  artefact for Windows, macOS and Linux.~~
- ~~**FR-019**: Each artefact MUST install and launch on a clean machine of its
  platform.~~
- ~~**FR-020**: The macOS artefact MUST satisfy that platform's trust
  requirements.~~ *(Would need an Apple Developer ID and notarisation.)*
- ~~**FR-021**: The Windows artefact MUST install without a warning that the
  publisher is unrecognised.~~ *(Would need an Authenticode certificate.)*
- ~~**FR-022**: Each artefact MUST uninstall cleanly, leaving no files behind.~~
- ~~**FR-023**: Installing a newer version over an older one MUST succeed.~~
- ~~**FR-024**: Documentation MUST state any platform for which trust
  requirements are unmet, and what a developer will see as a result.~~
  *(Moot: with no installer, there is no unmet trust requirement to document.)*

**Both routes**

- **FR-025**: Both distribution routes MUST be produced from the same
  application build, so that the two cannot diverge in behaviour.
- **FR-026**: A second instance of the application MUST NOT interfere with a
  running one.
- **FR-027**: The application MUST retain no durable state, so that no version
  requires a migration.

### Key Entities

- **Published package**: One npm package — the reporting tools, the shared
  contract, or the runnable board. Carries a version, build output and
  documentation, and nothing else.
- **Installer artefact**: One platform's installable file for the desktop
  application, carrying the same version as the packages released with it.
- **Configuration entry**: The text a developer adds to their agent's
  configuration. Stable, path-free, and identical across platforms.

## Success Criteria *(mandatory)*

- **SC-001**: A developer with a supported runtime goes from nothing to an open
  board with one command, in 100% of attempts on all three platforms.
- **SC-002**: The documented configuration entry works unchanged on all three
  platforms, verified on each.
- **SC-003**: A developer who installs only the reporting tools receives no
  browser runtime — verifiable by inspecting the installed dependency tree.
- **SC-004**: Every artefact of a release reports the same version, in 100% of
  releases.
- **SC-005**: No published package contains source, tests or development
  configuration — verifiable by inspecting the package contents.
- **SC-006**: A release cannot be produced from an unbuilt or stale working
  tree — verifiable by attempting one.
- **SC-007**: A board and client from the same release never report a version
  disagreement.
- **SC-008**: Installing over a previous version succeeds with no migration
  step, in 100% of cases.
- **SC-009**: Every platform whose trust requirements are unmet is named in the
  documentation, along with what the developer will see.
- **SC-010**: The first-download size is stated in the documentation before the
  command that triggers it.

## Assumptions

- **The two routes ship in sequence, not together.** The published packages come
  first because they need no credentials; the installers follow. Both are
  specified here so the second is a deferral rather than an oversight.
- **Signing requires credentials that must be obtained**, particularly for
  macOS. Acquiring them is a prerequisite to satisfying FR-020, not a technical
  problem to solve in code.
- **The npm route ships an unsigned runtime.** It is fetched from the registry
  as a dependency rather than presented as an installed application, which is
  why it does not require the same platform trust — and why it is a developer's
  distribution rather than a general one.
- **Publishing is irreversible.** A version cannot be replaced once published,
  and unpublishing is time-limited. The release process is designed around that
  rather than around being able to correct a mistake.
- **Linux is served by a single common artefact format** chosen during planning,
  rather than one per distribution.
- **Automatic updates are out of scope.** Users install new versions themselves.
- **Distribution is by direct download and by npm**, not through platform
  stores, whose requirements would reach back into the application's design.
- **No telemetry, crash reporting or update checking is included.** Consistent
  with a product that holds nothing and transmits nothing.
- **Nothing needs migrating between versions**, because the application holds no
  durable state — the one place that constraint makes a job disappear entirely.
