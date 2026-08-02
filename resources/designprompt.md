You are designing (NOT building) a standalone "Spec-Kit Mission Control" app: an MCP
server + live web board for working with GitHub Spec-Kit repositories. Your job in this
session is to produce a design, not code.

WHAT THE APP IS FOR
Let a human watch a live board while an AI agent (e.g. Claude Code running
/speckit.implement) does the work: the agent reports current task, checks off tasks,
posts status updates and blockers, and the human browses specs, plans, and resources.

BACKGROUND ON SPEC-KIT (verify this yourself first)
Spec-Kit is file-based and git-tracked. Features live in specs/NNN-feature-name/ with
spec.md, plan.md, tasks.md, and optionally research.md, data-model.md, and contracts/.
There is a project-wide .specify/memory/constitution.md. tasks.md is a checklist with
task IDs (T001...), phase/user-story headers, an optional [P] parallel marker, and
dependency notes.

STEP 0 — GROUND THE DESIGN IN REALITY
Before designing anything, inspect a real Spec-Kit project (search the web / read the
github/spec-kit repo and its templates) and document the ACTUAL format of tasks.md,
spec.md, plan.md, and the .specify/ layout. Capture concrete examples. Call out anything
that varies between versions or agents. Do not design on top of assumptions.

DESIGN DELIVERABLES (write these as markdown files in a docs/design/ folder)
1. overview.md — problem statement, goals, non-goals, the primary "watch the board while
   the AI works" user journey, and 2-3 secondary journeys.
2. architecture.md — component breakdown (parser/core, MCP server, web board, live-sync
   layer), how they communicate, and a simple diagram (mermaid). Recommend a stack
   (TypeScript monorepo vs Python) and justify it; note the runner-up and why not.
3. data-model.md — the parsed representation of features/tasks/resources, and the source-
   of-truth decision. Establish the principle that the filesystem is authoritative and no
   database duplicates spec/task state.
4. mcp-surface.md — the full MCP tool catalog: for each tool, name, purpose, input schema,
   output shape, side effects, and an example call/response. Cover reading specs, browsing
   resources, listing tasks, setting task status, setting current task, posting updates,
   and reporting blockers.
5. state-storage.md — resolve the hardest question: task status/metadata live where?
   Analyze options (checkbox-only in tasks.md, sidecar JSON per feature, single index
   file, git notes) against these criteria: git-diff friendliness, ability to hold
   timestamps/notes/blocked-state/activity-log, resistance to drift, and merge behavior.
   Give a clear recommendation with rationale and the rejected alternatives.
6. web-board.md — screen inventory and low-fidelity wireframes (ASCII or mermaid):
   Kanban (grouped by status, toggle to phase/user-story), feature switcher + progress,
   "currently working on" banner, live activity/blocker feed, and the spec/resource viewer.
   Describe the live-update mechanism.
7. decisions.md — an ADR-style list of every decision made, each with context, options,
   choice, and consequences.
8. open-questions.md — everything that needs MY input before implementation, phrased as
   concrete either/or questions with your recommended default for each.

RULES
- No implementation code. Type definitions, schemas, pseudo-code, and diagrams are fine;
  runnable app code is not.
- Prefer prose and diagrams over hand-waving. Where you make an assumption, mark it
  ASSUMPTION and add it to open-questions.md.
- Optimize for a design I can hand to a future "build" session as the single source of truth.

Start with Step 0 and share what you find about the real file formats before moving on to
the design docs. Pause for my review after the grounding step, and again after the first
draft of all docs.