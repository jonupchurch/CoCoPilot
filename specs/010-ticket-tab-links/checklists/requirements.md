# Specification Quality Checklist: Ticket Tab and Openable Links

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-12
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

**This is the only tab that is ever absent, and that needs saying out loud.**
Feature 003's rule was that a destination whose view would be empty is not
offered; that rule was superseded a week ago precisely because gating on
*content* let a report take a tab away from someone mid-read. FR-001 gates a
destination again, and the spec is only defensible because it gates on a
different thing: whether the session has a ticket *concept* at all, not whether
this snapshot happens to carry one. A session working from repository specs will
never have a ticket, however long it runs. That is the empty-versus-unavailable
distinction the product already draws, applied one level up.

**FR-003 is the guard that keeps it honest**, and it is the requirement most
likely to be dropped as an implementation detail. Presence is sticky for the life
of the session: a later report carrying no ticket must not withdraw the tab. Any
implementation that reads the current snapshot alone will pass every other
requirement here and reintroduce exactly the failure that superseded FR-009. It
is called out in the assumptions as a deliberate exception to reports replacing
wholesale, because that is where the cost lands.

**Story 2 is the first outbound action in the product's history**, and it is
ranked P2 rather than P1 on purpose. The tab is useful without it, so the link
can be built second and carefully — which matters, because the addresses being
opened are composed by an agent, and any local process may report to this board.
FR-021 and FR-022 together are the whole mitigation: only ordinary web addresses
are openable, and an address that is not one is **refused rather than repaired**.
Repairing it would mean guessing what the sender meant, which is the same
position the product already took when it declined to sanitise a reported
identifier.

**FR-024 is two absences, not one.** Nothing goes to the agent, *and* the
application makes no request of its own to the address. The second is easy to
overlook: showing a preview, resolving a redirect, or fetching a title would all
be the board reaching out to a tracker, which assumption one forbids outright.
Handing the address to the browser is the entire action.

**"Ordinary web address" is deliberately not a technical definition.** The
specification says what the developer sees; the edge cases name what is excluded
— a local file, a script, a registered application handler — and SC-004 requires
all three to be attempted and observed not to open. Pinning the exact rule is a
planning matter, and it belongs where it can be enforced in one place rather than
described in prose here.

**FR-012 is what makes the feature outlive its first tracker.** An unmodelled
field is displayed as a labelled value rather than dropped, so a second tracker
is an agent-side adapter and no product change at all. SC-010 tests it the only
way that means anything: with a ticket carrying no recognised field but its
identity. Without that requirement the board would learn what one tracker looks
like and need surgery for the next.

**FR-026 and FR-027 settle a real conflict rather than deferring it.** Reported
text is length-limited and a limit refuses rather than truncates, because
shortening an agent's words would put text on the board that nobody wrote. Real
ticket descriptions exceed the limit that prose fields were sized for. The
resolution is a larger limit for those fields *and* an explicit refusal beyond
it, naming the field — so a shortened description is always one the agent chose
and can say it chose. The board never silently becomes the editor.

**FR-018 declines a comparison the board could easily make.** Once a ticket and
the agent's own stories and tasks are both on screen, computing a disagreement
between them is a few lines away and would be the board grading the agent. That
is refused here for the same reason it is refused everywhere else: this is an
observer that keeps information straight, not an auditor.

**One thing is knowingly deferred to design rather than settled here.** An
additional destination competes for width at the minimum window size, and the
existing design exports show the current four. FR-006 and SC-008 state the bar it
has to clear; how it clears it — including shortening an existing label, which is
available — is a design revision this feature owes and does not pre-empt.
