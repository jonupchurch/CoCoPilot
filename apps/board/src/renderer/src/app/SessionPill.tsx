import type { SessionSummary } from '../../../main/view.js';
import { elapsed } from '../lib/elapsed.js';
import { Chip } from './Chip.js';

import './SessionPill.css';

/**
 * One held session, as something to glance at and click.
 *
 * **It carries its own chip because the alternative silently breaks the one
 * channel an agent has for asking for a human.** The chip is that channel
 * (decision 15), and the board shows one session at a time — so without state
 * on unselected pills, a `needs-you` on the session you are not watching is an
 * ask that never arrives. That is the whole reason this component is not just a
 * name.
 *
 * **Density degrades by dropping information, not by shrinking it.** Past two
 * sessions the branch goes from unselected pills, and the chip's label shows
 * only when the pill is selected or is asking for attention. Space is spent
 * where it carries something; nothing is set in 9px type to make it fit.
 */
export function SessionPill({
  summary,
  selected,
  detailed,
  now,
  onSelect,
  onDismiss,
}: {
  summary: SessionSummary;
  selected: boolean;
  /** False once the row is crowded: the branch is the first thing to go. */
  detailed: boolean;
  now: number;
  onSelect: (key: string) => void;
  onDismiss: (key: string) => void;
}): React.JSX.Element {
  const attention = summary.chip === 'needs-you';

  return (
    <div
      className="pill"
      data-selected={selected}
      data-attention={attention}
      data-testid={`session-pill-${summary.key}`}
    >
      <button
        type="button"
        className="pill__select"
        aria-current={selected ? 'true' : undefined}
        onClick={() => {
          onSelect(summary.key);
        }}
        data-testid={`session-select-${summary.key}`}
      >
        {/*
          Label only when it is worth the width: on the selected pill, where
          there is room, and on one asking for attention, where the word is the
          point. Elsewhere the dot alone says which state without crowding out
          the repository name.
        */}
        <Chip value={summary.chip} labelled={selected || attention} />

        <span className="pill__identity">
          <span className="pill__repo" title={summary.repo}>
            {summary.repoName}
          </span>
          {detailed ? (
            <span className="pill__branch" title={summary.branch}>
              {summary.branch}
            </span>
          ) : null}
        </span>

        {/*
          FR-011. A push with no process behind it is a script, not an agent —
          worth saying, because "the agent has gone quiet" reads very
          differently from "a script reported once and will not report again".
        */}
        {summary.attributed ? null : (
          <span className="pill__script" title="Reported by a script, not an agent">
            script
          </span>
        )}

        <span className="pill__elapsed" data-testid={`session-elapsed-${summary.key}`}>
          {elapsed(summary.lastHeardAt, now)}
        </span>
      </button>

      {/*
        Its own button rather than a gesture on the pill: dismissing is not a
        variant of selecting, and a click that means one thing near the middle
        and another near the edge is a click nobody trusts.

        The wording is the whole mitigation for FR-015 — the plan calls it thin
        cover rather than solved. It says *clear from this board*, because the
        agent is not told, does not stop, and comes back the moment it reports.
      */}
      <button
        type="button"
        className="pill__dismiss"
        title={`Clear ${summary.repoName} from this board. The agent is not told and keeps working; it reappears if it reports again.`}
        aria-label={`Clear ${summary.repoName} from this board`}
        onClick={() => {
          onDismiss(summary.key);
        }}
        data-testid={`session-dismiss-${summary.key}`}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
