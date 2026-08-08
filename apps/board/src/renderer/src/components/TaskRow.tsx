import type { Task } from 'cocoapilot-contract';

import { StatusDisc, StatusLabel } from './StatusLabel.js';

import './TaskRow.css';

/**
 * One reported task: disc, identifier, title, status — and the focus marker when
 * this is the task the agent said it was on.
 *
 * The export prints status text only on the focused row and lets the disc carry
 * it everywhere else. A disc cannot carry a status the board does not recognise,
 * and FR-006 asks for identifier, title *and* status on every row, so the text
 * is always present here. Decision 8 makes the exports canon for look and feel
 * and this repository's docs authoritative on content; this is content.
 */
export function TaskRow({
  task,
  focused,
  elapsedTag,
}: {
  task: Task;
  focused: boolean;
  /** Null when nothing has been reported yet, which is not the same as `0s`. */
  elapsedTag: string | null;
}): React.JSX.Element {
  return (
    <div className="taskrow" data-focused={focused} data-testid={`task-${task.id}`}>
      <StatusDisc status={task.status} />
      <span className="taskrow__id" title={task.id}>
        {task.id}
      </span>
      <span className="taskrow__title" title={task.title}>
        {task.title}
      </span>
      <StatusLabel status={task.status} />
      {focused && elapsedTag !== null ? (
        <span className="taskrow__elapsed" data-testid={`task-elapsed-${task.id}`}>
          {elapsedTag}
        </span>
      ) : null}
    </div>
  );
}
