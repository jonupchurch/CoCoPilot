# Implementation Plan: Notes

**Branch**: `007-notes` | **Date**: 2026-08-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-notes/spec.md`

## Summary

The notes view and its unread indicator. A flat, newest-first list with a
relative-time gutter and a source line in the agent's voice, plus permanent
chrome stating that closing the window clears everything.

The append endpoint already exists (feature 001). This feature is the surface.

## Technical Context

Inherits [001/research.md](../001-push-contract-service/research.md) and the
renderer conventions from features 003–004.

**Primary Dependencies**: None beyond feature 003's.

**Constraints**: 300 notes remain scrollable and individually legible; usable at
the window minimum; nothing implies durability.

## Constitution Check

| Principle | Status | Evidence |
|---|---|---|
| I. Clarify before building | **Pass** | Four stories, no clarification markers |
| II. Validated trust boundaries | **Pass** | Note text is agent-composed; rendered as text nodes only |
| III. Match existing conventions | **Pass** | Reuses the relative-time formatter and tokens from 003–004 |
| IV. Scope discipline | **Pass** | No compose, edit, delete, pin, save, export, search, group or count — each named and excluded |
| V. Verify before done | **Pass** | [quickstart.md](quickstart.md), including a check that no durability affordance exists |
| VI. Narrate the reasoning | **Pass** | Design notes below |
| VII. Plan whole set first | **Pass** | Plan 7 of 9 |
| VIII. Test at the right level | **Pass** | Unit for the unread rule, which is the only branching logic; E2E for the view |
| IX. Atomic commits, branch | **Deferred** | As 001 |

**No violations.**

## Project Structure

```text
renderer/src/
├── views/notes/
│   ├── NotesView.tsx
│   ├── NoteRow.tsx           # text, relative time, source line
│   └── ImpermanenceFooter.tsx
├── state/
│   └── useUnread.ts          # arrival while elsewhere → dot; visit → clear
└── app/
    └── TabStrip.tsx          # gains the dot (feature 003)
```

**Structure Decision**: `ImpermanenceFooter` is its own component rather than
markup inside the view, so it is a thing that must be deliberately removed
rather than something that can be lost in a refactor. It is a requirement
(FR-006, FR-007), not decoration.

## Design notes

**Flat rows, no cards.** Density comes from the format: three lines at 13px with
no container, so forty notes scroll as one column rather than forty boxes. A
card per note would make a long session unreadable — this is the design round's
reasoning and it is the right call.

**The impermanence statement is permanent chrome, not a dismissible notice.** A
warning that can be dismissed stops being read, and this one must be as true on
the four hundredth note as the first. It is also the reason `FR-008` forbids
save, pin, archive and export: the statement and the affordances have to agree,
and the statement is the one that is true.

**The unread rule is deliberately trivial**: a note arrived while another view
was active. No count, no persistence, no per-note read state. A count would read
as an inbox to clear, and there is nothing to clear — which is exactly the
misunderstanding this feature's second P1 story exists to prevent.

**Arrival must not disturb reading.** New notes enter at the top; if the
developer has scrolled, their position is preserved rather than jumped. Nothing
steals focus, raises the window, or makes a sound.

**No grouping, filtering or search.** Named as excluded now and recorded as the
obvious future addition, so it is a deferral rather than an oversight.

## Post-design Constitution re-check

Still passing. The interesting one is principle IV in a slightly unusual form:
here the discipline is about *not adding affordances that would make an honest
statement dishonest*. A pin button would not break any code — it would falsify
the footer. That is why the exclusions are requirements with a test that asserts
their absence.
