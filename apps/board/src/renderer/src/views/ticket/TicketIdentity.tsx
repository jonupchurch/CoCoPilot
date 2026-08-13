import { isOpenable, type Ticket } from 'cocoapilot-contract';

import { StatusLabel } from '../../components/StatusLabel.js';
import { focusAge } from '../../lib/elapsed.js';
import { openLink } from '../../state/useBoardState.js';

import './TicketIdentity.css';

/**
 * What the ticket *is*: key, title, state, where it lives, and how long ago the
 * agent read it.
 *
 * Every field here is conditional, because every one of them is nullable in the
 * contract. FR-008 wants an unreported field **absent** — not blank, not
 * "unknown", and above all not filled in by the board. A tracker that has no
 * concept of a sprint should leave no trace of one.
 *
 * The address is drawn as text whether or not it can be opened (FR-021), and
 * that is also what satisfies FR-025: the developer sees where a link leads
 * because it is written on screen, not because they hovered something and
 * discovered a preview.
 */
export function TicketIdentity({
  ticket,
  reportedAt,
  now,
}: {
  ticket: Ticket;
  reportedAt: number | null;
  now: number;
}): React.JSX.Element {
  return (
    <header className="ticketid" data-testid="ticket-identity">
      <div className="ticketid__meta">
        <span className="ticketid__key" data-testid="ticket-key" title={ticket.key}>
          {ticket.key}
        </span>
        {ticket.type === null ? null : (
          <span className="ticketid__type" data-testid="ticket-type">
            {ticket.type}
          </span>
        )}
        {/*
          Through `StatusLabel`, never classified here. A ticket's state is a
          status, and `tests/source-hygiene.test.ts` fails the build if any file
          outside the vocabulary decides what one means — which is what stops a
          tracker's `Done` from being coloured differently here than a task's.
        */}
        {ticket.state === null ? null : <StatusLabel status={ticket.state} />}
        {reportedAt === null ? null : (
          /*
            How long ago the agent read it from the tracker, and nothing more.
            FR-011 forbids any assessment of whether it is still current: the
            board cannot see the tracker, so "stale" would be a guess wearing
            the clothes of a fact. The developer is given the age and makes the
            judgement themselves.
          */
          <span className="ticketid__age" data-testid="ticket-age">
            reported {focusAge(reportedAt, now)}
          </span>
        )}
      </div>

      <h2 className="ticketid__title" data-testid="ticket-title">
        {ticket.title}
      </h2>

      <Address url={ticket.url} testId="ticket-url" />

      {ticket.parent === null ? null : (
        <div className="ticketid__parent" data-testid="ticket-parent">
          <span className="ticketid__parent-lead">Part of</span>
          {ticket.parent.key === null ? null : (
            <span className="ticketid__parent-key" data-testid="ticket-parent-key">
              {ticket.parent.key}
            </span>
          )}
          <span className="ticketid__parent-title" data-testid="ticket-parent-title">
            {ticket.parent.title}
          </span>
          <Address url={ticket.parent.url} testId="ticket-parent-url" />
        </div>
      )}
    </header>
  );
}

/**
 * An address: always text, and a control **only** when it is openable.
 *
 * Always visible when it was reported, whatever it is (FR-021), and deliberately
 * not explained away: the address is what the tracker had, and the board neither
 * repairs it (FR-022) nor lectures the developer about it. Being on screen is
 * also what satisfies FR-025 — the developer sees where a link leads without
 * having to discover a hover affordance, and reads the same characters the
 * operating system would be handed.
 *
 * Openability is decided by `isOpenable` from the contract — the same function
 * the main process calls before the OS sees anything. Asking the same rule is
 * what stops a control appearing for an address the main process would drop: a
 * button that silently does nothing teaches the developer that the *board* is
 * broken rather than that the address is.
 *
 * The main-process check is still the one that counts. This is a renderer full
 * of agent-composed text, and "the renderer only asks for validated addresses"
 * has to be a claim about the whole renderer rather than about this function.
 */
function Address({ url, testId }: { url: string | null; testId: string }): React.JSX.Element | null {
  if (url === null) return null;

  if (!isOpenable(url)) {
    return (
      <span className="ticketid__address" data-testid={`${testId}-text`} title={url}>
        {url}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="ticketid__link"
      data-testid={testId}
      title="Open in your browser"
      onClick={() => {
        openLink(url);
      }}
    >
      {url}
    </button>
  );
}
