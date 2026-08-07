import type { SessionView } from '../../../../main/view.js';
import { useIsNarrow } from '../../lib/breakpoint.js';
import { useSelection } from '../../state/useSelection.js';
import { StoryDetail } from './StoryDetail.js';
import { StoryList } from './StoryList.js';
import { StoryPicker } from './StoryPicker.js';

import './StoriesView.css';

/**
 * The Stories tab: which stories exist, and one of them in full.
 *
 * Read-only, and structurally so — there is not a single control in this tree
 * that sends anything anywhere, because no such component exists to import
 * (FR-020). The absence is the enforcement; `read-only.spec.ts` is what proves
 * it stayed that way.
 */
export function StoriesView({
  session,
  now,
}: {
  session: SessionView;
  now: number;
}): React.JSX.Element {
  const narrow = useIsNarrow();
  const selection = useSelection(session.stories, session.tasks);
  const focusedTask = session.focus?.task?.trim() ?? '';

  if (selection.scope === null) {
    return (
      <div className="stories stories--empty" data-testid="stories-empty">
        <p>No stories have been reported for this session.</p>
      </div>
    );
  }

  return (
    <div className="stories" data-narrow={narrow} data-testid="stories">
      {narrow ? (
        <StoryPicker
          scopes={selection.scopes}
          selected={selection.scope.id}
          onSelect={selection.selectScope}
        />
      ) : (
        <StoryList
          scopes={selection.scopes}
          selected={selection.scope.id}
          focusedTask={focusedTask}
          onSelect={selection.selectScope}
        />
      )}

      <StoryDetail
        scope={selection.scope}
        feature={session.feature}
        focusedTask={focusedTask}
        reportedAt={session.reportedAt}
        now={now}
      />
    </div>
  );
}
