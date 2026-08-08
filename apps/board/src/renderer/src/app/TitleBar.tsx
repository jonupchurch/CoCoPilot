import type { SessionView } from '../../../main/view.js';
import { heardAgo } from '../lib/elapsed.js';
import { Chip } from './Chip.js';
import { Mark } from './Mark.js';

import './TitleBar.css';

/**
 * Four things readable at a glance: which repository, which branch, how long
 * since the agent said anything, and whether it wants a human.
 *
 * The export shows brand and branch only; FR-001 requires the repository too, so
 * it takes the same slot with the same treatment. Decision 8 makes the exports
 * canon for look and feel and this repository's docs authoritative on incidental
 * content — this is the latter.
 *
 * Every value here is a text node. Agent-composed text is untrusted by
 * construction and is never rendered as markup.
 */
export function TitleBar({
  session,
  now,
}: {
  session: SessionView | null;
  now: number;
}): React.JSX.Element {
  return (
    <header className="titlebar">
      <Mark size={11} />
      <span className="titlebar__brand">CoCoapilot</span>

      {session === null ? (
        <span className="titlebar__quiet" data-testid="nothing-heard">
          nothing heard yet
        </span>
      ) : (
        <>
          <span className="titlebar__identity" title={session.repo} data-testid="identity">
            {session.repoName} · {session.branch}
          </span>
          <span className="titlebar__elapsed" data-testid="elapsed">
            {heardAgo(session.lastHeardAt, now)}
          </span>
          <Chip value={session.chip} />
        </>
      )}
    </header>
  );
}
