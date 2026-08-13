import { useState } from 'react';

import type { SessionView } from '../../../../main/view.js';
import { Section } from '../../components/Section.js';
import { CommentList } from './CommentList.js';
import { FieldList } from './FieldList.js';
import { TicketIdentity } from './TicketIdentity.js';

import './TicketView.css';

/**
 * The Ticket tab: the tracker record the work came from.
 *
 * **Nothing here is derived.** Every value on screen arrived in a
 * `/v1/ticket` call, and the board adds only the elapsed time — which it stamps
 * itself, from its own clock. It does not compare the ticket against the
 * reported stories or tasks, does not check whether the state agrees with the
 * work, and does not say whether the ticket is still current (FR-018, FR-011).
 * All three are things the board would have to see the tracker to know.
 *
 * **There is no `Availability` wrapper**, unlike the transcript sections. A
 * ticket is either reported or this destination does not exist, so there is no
 * unreadable state to model — the absence lives one level up, in the tab strip.
 *
 * Read-only, structurally: the only control in this tree is the one that hands
 * an address to the operating system, and it is the only outbound action the
 * product has.
 */

type SectionKey = 'description' | 'criteria' | 'details' | 'fields' | 'comments';

const ALL_OPEN: Record<SectionKey, boolean> = {
  description: true,
  criteria: true,
  details: true,
  fields: true,
  comments: true,
};

export function TicketView({
  session,
  now,
}: {
  session: SessionView;
  now: number;
}): React.JSX.Element | null {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(ALL_OPEN);
  const ticket = session.ticket;

  const toggle = (key: SectionKey): void => {
    setOpen((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  /*
   * Unreachable in practice — `availableTabs` does not offer this destination
   * without a ticket — and typed rather than asserted, because the alternative
   * is a non-null assertion that would be true only for as long as that rule
   * holds somewhere else.
   */
  if (ticket === null) return null;

  const details = detailRows(ticket);

  return (
    <div className="ticket" data-testid="ticket">
      <TicketIdentity ticket={ticket} reportedAt={session.ticketReportedAt} now={now} />

      {ticket.description === null ? null : (
        <Section
          label="Description"
          summary=""
          open={open.description}
          onToggle={() => {
            toggle('description');
          }}
          testId="ticket-description"
        >
          {/*
            `pre-wrap`, because the paragraph breaks are part of what the person
            who wrote the ticket wrote. Rendered as characters and never as
            markup (FR-010): what arrives here has been flattened to plain text
            by the agent, and anything that was not — a stray tag, an ADF
            fragment — shows as itself rather than being interpreted.
          */}
          <p className="ticket__prose" data-testid="ticket-description-text">
            {ticket.description}
          </p>
        </Section>
      )}

      {ticket.criteria.length === 0 ? null : (
        <Section
          label="Acceptance criteria"
          summary={`${ticket.criteria.length}`}
          open={open.criteria}
          onToggle={() => {
            toggle('criteria');
          }}
          testId="ticket-criteria"
        >
          {ticket.criteria.map((text, index) => (
            // Criteria are prose and repeat legitimately, so the index is part
            // of the key — the board does not get to drop one as a duplicate.
            <div className="ticket__criterion" key={`${index}:${text}`}>
              <span className="ticket__ordinal" aria-hidden="true">
                {index + 1}
              </span>
              <span className="ticket__criterion-text">{text}</span>
            </div>
          ))}
        </Section>
      )}

      {details.length === 0 ? null : (
        <Section
          label="Details"
          summary={`${details.length}`}
          open={open.details}
          onToggle={() => {
            toggle('details');
          }}
          testId="ticket-details"
        >
          <dl className="ticket__rows" data-testid="ticket-detail-rows">
            {details.map(([label, value]) => (
              <div className="ticket__row" key={label} data-testid={`ticket-detail-${label}`}>
                <dt className="ticket__row-label">{label}</dt>
                <dd className="ticket__row-value">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {ticket.fields.length === 0 ? null : (
        <Section
          label="From the tracker"
          summary={`${ticket.fields.length}`}
          open={open.fields}
          onToggle={() => {
            toggle('fields');
          }}
          testId="ticket-fields"
        >
          {/*
            Labelled "From the tracker" rather than "Other" or "Custom fields":
            these are not leftovers, they are the fields that tracker actually
            has, and on a board serving Azure DevOps they may be the ones that
            matter most. A dismissive heading would tell the developer the board
            thinks less of them than of the five it happens to model.
          */}
          <FieldList fields={ticket.fields} />
        </Section>
      )}

      {ticket.labels.length === 0 ? null : (
        <div className="ticket__labels" data-testid="ticket-labels">
          {ticket.labels.map((label, index) => (
            <span className="ticket__label" key={`${index}:${label}`}>
              {label}
            </span>
          ))}
        </div>
      )}

      {/*
        **Always present, even with nothing in it** — FR-017, and the one place
        this view deliberately does the opposite of FR-008.

        The difference is what an absence means. A ticket with no `sprint` is
        from a tracker that has no sprints, so a "Sprint" row would invent a
        concept; a ticket with no comments has a discussion, and it is empty.
        "Nobody has commented" is a fact a developer wants — it is the
        difference between a requirement nobody questioned and one whose
        clarification they have not been shown.
      */}
      <Section
        label="Comments"
        summary={`${ticket.comments.length}`}
        open={open.comments}
        onToggle={() => {
          toggle('comments');
        }}
        testId="ticket-comments"
      >
        <CommentList comments={ticket.comments} omitted={ticket.commentsOmitted} />
      </Section>
    </div>
  );
}

/**
 * The scalar fields the board *does* model, as label/value pairs — and only the
 * ones that were reported.
 *
 * A list rather than a fixed grid of slots, which is what makes FR-008 hold: a
 * tracker with no concept of a sprint leaves no trace of one, rather than a
 * "Sprint" heading over a dash. The order is fixed here because these are the
 * board's own labels; the agent's own fields keep the agent's order and are
 * `FieldList`'s business.
 *
 * `system` is here, printed and **never branched on**. The moment the board can
 * tell which tracker this is, it can build an address for it — and then it has
 * to be taught the next one, and the escape hatch stops being what makes a
 * second tracker an adapter instead of a release.
 */
function detailRows(ticket: NonNullable<SessionView['ticket']>): Array<[string, string]> {
  const rows: Array<[string, string]> = [];
  const add = (label: string, value: string | null): void => {
    if (value !== null && value.trim() !== '') rows.push([label, value]);
  };

  add('Tracker', ticket.system);
  add('Priority', ticket.priority);
  add('Assignee', ticket.assignee);
  add('Reporter', ticket.reporter);
  add('Sprint', ticket.sprint);

  return rows;
}
