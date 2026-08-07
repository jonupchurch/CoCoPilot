import { Mark } from './Mark.js';

import './WaitingState.css';

/**
 * Not a first-run screen. Nothing survives a restart, so this is seen on **every**
 * launch — which makes it a primary layout rather than a fallback, and makes
 * getting it wrong mean the product looks broken regularly rather than once.
 *
 * It has to do three things: say it is waiting rather than showing an error or a
 * blank panel, make clear there is nothing to configure, and offer no control
 * that leads nowhere.
 */
export function WaitingState(): React.JSX.Element {
  return (
    <div className="waiting" data-testid="waiting-state">
      <Mark size={22} dimmed />

      <div className="waiting__lede">
        <h1 className="waiting__title">Waiting for an agent</h1>
        <p className="waiting__body">
          Nothing has been reported yet. Start Claude Code in a Spec-Kit repository and this board
          fills in as it works.
        </p>
      </div>

      <div className="waiting__pill">
        <span className="waiting__dot" aria-hidden="true" />
        <span>listening · nothing heard yet</span>
      </div>

      <p className="waiting__note">
        The agent supplies the repository, branch and spec. There is nothing to set up here.
      </p>
    </div>
  );
}
