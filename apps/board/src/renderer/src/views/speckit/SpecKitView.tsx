import type { SessionView } from '../../../../main/view.js';
import { useIsNarrow } from '../../lib/breakpoint.js';
import { focusAge } from '../../lib/elapsed.js';
import { usePlacement } from '../../state/usePlacement.js';
import { scopeKey } from '../../state/useSelection.js';
import { useTreeState } from '../../state/useTreeState.js';
import { DetailPane } from './DetailPane.js';
import { StoryNode } from './StoryNode.js';
import { TaskNode } from './TaskNode.js';

import './SpecKitView.css';

/**
 * The Spec-Kit tab: stories, the tasks beneath them, and one of either in full.
 *
 * The relationship this draws has been reported since feature 001 — a task names
 * its story, a story names its tasks — and until now no view drew it. The Stories
 * and Tasks tabs each showed one end of it.
 *
 * **Placement is `usePlacement`, not `buildScopes`.** The two differ on exactly
 * one question and `usePlacement` explains which; the short version is that a
 * tree needs every task drawn once, and the older rule draws a disputed task
 * twice on purpose. Both are right for their own view.
 *
 * **One scroll container for the whole tree**, and nothing re-mounts it: that is
 * what makes the scroll position survive a report (FR-032) without anything
 * managing it. Keys are scope and task identifiers rather than positions, so a
 * report that inserts a story above the one being read does not renumber
 * everything below it.
 *
 * Read-only, and structurally so — there is not a control in this tree that
 * sends anything anywhere, because no such component exists to import.
 * `read-only.spec.ts` is what proves it stayed that way.
 */
export function SpecKitView({
  session,
  now,
}: {
  session: SessionView;
  now: number;
}): React.JSX.Element {
  const narrow = useIsNarrow();
  const { scopes } = usePlacement(session.stories, session.tasks);
  const focusedTask = session.focus?.task?.trim() ?? '';
  const tree = useTreeState(scopes, focusedTask);
  const tag = session.reportedAt === null ? null : focusAge(session.reportedAt, now);

  // Reachable even though the tab is only offered to a session that has reported
  // stories: reports replace wholesale, so a later one may carry none. The tab
  // stays (FR-003) and says what it has, which is nothing.
  if (scopes.length === 0) {
    return (
      <div className="speckit speckit--empty" data-testid="speckit-empty">
        <p>Nothing has been reported for this session.</p>
      </div>
    );
  }

  return (
    <div className="speckit" data-narrow={narrow} data-testid="speckit">
      <div className="speckit__tree" data-testid="speckit-tree">
        {scopes.map((scope) => {
          const open = tree.isOpen(scope);
          const key = scopeKey(scope);

          return (
            <div className="speckit__group" key={scope.id}>
              <StoryNode
                scope={scope}
                open={open}
                selected={tree.selection.scope?.id === scope.id && tree.selection.task === null}
                onToggle={tree.toggle}
                onSelect={tree.selectStory}
              />

              {open ? (
                <div className="speckit__tasks" data-testid={`speckit-tasks-${key}`}>
                  {scope.tasks.length === 0 ? (
                    // Said rather than drawn as an empty box (FR-016). A story
                    // with no tasks is an ordinary thing for an agent to report.
                    <p className="speckit__none" data-testid={`speckit-none-${key}`}>
                      No tasks reported for this story.
                    </p>
                  ) : (
                    scope.tasks.map((task) => (
                      <TaskNode
                        key={task.id}
                        task={task}
                        focused={task.id.trim() === focusedTask}
                        elapsedTag={tag}
                        selected={tree.selection.task?.id === task.id}
                        onSelect={tree.selectTask}
                      />
                    ))
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <DetailPane selection={tree.selection} session={session} now={now} />
    </div>
  );
}
