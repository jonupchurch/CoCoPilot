import type { SessionView } from '../../../../main/view.js';
import { focusAge } from '../../lib/elapsed.js';
import type { ResolvedSelection } from '../../state/useTreeState.js';
import { StoryDetail } from '../stories/StoryDetail.js';
import { TaskDetail } from '../tasks/TaskDetail.js';

import './DetailPane.css';

/**
 * Whatever the tree has selected, in full.
 *
 * **Dispatches to the existing detail components rather than restating them.**
 * `StoryDetail` and `TaskDetail` each take a `Scope`, and `Scope` is a value
 * rather than a policy — so the tree's own placement can produce one and hand it
 * over unchanged. That is what keeps a story looking the same in this tab as in
 * the one it displaces, for as long as both exist.
 *
 * The kind label above them is this component's only content of its own, and it
 * carries FR-020: a developer must be able to tell whether they are reading a
 * story or a task. The two components look different, but "looks different" is
 * not the same as "says which", and a pane that changes shape without saying why
 * is a puzzle rather than an answer.
 */
export function DetailPane({
  selection,
  session,
  now,
}: {
  selection: ResolvedSelection;
  session: SessionView;
  now: number;
}): React.JSX.Element {
  const focusedTask = session.focus?.task?.trim() ?? '';
  const tag = session.reportedAt === null ? null : focusAge(session.reportedAt, now);

  /*
   * Two absences, said differently on purpose.
   *
   * Nothing selected is an invitation: the tree is right there, pick something.
   * A selection the report no longer contains is news — the thing being read has
   * gone — and FR-034 requires saying so rather than quietly landing the
   * developer on whatever is now first. Collapsing both into one "nothing to
   * show" would lose the difference, which is exactly the difference that
   * matters to someone who was mid-read.
   */
  if (selection.missing) {
    return (
      <div className="detailpane detailpane--absent" data-testid="speckit-detail">
        <p data-testid="speckit-detail-gone">
          What you were reading is no longer in the agent’s report. Nothing has
          been selected in its place.
        </p>
      </div>
    );
  }

  if (selection.scope === null) {
    return (
      <div className="detailpane detailpane--absent" data-testid="speckit-detail">
        <p data-testid="speckit-detail-none">Select a story or a task to read it in full.</p>
      </div>
    );
  }

  const kind = selection.task === null ? 'Story' : 'Task';

  return (
    <div className="detailpane" data-testid="speckit-detail" data-kind={kind.toLowerCase()}>
      <p className="detailpane__kind" data-testid="speckit-detail-kind">
        {kind}
      </p>

      {selection.task === null ? (
        <StoryDetail
          scope={selection.scope}
          feature={session.feature}
          focusedTask={focusedTask}
          reportedAt={session.reportedAt}
          now={now}
        />
      ) : (
        <TaskDetail
          task={selection.task}
          scope={selection.scope}
          focus={session.focus}
          tag={tag}
        />
      )}
    </div>
  );
}
