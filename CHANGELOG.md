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
  Control". The repo directory and the GitHub remote are still `skmc`.
- **Stack decided:** Vite + React, wrapped in Electron for Windows, macOS and
  Linux. Electron over Tauri so the MCP server, HTTP API and file watching all
  run in the Node main process — one TypeScript codebase, no sidecar.
- **Interface surfaces decided:** MCP server + HTTP API + CLI.
- **Architecture deliberately reopened.** The previous round's controller+windows
  model, two-layer data model, and never-writes-to-the-repo constraint are
  inputs to the new design, not settled state. See [STATUS.md](STATUS.md).
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
