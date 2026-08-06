# Feature Specification: Packaging and Distribution

**Feature Branch**: `009-packaging-distribution`

**Created**: 2026-08-06

**Status**: Draft

**Input**: Getting the product onto machines. Installers for Windows, macOS and Linux for the desktop application, including whatever signing each platform requires for a normal install experience. The reporting clients are published separately as a package fetched on demand, which is what keeps them out of the signing story. Plus the documented configuration entry someone adds to make the tools available to their agent.

## Context

The last feature, and the one that decides whether anyone else can run this.

Two actors: the **developer installing** the product for the first time, and the
**maintainer** producing a release.

The shape here follows from an earlier decision. The AI tool spawns the
reporting client itself, so something must be launchable independently of the
desktop application. Publishing that as a fetched-on-demand package rather than
a bundled binary removes it from the signing and notarisation story entirely,
leaving the desktop application as the only artefact requiring platform trust.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Install the board and have it run (Priority: P1)

A developer downloads the application for their platform, installs it the way
they install anything, opens it, and sees the waiting state.

**Why this priority**: Nothing else in the product is reachable without it.

**Independent Test**: On a clean machine of each platform, install from the
published artefact, launch, and confirm the waiting state appears.

**Acceptance Scenarios**:

1. **Given** a clean Windows machine, **When** the developer installs and
   launches, **Then** the application opens and shows its waiting state.
2. **Given** a clean macOS machine, **When** the developer installs and
   launches, **Then** the application opens without the system refusing to run
   it or warning that it is untrusted.
3. **Given** a clean Linux machine, **When** the developer installs and
   launches, **Then** the application opens and shows its waiting state.
4. **Given** any platform, **When** the developer installs, **Then** no
   additional runtime or dependency must be installed by hand for the
   application itself to run.
5. **Given** an installed application, **When** the developer removes it,
   **Then** it uninstalls cleanly and leaves nothing behind.

---

### User Story 2 - Make the reporting tools available to an agent (Priority: P1)

A developer adds one documented configuration entry, starts an agent session,
and the reporting tools are there — without knowing where anything is installed
or which platform they are on.

**Why this priority**: Equal to P1 because an installed board with nothing
reporting to it is an empty window. Both halves are required for the product to
do anything.

**Independent Test**: On each platform, add the documented entry to a clean
agent configuration, start a session, and confirm the tools are present and can
reach a running board.

**Acceptance Scenarios**:

1. **Given** the documented configuration entry, **When** it is added and a
   session starts, **Then** the reporting tools are available.
2. **Given** the same entry text, **When** it is used on Windows, macOS or
   Linux, **Then** it works unchanged on each.
3. **Given** the entry, **When** a developer reads it, **Then** it contains no
   filesystem path specific to where the application was installed.
4. **Given** the desktop application has never been installed, **When** the
   entry is used, **Then** the tools are still available and fail soft because
   no board is running — not because they are missing.
5. **Given** a machine lacking the runtime the clients need, **When** a session
   starts, **Then** the failure names the missing prerequisite.

---

### User Story 3 - Produce a release (Priority: P2)

A maintainer builds and publishes a version — installers for three platforms and
the client package — with the pieces agreeing about what version they are.

**Why this priority**: Required for anyone but the author to have the product,
but only after there is something worth releasing.

**Independent Test**: Run the release process for a version and confirm all
artefacts are produced, are marked with that version, and that an installed
board and a fetched client agree.

**Acceptance Scenarios**:

1. **Given** a version to release, **When** the maintainer runs the release
   process, **Then** installers for all three platforms and the client package
   are produced.
2. **Given** produced artefacts, **When** they are inspected, **Then** each is
   marked with the version released.
3. **Given** a released board and its matching client, **When** they interact,
   **Then** neither reports a version disagreement.
4. **Given** a released board and a client from a different release, **When**
   they interact, **Then** any incompatibility is stated plainly rather than
   failing obscurely.
5. **Given** a release, **When** it is published, **Then** the documented
   configuration entry does not change between versions.

---

### Edge Cases

- **The system refuses to launch an unrecognised application.** Addressed by
  platform signing; a first-run experience that requires overriding a security
  warning is a defect, not an inconvenience.
- **A client fetched on demand with no network available.** Fails with a message
  naming the cause, rather than presenting as broken tooling.
