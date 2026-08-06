# Implementation Plan: Window Shell

**Branch**: `003-window-shell` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-window-shell/spec.md`

## Summary

The first visible feature: one Electron window rendering identity, liveness,
navigation and emptiness, subscribed in-process to the store from feature 001.

Approach: `contextBridge` exposes a minimal subscribe-and-read surface; the
renderer fetches once on mount and applies pushed updates thereafter. Tabs are
view state, not routes. The window never changes its own size and nothing on
screen changes on a timer except the elapsed-time display, which re-renders
existing state rather than fetching anything.

## Technical Context

Inherits [001/research.md](../001-push-contract-service/research.md).
Feature-specific:

**Primary Dependencies**: Electron, Vite, React 19, TypeScript. No router, no
state library, no component framework — see design notes.

**Stack packs**: [`stacks/electron.md`](../../stacks/electron.md) and
[`stacks/vite-react.md`](../../stacks/vite-react.md), written for this feature
since it is the first to produce framework code, per the repo's instructions.

**Performance Goals**: Update visible within one frame of a report arriving;
zero CPU while idle apart from the elapsed-time tick.

**Constraints**: `contextIsolation` on, `nodeIntegration` off, `sandbox` on —
this window renders text composed by an AI agent. Minimum window size enforced.

## Constitution Check

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Four prioritised stories, no clarification markers |
| II. Validated trust boundaries | **Pass** | IPC treated as a boundary and validated; all agent text rendered as text nodes only |
| III. Match existing conventions | **Pass** | Stack packs written first and followed; design tokens from the round 1–3 exports, which are canon |
| IV. Scope discipline | **Pass** | No router, no state library, no window-position persistence, no tab contents — each named and excluded |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md), including a test that asserts nothing changes on a timer |
| VI. Narrate the reasoning | **Pass** | Design notes below carry rationale and cost |
| VII. Plan whole set first | **Pass** | Plan 3 of 9 |
| VIII. Test at the right level | **Pass** | Unit for elapsed formatting and state selection; Playwright end-to-end for the window, which is where the risk actually is |
| IX. Atomic commits, branch | **Deferred** | As 001 |

**No violations.**

## Project Structure

```text
apps/board/src/
├── main/
│   └── window.ts              # BrowserWindow, minimum size, no self-resize
├── preload/
│   └── index.ts               # contextBridge: getState, subscribe
└── renderer/
    ├── index.html
    ├── src/
    │   ├── app/
    │   │   ├── App.tsx         # shell: title bar, tab strip, active view
    │   │   ├── TitleBar.tsx    # repo, branch, elapsed, chip
    │   │   ├── TabStrip.tsx    # hidden entirely when there is nothing
    │   │   └── WaitingState.tsx
    │   ├── state/
    │   │   ├── useBoardState.ts   # one subscription; the only entry point
    │   │   └── selectors.ts
    │   ├── lib/
    │   │   └── elapsed.ts      # "40s ago", "4m", "2h"
    │   ├── tokens.css          # the design system, one definition
    │   └── main.tsx
    └── tests/
        └── e2e/
            ├── waiting-state.spec.ts
            ├── identity.spec.ts
            ├── no-timer-changes.spec.ts   # SC-006, stated as an absence
            └── resize.spec.ts
```

**Structure Decision**: The renderer is a plain Vite React app with no router
and no state library. Tabs are view state — giving them URLs would invent
navigation semantics (history, deep links, back) that a single desktop panel
does not have and that decision 2's SPA cost note warned about. One subscription
plus context is sufficient for a window with a single source of truth; a state
library would be ceremony over an `EventEmitter`.

## Design notes

**One subscription, in `useBoardState`.** Every view reads from it. This is the
guard against the failure the design is most exposed to: a component that
fetches its own copy would reintroduce polling by the back door.

**Fetch once on mount, then apply pushes.** A renderer that only subscribes
shows nothing until the next report — for an idle session, potentially forever.
The initial read is what makes reopening the window on a quiet session work.

**Elapsed time is derived at render, never stored.** `lastHeardAt` is a
timestamp; "40s ago" is a formatting of it. Storing the string would make it
wrong a second later, and would put a judgement where the design demands a fact.

**The elapsed tick is the one permitted timer, and it fetches nothing.** It
re-renders existing state on a coarse interval so a counter advances. Worth
stating explicitly because [`stacks/vite-react.md`](../../stacks/vite-react.md)
forbids data timers, and this is the exception that proves it — it must never be
allowed to grow into a refresh.

**The waiting state hides the tab strip entirely.** Four tabs leading to four
empty views would be four dead ends. Since nothing survives a restart, this
screen is seen on every launch, so it is a primary layout rather than a fallback.

**Window position and size are not persisted.** Consistent with holding no
durable state — and flagged in the spec as the one place that rule costs
ergonomics rather than correctness. Revisit if it proves annoying; do not
quietly add a settings file.

## Post-design Constitution re-check

Still passing. Principle IV is doing the most work here: a window shell is where
scope creep is cheapest and most tempting — a settings panel, a router, remembered
geometry, a refresh button. Each is excluded by name, and the two that would
break guarantees (a refresh button, a data timer) are covered by tests asserting
absence rather than by discipline alone.
