import type { Focus, Task } from 'cocoapilot-contract';

import { StatusLabel } from '../../components/StatusLabel.js';
import type { Scope } from '../../state/useSelection.js';

import './TaskDetail.css';

/**
 * One task, in full — the finest grain the board has.
 *
 * Every block is conditional, because `detail`, `checks` and `files` are all
 * optional in the contract and FR-017 wants emptiness stated rather than drawn.
 * A "Checks" heading over nothing is the drawn kind.
 *
 * **The export's `task.updated` is the report's age, and only on the current
 * task.** There is no per-task timestamp in the contract, and decision 26 —
 * snapshot-replace, no merge — refuses the state that would create one. Feature
 * 004 already answered this for the task rows on Overview; answering it a second
 * way here would be the board telling two stories about the same fact.
 */
export function TaskDetail({
  task,
  scope,
  focus,
  tag,
}: {
  /** Null when the scoped story has no tasks, which the view states rather than draws. */
  task: Task | null;
  scope: Scope;
  focus: Focus | null;
  /** The report's age. Null before any report has arrived. */
  tag: string | null;
}): React.JSX.Element {
  if (task === null) {
    // Necessarily a story: the unassigned scope is only built when it has
    // orphans to hold, so an empty scope always has a story behind it.
    return (
      <div className="taskdetail taskdetail--empty" data-testid="task-detail">
        <p data-testid="task-detail-empty">
          This story has no tasks. Nothing was reported for it to show.
        </p>
      </div>
    );
  }

  const focused = focus?.task?.trim() ?? '';
  const current = focused !== '' && task.id.trim() === focused;
  const note = focus?.note?.trim() === '' ? null : (focus?.note ?? null);
  const detail = task.detail?.trim() === '' ? null : task.detail;

  return (
    <div className="taskdetail" data-testid="task-detail">
      <div className="taskdetail__head">
        <div className="taskdetail__meta">
          <span className="taskdetail__id" data-testid="task-detail-id">
            {task.id}
          </span>
          <StatusLabel status={task.status} />
          {current && tag !== null ? (
            <span
              className="taskdetail__age"
              // Said outright, because `4m` beside a task reads as the task's
              // age and it is the report's.
              title={`The agent last reported ${tag === 'now' ? 'just now' : `${tag} ago`}`}
              data-testid="task-detail-age"
            >
              {tag}
            </span>
          ) : null}
        </div>
        <h2 className="taskdetail__title" data-testid="task-detail-title">
          {task.title}
        </h2>
      </div>

      {/*
        The agent's own words about what it is doing, shown here only when this
        is the task it named. `focus.note` is reported against the session, not
        the task, so putting it under any other task would attribute it wrongly.
      */}
      {current && note !== null ? (
        <p className="taskdetail__focus" data-testid="task-detail-focus">
          {note}
        </p>
      ) : null}

      {detail === null ? null : (
        <p className="taskdetail__detail" data-testid="task-detail-detail">
          {detail}
        </p>
      )}

      {task.checks.length === 0 ? null : (
        <section className="taskdetail__block">
          <h3 className="taskdetail__heading">Checks</h3>
          {task.checks.map((text, index) => (
            // Checks are prose and repeat legitimately, so the index is part of
            // the key. The board does not drop one for being a duplicate.
            <div className="taskdetail__check" key={`${index}:${text}`}>
              {/*
                A marker, not a checkbox. `checks` is a list of what qualifies
                this task as done — the contract carries no per-check state, so
                a box, ticked or empty, would assert one.
              */}
              <span className="taskdetail__bullet" aria-hidden="true" />
              <span className="taskdetail__check-text">{text}</span>
            </div>
          ))}
        </section>
      )}

      {task.files.length === 0 ? null : (
        <section className="taskdetail__block">
          <h3 className="taskdetail__heading">Files</h3>
          {task.files.map((path, index) => (
            <div className="taskdetail__file" key={`${index}:${path}`} title={path}>
              {path}
            </div>
          ))}
        </section>
      )}

      <section className="taskdetail__block taskdetail__block--ruled">
        <h3 className="taskdetail__heading">From the story</h3>
        <p className="taskdetail__from" data-testid="task-detail-from">
          {scope.story === null
            ? 'Reported with no story, or with one that was not reported.'
            : `${scope.story.id} · ${scope.story.title}`}
        </p>
      </section>
    </div>
  );
}
