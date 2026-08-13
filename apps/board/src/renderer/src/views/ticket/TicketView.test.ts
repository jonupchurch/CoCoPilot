import { Ticket } from 'cocoapilot-contract';
import { describe, expect, it } from 'vitest';

import { detailRows } from './TicketView.js';

/**
 * The only branching in the ticket view, tested directly.
 *
 * Everything else in `views/ticket/` is a component that draws what it is given
 * and is covered end-to-end; this decides *whether a row exists at all*, which
 * is where FR-008 actually lives — "omit any field that was not reported, rather
 * than showing it as blank, unknown, or a value of its own".
 *
 * Co-located per the renderer stack pack, and pure so it needs no React testing
 * library, following `summarise.ts` and `vocabulary.ts`.
 */
const ticket = (overrides: Record<string, unknown> = {}): ReturnType<typeof Ticket.parse> =>
  Ticket.parse({ key: 'PROJ-1', title: 'A ticket', ...overrides });

describe('detailRows', () => {
  it('returns nothing at all for a ticket carrying only what is required', () => {
    // Not five rows with empty values, and not a "Details" section with nothing
    // in it: the caller drops the whole section on an empty list.
    expect(detailRows(ticket())).toEqual([]);
  });

  it('returns only the fields that were reported, in the board s own order', () => {
    // The order here is fixed because these are the board's labels. The agent's
    // own fields keep the agent's order, and that is `FieldList`'s business.
    expect(
      detailRows(ticket({ sprint: 'Sprint 42', system: 'Jira', assignee: 'A. Developer' })),
    ).toEqual([
      ['Tracker', 'Jira'],
      ['Assignee', 'A. Developer'],
      ['Sprint', 'Sprint 42'],
    ]);
  });

  it('drops a field whose reported value is only whitespace', () => {
    /*
     * The branch no end-to-end test reaches, and it is not hypothetical: an
     * adapter reading an unassigned Jira ticket can easily send `" "` rather
     * than omitting the field. Without this the board draws an "Assignee" row
     * with nothing beside it, which reads as *the tracker* having an assignee it
     * would not name — a claim nobody made.
     */
    expect(detailRows(ticket({ assignee: '   ', priority: '\t\n' }))).toEqual([]);
  });

  it('keeps a value whose text is only punctuation or a dash', () => {
    // The rule is "nothing was reported", not "the board judges it meaningless".
    // A tracker whose priority really is `-` gets to say so.
    expect(detailRows(ticket({ priority: '-' }))).toEqual([['Priority', '-']]);
  });

  it('keeps every value exactly as reported, without trimming it', () => {
    // Whitespace decides whether a row *exists*; it never edits the value shown.
    // Trimming here would be the board quietly rewriting somebody else's record.
    expect(detailRows(ticket({ assignee: ' A. Developer ' }))).toEqual([
      ['Assignee', ' A. Developer '],
    ]);
  });

  it('names every field the board models, and no others', () => {
    // A counting assertion: a sixth modelled field is a design decision about
    // which parts of a tracker the board claims to understand, and it should not
    // be possible to add one without editing a test.
    const all = detailRows(
      ticket({
        system: 'Jira',
        priority: 'High',
        assignee: 'A. Developer',
        reporter: 'A. Tester',
        sprint: 'Sprint 42',
        // Reported, and deliberately *not* rows here — they have their own
        // treatment in the view.
        type: 'Bug',
        state: 'In Progress',
        url: 'https://example.com/PROJ-1',
      }),
    );

    expect(all.map(([label]) => label)).toEqual([
      'Tracker',
      'Priority',
      'Assignee',
      'Reporter',
      'Sprint',
    ]);
  });
});
