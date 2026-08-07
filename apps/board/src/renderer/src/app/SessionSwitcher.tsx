import type { SessionSummary } from '../../../main/view.js';
import { SessionPill } from './SessionPill.js';

import './SessionSwitcher.css';

/**
 * The row of held sessions — and, below two of them, nothing at all.
 *
 * **The absence is the P1 story.** Most sessions are single, so permanent
 * navigation for a choice that usually does not exist would tax every ordinary
 * use to serve an occasional one. The threshold lives here and only here, so no
 * caller can draw a switcher for one session by forgetting to check.
 *
 * The cost is accepted rather than hidden: the row appearing shifts the content
 * below it, once, when a second agent declares itself. The alternative is
 * reserving the space permanently, which charges the common case for the rare
 * one.
 *
 * Order is declaration order and is never touched — not by recency, not by
 * attention. A pill is glanced at rather than read, so its position is
 * something a developer learns; sorting would move the pill they are reaching
 * for, because the one that moved is the one they want.
 */

/** Below this many sessions there is no choice to offer, so there is no row. */
const THRESHOLD = 2;

/**
 * Up to this many sessions, every pill shows its branch as well as its
 * repository.
 *
 * Density degrades by dropping information rather than shrinking it: past three
 * sessions in a 380px panel there is no type size at which repository *and*
 * branch are both legible, and a name too small to read is worse than one that
 * is not there.
 */
const DETAILED_UP_TO = 3;

/**
 * ...except where the branch is the only thing telling two sessions apart.
 *
 * FR-005 requires every entry to be distinguishable from the others, and the
 * plan's rule — drop the branch past two sessions — quietly breaks it for the
 * case the spec calls out by name: two sessions in the same repository on
 * different branches. Four sessions, two of them in `api`, and the density rule
 * alone would draw two identical pills.
 *
 * So the branch survives wherever a repository name is not unique, however
 * crowded the row is. Density is a preference; being able to tell which agent
 * you are about to switch to is the requirement.
 */
function needsBranch(sessions: readonly SessionSummary[], summary: SessionSummary): boolean {
  if (sessions.length <= DETAILED_UP_TO) return true;
  return sessions.filter((other) => other.repoName === summary.repoName).length > 1;
}

export function SessionSwitcher({
  sessions,
  selected,
  now,
  onSelect,
  onDismiss,
}: {
  sessions: readonly SessionSummary[];
  /** The key of the session every view is showing, or null before anything is held. */
  selected: string | null;
  now: number;
  onSelect: (key: string) => void;
  onDismiss: (key: string) => void;
}): React.JSX.Element | null {
  if (sessions.length < THRESHOLD) return null;

  return (
    <div className="switcher" data-testid="session-switcher">
      {sessions.map((summary) => (
        <SessionPill
          // The store's own key: unique by construction, and stable for as long
          // as the session is held, so a pill is never remounted by its
          // neighbour being dismissed.
          key={summary.key}
          summary={summary}
          selected={summary.key === selected}
          detailed={needsBranch(sessions, summary)}
          now={now}
          onSelect={onSelect}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
