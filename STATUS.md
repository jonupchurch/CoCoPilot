# Status

**Project:** skmc — Spec-Kit Mission Control. An MCP server + live web board for
GitHub Spec-Kit repositories, so a human can watch a board while an AI agent
(e.g. Claude Code running `/speckit-implement`) does the work.

**Phase:** Design. No implementation code exists, and per
[designprompt.md](resources/designprompt.md) none should be written until the design docs
are reviewed.

**Last updated:** 2026-08-02

## Where things stand

| Area | State |
|---|---|
| Repo scaffolding | ✅ Done — toolkit copied from `../ai-tools`, engine dry-run verified |
| Git | ✅ Initialized on `main`, pushed to GitHub |
| Design brief | ✅ [designprompt.md](resources/designprompt.md) |
| Step 0 — ground the design in the real Spec-Kit formats | ⬜ Not started |
| Design docs (`docs/design/`) | ⬜ Not started (8 deliverables, below) |
| Stack decision | ⬜ Open — TypeScript monorepo vs Python, to be argued in `architecture.md` |
| Feature specs (`specs/`) | ⬜ None yet |
| Implementation | ⬜ Blocked on design review |

## Design deliverables

All eight land in `docs/design/`, per the brief. Two review gates: after Step 0
grounding, and after the first full draft.

- ⬜ `overview.md` — problem, goals/non-goals, primary + secondary journeys
- ⬜ `architecture.md` — components, communication, mermaid diagram, stack recommendation + runner-up
- ⬜ `data-model.md` — parsed representation; filesystem is authoritative, no DB duplicating spec/task state
- ⬜ `mcp-surface.md` — full MCP tool catalog with schemas and example calls
- ⬜ `state-storage.md` — where task status/metadata live (checkbox-only vs sidecar JSON vs index file vs git notes)
- ⬜ `web-board.md` — screen inventory, wireframes, live-update mechanism
- ⬜ `decisions.md` — ADR-style log
- ⬜ `open-questions.md` — either/or questions with recommended defaults

## Prior art in the repo

`resources/` holds two Claude artifact exports from an earlier design pass:
`Design Plan.dc.html` ("Spec-Kit Mission Control") and
`Mission Control Wireframes.dc.html` (includes a "Three decisions worth arguing
about" section). **Caveat:** both load a `./support.js` that was not exported
with them, so they will not render as-is in a browser — their content is
embedded as data in the HTML and can be read from source, or the files can be
re-exported with the support script.

## Notable wrinkle

This repo both *uses* Spec-Kit and is *about* Spec-Kit. Our own `.specify/` and
`specs/` are real, tracked project state — while the app being designed reads
those same structures in *other* repos. Keep the two roles distinct when
writing specs and, later, test fixtures.

## Working agreements

The nine rules in [AGENTS.md](AGENTS.md) govern (auto-loaded via
[CLAUDE.md](CLAUDE.md)); [MANIFEST.md](MANIFEST.md) is the routable catalog of
every toolkit asset. Relevant here:

- **Rule 7** — plan the whole initial feature set (`speckit-specify` →
  `speckit-plan` across all of it) before implementing any of it.
- **Rule 9** — feature work happens on a feature branch, not `main`. The
  scaffolding commit is on `main` because the repo needed a root commit.
