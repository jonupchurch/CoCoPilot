# Tasks: Window Shell

**Input**: Design documents from `specs/003-window-shell/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md),
[quickstart.md](quickstart.md), plus the two stack packs
[`stacks/electron.md`](../../stacks/electron.md) and
[`stacks/vite-react.md`](../../stacks/vite-react.md), which govern from here on
because this is the first feature to write framework code.

Features 001 and 002 are merged: `createService()` returns `{ port, store }`,
and `store.subscribe()` is the in-process notification decision 28 settled.

**Tests**: Included. Two of this feature's guarantees are stated as absences —
nothing changes on a timer (SC-006) and agent text never executes (SC-009) — and
neither is caught by a test that only checks the happy path.

## Format: `[ID] [P?] [Story] Description`

## Design tokens, extracted from the exports

The round 1–3 exports are canon for look and feel (decision 8). Pulled out of
`resources/CoCoPilot Design System.dc.html` so `tokens.css` is a transcription
rather than an invention:

| Token | Value | Use |
|---|---|---|
| `--teal` | `#37BDA9` | Action, and the `watching` chip |
| `--blue` | `#7FB2E8` | Working — the `thinking` chip |
| `--ember` | `#F6A06B` | Attention — `needs-you`. Never decorative |
| `--bg` / `--surface` / `--raised` / `--line` / `--muted` / `--ink` | `#0E0D0C` `#1A1817` `#221F1D` `#2B2724` `#948A7F` `#EFF3F4` | Ground and ink |
| `--teal-tint` / `--blue-tint` / `--ember-tint` | `#1C2A28` `#1E2630` `#2A2119` | Fills behind small signal text |

Type: Figtree for prose, JetBrains Mono for anything the machine wrote.
display 18·700, title 15·700, body 13·400, meta 12·500, code 12·400,
label 11·500 uppercase with `.16em` tracking. **11px is the floor**, and only
for uppercase mono labels.

Space: 4px step. Panel padding 16, row gap 8, section gap 16.
Radius: 16 panel, 12 card, 8 field, 999 pill.
Elevation: only the window floats; inside the panel depth is a border.
Controls: 28px standard height, and hit targets stay 28px.

## One conflict with the export, resolved

**The title bar shows the repository as well as the branch.** Round 3's export
shows `CoCoPilot · feat/session-hook` — brand and branch, no repository. FR-001
requires both. Decision 8 makes the exports canon for look and feel and the docs
authoritative on incidental content, so the repository goes in the same slot with
the same treatment: mono, `--muted`, ellipsised, `min-width: 0`. Its basename
only, with the full path as a tooltip, because the slot is narrow and a path is
long.

## Path conventions

```text
apps/board/src/
├── main/window.ts        # BrowserWindow, minimum size, IPC
├── preload/index.ts      # contextBridge only. No logic.
└── renderer/             # No node: imports, ever
```

---

## Phase 1: Setup

- [ ] T001 Add `electron-vite` config at `apps/board/electron.vite.config.ts` with three builds — main, preload, renderer — and the React plugin
- [ ] T002 [P] Split `apps/board/tsconfig.json` into `tsconfig.node.json` (main + preload, Node libs) and `tsconfig.web.json` (renderer, DOM libs, no `node:`), per the stack pack's three-tsconfigs rule
- [ ] T003 [P] Add `dev`, `build`, `start` and `test:e2e` scripts to `apps/board/package.json`, and `test:e2e` at the root
- [ ] T004 [P] Add `playwright.config.ts` at the repository root, configured for Electron with no web server
- [ ] T005 Confirm `npm run typecheck` and `npm test` are still clean with the new configs

---

## Phase 2: Foundational

