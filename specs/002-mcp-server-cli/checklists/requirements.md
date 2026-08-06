# Specification Quality Checklist: MCP Server and CLI

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

**Two stories share P1, deliberately.** Story 2 — tools present even when the
board was closed at startup — is not a lesser variant of story 1, it is a
precondition for it. The toolset is discovered once when an agent session
begins, so a client that declines to start when the board is down leaves an
agent with no reporting ability for that entire session, including after the
board opens. Since the ordinary case is starting work *before* opening a
dashboard, treating this as a P2 refinement would misrepresent it as an
edge case when it is the common path.

**Named prerequisites as an edge case rather than assuming them.** If the
runtime the clients need is missing, the tools do not appear at all, which
presents as "the product is broken" rather than "something is not installed."
Worth a stated failure rather than silence.

**FR-019 is unusual and intentional.** It puts a requirement on tool
*descriptions* rather than behaviour, covering two facts an agent cannot infer:
that attention state is the only channel for requesting a human, and that notes
are not durable. Both follow from decisions made elsewhere, and an agent that
does not know them will behave wrongly in ways no amount of correct
implementation fixes.

**Deliberately out of scope:** how often an agent chooses to report. This
feature makes reporting possible and cheap; making it habitual is a matter of
tool descriptions and project instructions, and pretending otherwise would put
an untestable requirement in this spec.