- **Installing a newer board over an older one.** Replaces it cleanly, with
  nothing to migrate — the application holds no durable state.
- **Two boards installed or running at once.** The second finds the first has
  claimed an address and either claims another in the range or declines to start
  a duplicate.
- **A client older or newer than the board it reaches.** Version disagreement is
  stated, not silently tolerated.
- **A platform where signing is unavailable to the maintainer.** The
  consequence — a warning at first launch — is documented rather than
  discovered by users.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The desktop application MUST be distributable as an installable
  artefact for Windows, macOS and Linux.
- **FR-002**: Each artefact MUST install and launch on a clean machine of its
  platform with no manually installed runtime or dependency.
- **FR-003**: The macOS artefact MUST satisfy that platform's trust
  requirements, such that first launch presents no warning that the application
  is untrusted or unverified.
- **FR-004**: The Windows artefact MUST install without a warning that the
  publisher is unknown.
- **FR-005**: Each artefact MUST uninstall cleanly, leaving no files behind.
- **FR-006**: The reporting clients MUST be published as a package fetched on
  demand, independently of the desktop application's artefacts.
- **FR-007**: The documented configuration entry MUST work unchanged on all
  three platforms and MUST contain no path specific to an installation
  location.
- **FR-008**: The reporting clients MUST be usable whether or not the desktop
  application is installed.
- **FR-009**: A missing prerequisite for the clients MUST produce a message
  naming it.
- **FR-010**: Every published artefact MUST carry the version it belongs to.
- **FR-011**: A board and a client that disagree about contract version MUST
  say so plainly.
- **FR-012**: The documented configuration entry MUST remain stable across
  versions.
- **FR-013**: Installing a newer version over an older one MUST succeed without
  requiring the older to be removed and without any migration step.
- **FR-014**: A second instance of the application MUST NOT interfere with a
  running first instance.
- **FR-015**: The release process MUST produce all artefacts for a version from
  a single defined procedure.
- **FR-016**: Documentation MUST state any platform for which trust
  requirements are not met, and what a user will see as a result.

### Key Entities

- **Desktop artefact**: One installable file per platform, carrying the
  application and everything it needs to run.
- **Client package**: The reporting clients, published separately and fetched on
  demand — deliberately outside the platform trust story.
- **Configuration entry**: The documented text a developer adds to make the
  reporting tools available. Path-free, platform-independent, stable across
  versions.
- **Version**: The identifier shared by everything in one release, and the basis
  of the compatibility statement between a board and a client.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer installs and launches the application on a clean
  machine of any supported platform in under 5 minutes, without documentation
  beyond a download link.
- **SC-002**: First launch presents no security or trust warning on any platform
  where signing is in place.
- **SC-003**: A developer makes the reporting tools available to their agent by
  adding one documented entry, with no path editing, in 100% of cases.
- **SC-004**: The same configuration entry works unmodified on all three
  platforms.
- **SC-005**: Zero manual dependency installation is required for the desktop
  application on any platform.
- **SC-006**: All artefacts for a release are produced from one defined
  procedure and carry the same version.
- **SC-007**: A board and client from different releases that cannot work
  together produce a message identifying the mismatch, in 100% of cases.
- **SC-008**: Installing over a previous version succeeds with no migration step
  and no data loss — trivially satisfied, as nothing is stored.
- **SC-009**: Uninstalling leaves no files behind, verifiable by inspection.

## Assumptions

- **Signing requires credentials that must be obtained**, particularly for
  macOS. Acquiring them is a prerequisite to satisfying FR-003, not a technical
  problem to solve in code.
- **Linux is served by a single common artefact format** chosen during planning,
  rather than one per distribution.
- **Automatic updates are out of scope.** Users install new versions themselves.
  A natural early addition, deliberately not now.
- **Distribution is by direct download**, not through platform stores, whose
  requirements would reach back into the application's design.
- **The client package is fetched at first use**, so a network is required once
  per machine. Recorded as an edge case because the failure is otherwise
  indistinguishable from broken tooling.
- **No telemetry, crash reporting or update checking is included.** Consistent
  with a product that holds nothing and transmits nothing.
- **Nothing needs migrating between versions**, because the application holds no
  durable state — the one place that constraint makes a job disappear entirely.