- [ ] T006 [P] Create `apps/board/src/renderer/src/tokens.css` — the table above, transcribed. Every value a CSS variable; a hex literal anywhere else is a bug
- [ ] T007 Create `apps/board/src/preload/index.ts` — `contextBridge.exposeInMainWorld('cocopilot', { getState, subscribe })`. Functions only, never `ipcRenderer`, no logic: it is a wire, not a layer
- [ ] T008 Create `apps/board/src/main/window.ts` — one `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, a minimum size, and no code path that resizes it
- [ ] T009 Wire the service into `apps/board/src/main/app.ts` — start `createService()`, register `ipcMain.handle` for the initial read, and forward `store.subscribe()` to `webContents.send`
- [ ] T010 [P] Create `apps/board/src/renderer/src/lib/elapsed.ts` — a timestamp to `40s`, `4m`, `2h`, `3d`. Pure, and a *measurement*: it never returns a judgement at any duration
- [ ] T011 Create `apps/board/src/renderer/src/state/useBoardState.ts` — one subscription, fetched once on mount then updated by push. The only entry point, because a component fetching its own copy would reintroduce polling by the back door

**Checkpoint**: A window opens and can read held state.

---

## Phase 3: User Story 1 — Identity and liveness (Priority: P1) 🎯 MVP

**Goal**: Repository, branch, how long since the last report, and whether
attention is wanted — all readable at a glance, none of it inferred.

**Covers**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-020, SC-001, SC-002

- [ ] T012 [P] [US1] Write `apps/board/src/renderer/src/lib/elapsed.test.ts` — every band, the boundaries between them, and that a very large elapsed time stays a measurement rather than becoming "stalled"
- [ ] T013 [US1] Create `apps/board/src/renderer/src/app/TitleBar.tsx` — the brand mark, repository, branch, elapsed, and the chip, laid out per the export
- [ ] T014 [US1] Create `apps/board/src/renderer/src/app/Chip.tsx` — the four reported states with their tint/ink pairs, rendering only what the agent reported and deriving nothing
- [ ] T015 [US1] Tick the elapsed display on a coarse interval in `useBoardState.ts`, **fetching nothing**. The one permitted timer, and it must never be allowed to grow into a refresh
- [ ] T016 [P] [US1] Write `apps/board/src/renderer/tests/e2e/identity.spec.ts` — report a session, assert repository, branch, elapsed and chip; assert `needs-you` is visually distinct from `watching`

---

## Phase 4: User Story 2 — The waiting state (Priority: P2)

**Goal**: A screen seen on *every* launch, because nothing survives a restart —
so it is a primary layout, not a fallback.

**Covers**: FR-007, FR-008, FR-009, FR-010, FR-011, SC-005, SC-007

- [ ] T017 [US2] Create `apps/board/src/renderer/src/app/WaitingState.tsx` — "Waiting for an agent", the listening pill, and the line stating the agent supplies everything and there is nothing to set up
- [ ] T018 [US2] Create `apps/board/src/renderer/src/app/TabStrip.tsx` — hidden **entirely** when nothing has been reported. Four tabs leading to four empty views would be four dead ends
- [ ] T019 [US2] Create `apps/board/src/renderer/src/app/App.tsx` — the shell choosing between the waiting state and the populated frame
- [ ] T020 [P] [US2] Write `apps/board/src/renderer/tests/e2e/waiting-state.spec.ts` — launched empty it says it is waiting and offers no tab strip; a first report populates it with no restart; the title bar says "nothing heard yet" rather than a fake elapsed time

---

## Phase 5: User Story 3 — The window stays where it was put (Priority: P3)

**Covers**: FR-012, FR-013, FR-014, FR-017, FR-019, SC-003, SC-008

- [ ] T021 [US3] Hold the active tab in `App.tsx` as view state, not a route — giving tabs URLs would invent history and back semantics a single desktop panel does not have
- [ ] T022 [P] [US3] Write `apps/board/src/renderer/tests/e2e/resize.spec.ts` — width survives every tab switch; a resize is honoured; the minimum is enforced; an arriving report leaves the active tab and scroll position alone

---

## Phase 6: User Story 4 — A short window stays usable (Priority: P4)

**Covers**: FR-015, FR-016, SC-004

- [ ] T023 [US4] Make the body the one scroll container in `App.tsx`, with the title bar and tab strip fixed above it, and section headers sticky so a section's label and summary stay legible while its contents pass behind
- [ ] T024 [P] [US4] Write `apps/board/src/renderer/tests/e2e/layout.spec.ts` — at the minimum size, no horizontal scroll anywhere and no clipped content; a long repository path and branch degrade without breaking identity or liveness

---

## Phase 7: Polish & the two absences

- [ ] T025 [P] Write `apps/board/src/renderer/tests/e2e/no-timer-changes.spec.ts` — report once, then leave the window alone: the **only** thing that changes is the elapsed counter, and no IPC or network traffic occurs meanwhile. This is what catches a polling loop or a staleness badge added later as an apparent improvement (SC-006)
- [ ] T026 [P] Write `apps/board/src/renderer/tests/e2e/inert-text.spec.ts` — a branch, prose and a task title each containing `<script>` render as visible characters and execute nothing; assert no `dangerouslySetInnerHTML` exists anywhere in the renderer source (SC-009)
- [ ] T027 Walk both stack-pack checklists: no `node:` import resolves in the renderer build, no colour literal outside `tokens.css`, no timer fetches data, and the app quits without an orphaned server
- [ ] T028 Run `npm run typecheck`, the full suite, the Playwright suite and a packaged `build`, then walk the six scenarios in [quickstart.md](quickstart.md)
- [ ] T029 [P] Update `CHANGELOG.md` and `STATUS.md`
- [ ] T030 Read back the full diff, then merge

---

## Dependencies

Setup → Foundational → US1 → US2 → US3 → US4 → Polish. US2's `App.tsx` is where
US3's view state and US4's scroll container also live, so those three phases
serialise on one file even though their tests are independent.

## What is deliberately not here

A router, a state library, remembered window geometry, a settings panel, a
refresh button, and the tab *contents* — which are features 004 through 008.
A window shell is where scope creep is cheapest and most tempting; the two
exclusions that would break guarantees if they crept back (a refresh button and
a data timer) are covered by T025 rather than by discipline alone.
