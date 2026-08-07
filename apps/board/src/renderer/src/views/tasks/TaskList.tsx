import type { Task } from '@cocopilot/contract';

import { StatusDisc, StatusLabel } from '../../components/StatusLabel.js';

import './TaskList.css';

/**
 * The scoped story's tasks, one of them being read.
 *
 * Two lines per row, as the export has it: identifier and status above, title
 * below. A task title is a sentence and a task id is four characters, and one
 * line cannot give both room in a panel this narrow.
 *
 * Rows are buttons, so the list is operable from the keyboard without this file
 * knowing anything about keys.
 */
export function TaskList({
  tasks,
  selected,
  focusedTask,
  tag,
  onSelect,
}: {
  tasks: readonly Task[];
  /** The task being read, or null when the scope has none. */
  selected: string | null;
  /** The task the agent said it was on, which is a different thing. */
  focusedTask: string;
  /** The report's age, shown against the current task only. Null before any report. */
  tag: string | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  if (tasks.length === 0) {
    return (
      <div className="tasklist" data-testid="task-list">
        <div className="tasklist__head">
          <span className="tasklist__label">Tasks</span>
        </div>
        <p className="tasklist__empty" data-testid="task-list-empty">
          No tasks were reported for this story.
        </p>
      </div>
    );
  }

  return (
    <div className="tasklist" data-testid="task-list">
      <div className="tasklist__head">
        <span className="tasklist__label">Tasks</span>
        <span className="tasklist__count" data-testid="task-count">
          {tasks.length}
        </span>
      </div>

      {tasks.map((task, index) => {
        const current = focusedTask !== '' && task.id.trim() === focusedTask;

        return (
          <button
            // Keyed by identifier with the index as the tiebreak an agent can
            // force by reporting the same id twice, as the Spec section does.
            key={`${task.id}#${index}`}
            type="button"
            className="tasklist__row"
            data-selected={task.id === selected}
            data-current={current}
            aria-current={task.id === selected ? 'true' : undefined}
            onClick={() => {
              onSelect(task.id);
            }}
            data-testid={`task-row-${task.id}`}
          >
            <StatusDisc status={task.status} />
            <span className="tasklist__body">
              <span className="tasklist__top">
                <span className="tasklist__id" title={task.id}>
                  {task.id}
                </span>
                <StatusLabel status={task.status} />
                {/*
                  The report's age, against the task the agent said it was on.
                  The export draws a per-task `updated` here; no per-task
                  timestamp exists in the contract and decision 26 refuses the
                  state that would create one, so this is the same answer
                  feature 004 gave on the Overview tab rather than a second one.
                */}
                {current && tag !== null ? (
                  <span className="tasklist__age" data-testid={`task-age-${task.id}`}>
                    {tag}
                  </span>
                ) : null}
              </span>
              <span className="tasklist__title" title={task.title}>
                {task.title}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
