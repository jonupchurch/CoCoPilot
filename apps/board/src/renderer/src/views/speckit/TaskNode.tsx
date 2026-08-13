import type { Task } from 'cocoapilot-contract';

import { TaskRow } from '../../components/TaskRow.js';

import './TaskNode.css';

/**
 * One task beneath its story.
 *
 * **Wraps `TaskRow` rather than restating it.** The row already draws the disc,
 * identifier, title, status and the focus marker, and it is what the Tasks view
 * draws — so a task looks the same in both places for as long as both exist,
 * which is exactly the period during which a developer might see both.
 *
 * The wrapper adds only what the tree needs: selectability. A button, so the
 * tree is operable from the keyboard without this file knowing anything about
 * keys, matching how `StoryList` makes its rows operable.
 */
export function TaskNode({
  task,
  focused,
  elapsedTag,
  selected,
  onSelect,
}: {
  task: Task;
  focused: boolean;
  /** Null when nothing has been reported yet, which is not the same as `0s`. */
  elapsedTag: string | null;
  selected: boolean;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="tasknode"
      data-selected={selected}
      aria-current={selected ? 'true' : undefined}
      onClick={() => {
        onSelect(task.id);
      }}
      data-testid={`speckit-task-${task.id}`}
    >
      <TaskRow task={task} focused={focused} elapsedTag={elapsedTag} />
    </button>
  );
}
