import type { SessionView } from '../../../../main/view.js';
import { ScopePicker } from '../../components/ScopePicker.js';
import { useIsNarrow } from '../../lib/breakpoint.js';
import { focusAge } from '../../lib/elapsed.js';
import { useSelection } from '../../state/useSelection.js';
import { TaskDetail } from './TaskDetail.js';
import { TaskList } from './TaskList.js';

import './TasksView.css';

/**
 * The Tasks tab: which story's tasks, which task, and that task in full.
 *
 * The scope picker sits above both at every width — it is the control that says
 * what the list below it contains, not a narrow-layout substitute for anything.
 *
 * Read-only, and structurally so: there is not a single control in this tree
 * that sends anything anywhere, because no such component exists to import
 * (FR-020). The absence is the enforcement; `read-only.spec.ts` proves it
 * stayed that way.
 */
export function TasksView({
  session,
  now,
}: {
  session: SessionView;
  now: number;
}): React.JSX.Element {
  const narrow = useIsNarrow();
  const selection = useSelection(session.stories, session.tasks);
  const focusedTask = session.focus?.task?.trim() ?? '';
  const tag = session.reportedAt === null ? null : focusAge(session.reportedAt, now);

  if (selection.scope === null) {
    return (
      <div className="tasks tasks--empty" data-testid="tasks-empty">
        <p>No tasks have been reported for this session.</p>
      </div>
    );
  }

  return (
    <div className="tasks" data-narrow={narrow} data-testid="tasks">
      <ScopePicker
        scopes={selection.scopes}
        selected={selection.scope.id}
        onSelect={selection.selectScope}
        testId="scope-picker"
      />

      <div className="tasks__body">
        <TaskList
          tasks={selection.scope.tasks}
          selected={selection.task?.id ?? null}
          focusedTask={focusedTask}
          tag={tag}
          onSelect={selection.selectTask}
        />
        <TaskDetail
          task={selection.task}
          scope={selection.scope}
          focus={session.focus}
          tag={tag}
        />
      </div>
    </div>
  );
}
