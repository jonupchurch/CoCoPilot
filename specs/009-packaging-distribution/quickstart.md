# Quickstart: Packaging and Distribution

**Feature**: [009-packaging-distribution](spec.md) | **Re-written**: 2026-08-07

## Prerequisites

Features 001–008 implemented. For the release runbook below, an npm account —
which is the one thing this repository cannot provide for itself.

## Run the checks

```bash
npm run build
npm run typecheck
npm test
npm run test:e2e
npm run pack:check   # packs, installs and launches every package
npm run release      # every refusal, then the publish plan
```

`npm run pack:check` is the important one and takes about a minute: it is the
only thing standing between a mistake and a permanent one.

## Validation scenarios

### 1. One command runs the product (US1)

```bash
npx cocoapilot
```

- The board opens and shows its waiting state.
- Same command on all three platforms.
- The reporting tools arrive with it — `cocoapilot` and `cocoapilot-mcp` are both
  on the path after installing the one package.
- On Node older than 22, the failure **names the version** rather than throwing
  from inside a dependency.

**Verified locally by `pack:check`**, which installs the packed tarballs into a
clean directory and starts the board from them. What it cannot verify is a
genuinely clean machine, a different platform, or npm's own resolution — those
are true tests only after publishing.

### 2. The reporting tools stay small (US2)

- Installing `cocoapilot-mcp` alone brings **no** Electron, Chromium or
  Playwright — asserted over the installed tree, not the manifest.
- The CLI runs with no board and says so softly, exiting 0.
- The configuration entry is unchanged from previous versions and names no path.

### 3. A release refuses before it ruins (US3)

Each of these should stop the release, naming the cause:

| Sabotage | Refusal |
|---|---|
| Uncommitted changes | Lists them; nothing is built |
| Version bumped in one manifest only | Prints all three versions side by side |
| A pin naming a different version | Names the pin and the release version |
| `publishConfig.access` removed | Names the package |
| `prepublishOnly` removed | Names the package |

All five verified by doing them. The first is the one that fires most often in
practice, and it fired for real during this feature.

### 4. Nothing is published

`npm run release --publish` prints the same plan and publishes nothing. That is
deliberate, not unfinished: see the runbook.

## The release runbook

**Everything up to this point is reversible. Nothing past it is.** A published
version cannot be replaced, and unpublishing is limited to 72 hours.

1. **Create an npm account** and enable 2FA. Public packages are free.
2. **The naming is settled** — three flat, unscoped names, so no npm
   organisation is needed and nothing blocks on one being available:

   | Package | Command |
   |---|---|
   | `cocoapilot` | `npx cocoapilot` — the board, the whole product |
   | `cocoapilot-mcp` | `npx -y cocoapilot-mcp` — the reporting tools alone |
   | `cocoapilot-contract` | not run directly; the shared payload definition |

   All three were confirmed absent from the registry on 2026-08-08.

   - **The earlier note here was wrong** and is worth recording, because it was
     wrong in the direction that costs a name. It said `cocoapilot` was an npm
     *security holding package*. The holding package is **`cocopilot`** — the
     spelling this product used before 2026-08-07. Renaming to CoCoapilot moved
     the product off the taken name without anyone noticing that it also made
     `npx cocoapilot` available.
   - **`npm` may still refuse `cocoapilot` as too similar to `cocopilot`.** One
     letter apart, and the similarity check runs registry-side at publish time
     only — `npm publish --dry-run` will not tell you, and there is no way to
     ask beforehand. Note where that lands: `cocoapilot` is the *runner*, which
     dependency order publishes **last**, so a refusal arrives after the other
     two are permanently published.
     - That is survivable, and it is why the order is still right. Nothing
       depends on the runner, so `cocoapilot-contract` and `cocoapilot-mcp`
       stay correct and installable whatever happens to the third name.
     - **Fallback:** `cocoapilot-board`, still free, and the binary is already
       called that — so only the runner's `name` field and the `npx` line in
       the two READMEs change. Do not renumber the version to retry.
   - `@cocoapilot/board` keeps its scope. It is `private: true`, never reaches
     the registry, and renaming it would be churn across 33 references for no
     effect.
3. **`npm login`** on the release machine, or mint a granular token for CI.
4. **`npm run release`** and read every line. It builds from scratch and
   rehearses the install.
5. **Publish in the printed order** — contract, then client, then runner. Out of
   order leaves a published package pointing at one that does not exist, and
   that cannot be taken back.
6. **Install it somewhere clean and run it**, from the registry rather than from
   a tarball. This is the first moment the real thing is testable.

## Expected outcome

All pass, and the interesting failure already happened during implementation.

`pack:check` verified that every file was present, both binaries resolved, and
the package installed — while the published command opened a window onto a
file-not-found. Electron had been handed the entry *file* rather than the
package directory, so `app.getAppPath()` came back one level too deep and the
renderer was looked for inside `out/main/`. The process stayed up. Only the
window was wrong.

So the check now **starts the installed board and fails if it cannot load
itself**, and the lesson generalises past this feature: a package that installs
is not a package that runs, and everything short of running it is a proxy.

## Not validated here

- A genuinely clean machine, or any platform other than the one this was built
  on. Both need a real publish first.
- The desktop installers — specified in [spec.md](spec.md) as FR-018 through
  FR-024 and deferred until there are signing credentials to test against.
