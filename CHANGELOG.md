# Changelog

All notable changes to CoCoPilot are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project is pre-release and not yet versioned.

## [Unreleased]

### Design

- **Design restarted 2026-08-06.** `resources/` was emptied — the round 1–3
  wireframes and versioned design prompts from the previous round are gone, and
  a new round is being written. The product itself is unchanged.
- **Renamed to CoCoPilot** (as in *Co-Copilot*), from "skmc — Spec-Kit Mission
  Control", and republished to a new public repo,
  [`jonupchurch/CoCoPilot`](https://github.com/jonupchurch/CoCoPilot). The
  previous private `jonupchurch/skmc` repo is untouched and remains wired up as
  the `skmc-old` remote.
- **Stack decided:** Vite + React, wrapped in Electron for Windows, macOS and
  Linux. Electron over Tauri so the MCP server, HTTP API and file watching all
  run in the Node main process — one TypeScript codebase, no sidecar.
- **Interface surfaces decided:** MCP server + HTTP API + CLI.
- **Architecture deliberately reopened.** The previous round's controller+windows
  model, two-layer data model, and never-writes-to-the-repo constraint are
  inputs to the new design, not settled state. See [STATUS.md](STATUS.md).
- **State ownership decided:** the Electron main process owns all state and it
  is volatile and in-memory. Repo files stay truth on disk and are re-read, not
  stored; agent narration is push-only and lost on restart. No always-on daemon,
  no buffering, no auto-spawn — when the app is not running, the MCP server, the
  CLI and the HTTP API simply do not respond. The MCP server must still start
  cleanly with the app down and connect lazily per call, because Claude Code
  discovers an MCP tool list only once, at session start.
- **Push model decided:** agents push typed facts plus a free-text field for the
  human; the board owns layout. Agents never specify presentation.
- **Spec-Kit format grounding retained.** The findings verified against
  `../LMNTLZ` (21 features, 1,076 task lines, Spec-Kit 0.12.12.dev0) are
  empirical and survive the restart — notably `- [x]` ×554 vs `- [X]` ×341
  inside a single repo, which would break a case-sensitive parser.

### Added

- **Spec-Kit + ai-tools scaffolding.** Copied the portable toolkit from
  `../ai-tools` per its bootstrap instructions: `.specify/` (Spec-Kit engine —
  templates + PowerShell automation), `.claude/` (the `speckit-*` skills, the
  `codebase-scout` / `verifier` / `diff-reviewer` subagents, the `/orient`,
  `/mini-spec`, `/verify`, `/commit`, `/pr` commands, and the read-only
  permission allowlist), `stacks/README.md`, `docs/interview-cheat-sheet.md`,
  and the `AGENTS.md` / `CLAUDE.md` / `MANIFEST.md` operating context.
- `.gitignore` — deliberately does **not** ignore `specs/` or
  `.specify/feature.json`. In the source `ai-tools` repo those are ignored
  because it ships the engine without project state; here they are the
  project's own tracked state.
- `CHANGELOG.md` and `STATUS.md`.
- Git repository initialized (`main`) and pushed to GitHub.

### Notes

- Engine verified in place: `create-new-feature.ps1 -DryRun` resolves the repo
  root to `D:\Codelib\skmc`, all four templates resolve to `.specify/templates/`,
  and commands format as `/speckit-<name>` (hyphen separator, per
  `.specify/integration.json`).
- No implementation code yet — this is a design-first project. See
  [STATUS.md](STATUS.md).
