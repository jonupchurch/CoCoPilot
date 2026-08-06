# Specification Quality Checklist: Multiple Sessions

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

**The P1 story is that nothing appears.** "Nothing changes when there is only
one session" outranks the switcher itself, because most sessions are single and
permanent navigation for an occasional case would tax every ordinary use.
Writing the absence as a testable story means it gets verified rather than
assumed — SC-001 compares against the single-session design directly.

**Story 3 shares P2 with the switcher for a structural reason.** Attention state
is the *only* channel an agent has for asking for a human, since the board never
escalates on its own. Showing one session at a time without surfacing that
state on unselected pills would silently drop that channel for every session but
one — turning a feature that adds capability into one that removes it. It is not
a refinement of the switcher; it is the condition that makes the switcher safe.

**FR-009 and SC-003 forbid auto-switching**, which is the most tempting
"helpful" behaviour here. Jumping to a session that needs attention would move
the board out from under someone mid-read, and would let one agent seize the
view from another. The pill carries the signal; the human decides.

**FR-004 forbids reordering**, including by recency. Pills carry live state and
get glanced at rather than read, so a stable position is something a developer
learns over a session. Recency sorting would move the target while they reach
for it — and the thing that moves would be exactly the one they are aiming at.

**SC-008 is stated as an absence over unbounded time:** leave sessions idle
indefinitely and observe none disappear. That is the check that no expiry logic
crept in, which would be the same timed judgement the product refuses to make
everywhere else.

**FR-015 addresses a known-thin point rather than papering over it.** The
dismiss control must convey that it clears a copy rather than closing something.
A dismissed session reappearing looks like a bug to anyone who read the control
as "close", and this is acknowledged as imperfect wording rather than solved.
