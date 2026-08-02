# CLAUDE.md

Always-on operating context for this session. The shared, tool-neutral rules
live in `@AGENTS.md` — read them; they govern how to work here.

@AGENTS.md

## What this project is

**skmc — Spec-Kit Mission Control**: an MCP server + live web board for working
with GitHub Spec-Kit repositories, so a human can watch a board while an AI
agent implements tasks. `resources/designprompt.md` is the brief; design docs
land in `docs/design/`; prior design output sits in `resources/`. The stack is
not yet chosen — that's an open decision in the design.

Note the recursion: this repo *uses* Spec-Kit (`.specify/`, `specs/`) and is
also *about* Spec-Kit. Our own spec state is real project state and is tracked
in git, not ignored.

## Claude Code toolkit available in this repo

This repo carries the portable `ai-tools` toolkit (`.claude/` + `.specify/`),
copied in from `../ai-tools`. `MANIFEST.md` is the full routable catalog (every
asset, its trigger, and how to invoke it); the highlights:

- **`codebase-scout` subagent** — read-only reconnaissance. Spin it off in the
  background to map an unfamiliar repo (architecture, relevant files, existing
  patterns, open questions) while the foreground conversation continues. Never
  edits, commits, or installs.
- **`verifier` subagent** — drives the golden path and runs the test suite,
  reports pass/fail with evidence. Use it to satisfy rule 5 (Verify) as a
  delegable job.
- **`diff-reviewer` subagent** — read-only readback of the current diff for
  scope creep, convention mismatch, and obvious bugs (rules 3 + 5).
- **Slash commands** (`.claude/commands/`): `/orient`, `/mini-spec`, `/verify`,
  `/commit`, `/pr` — the loop encoded as one-keystroke actions.
- **Spec-Kit** (`.specify/` + `speckit-*` skills): when there's real time,
  `speckit-specify → speckit-plan → speckit-tasks → speckit-implement`. The
  cheat sheet + these rules are the realistic path when there isn't.
- **Stack packs** (`stacks/`): repo-local conventions for specific frameworks.
  None yet — the stack is undecided. Add `stacks/<framework>.md` (shape per
  `stacks/README.md`) once the architecture doc picks one, and read it before
  writing framework code.

## Default posture

Prefer delegating investigation you don't need to watch (`codebase-scout`,
`/orient`) so the foreground stays free for scoping and decisions. Default to
matching what's already in the target repo over anything in this toolkit — the
toolkit is a starting point, not inherited authority.
