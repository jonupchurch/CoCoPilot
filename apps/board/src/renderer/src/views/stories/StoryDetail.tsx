import type { ReportedFeature, Task } from 'cocoapilot-contract';

import { StatusDisc, StatusLabel } from '../../components/StatusLabel.js';
import { focusAge } from '../../lib/elapsed.js';
import type { Scope } from '../../state/useSelection.js';

import './StoryDetail.css';

/**
 * One story, in full.
 *
 * Every block here is conditional, because every field behind it is nullable in
 * the contract: `asA`, `want`, `soThat`, `priority`, `status`, and all three
 * collections. FR-017 wants emptiness stated rather than drawn, and an
 * "Acceptance criteria" heading over nothing is the drawn kind.
 *
 * **The export's spec path is the feature's, and is labelled as such.** It draws
 * `story.spec` in this header; `Story` has no such field and only
 * `ReportedFeature` carries one. Showing the feature's path unlabelled would
 * quietly assert a per-story path that nobody reported.
 */

export function StoryDetail({
  scope,
  feature,
  focusedTask,
  reportedAt,
  now,
}: {
  scope: Scope;
  feature: ReportedFeature | null;
  focusedTask: string;
  reportedAt: number | null;
  now: number;
}): React.JSX.Element {
  const { story, tasks } = scope;
  const tag = reportedAt === null ? null : focusAge(reportedAt, now);

  if (story === null) {
    return (
      <div className="storydetail" data-testid="story-detail">
        <div className="storydetail__head">
          <h2 className="storydetail__title" data-testid="story-detail-title">
            Tasks belonging to no reported story
          </h2>
          <p className="storydetail__orphans">
            Every one of these was reported with no story, or with a story that
            was not. They are here so that nothing an agent sent is unreachable.
          </p>
        </div>
        <TaskLines tasks={tasks} focusedTask={focusedTask} tag={tag} />
      </div>
    );
  }

  const priority = story.priority;
  const status = story.status;
  const specPath = feature?.specPath ?? null;

  return (
    <div className="storydetail" data-testid="story-detail">
      <div className="storydetail__head">
        <div className="storydetail__meta">
          <span className="storydetail__id" data-testid="story-detail-id">
            {story.id}
          </span>
          {priority === null ? null : (
            <span className="storydetail__priority" title={priority}>
              {priority}
            </span>
          )}
          {status === null ? null : <StatusLabel status={status} />}
          {specPath === null ? null : (
            <span
              className="storydetail__spec"
              title={`Feature spec: ${specPath}`}
              data-testid="story-detail-spec"
            >
              {specPath}
            </span>
          )}
        </div>
        <h2 className="storydetail__title" data-testid="story-detail-title">
          {story.title}
        </h2>
      </div>

      {story.asA === null && story.want === null && story.soThat === null ? null : (
        <div className="storydetail__narrative" data-testid="story-narrative">
          <Clause lead="As a" text={story.asA} />
          <Clause lead="I want" text={story.want} />
          <Clause lead="so that" text={story.soThat} />
        </div>
      )}

      {story.criteria.length === 0 ? null : (
        <section className="storydetail__block">
          <h3 className="storydetail__heading">Acceptance criteria</h3>
          {story.criteria.map((text, index) => (
            // Criteria are prose and repeat legitimately, so the index is the
            // key. The board does not get to drop one for being a duplicate.
            <div className="storydetail__criterion" key={`${index}:${text}`}>
              <span className="storydetail__ordinal" aria-hidden="true">
                {index + 1}
              </span>
              <span className="storydetail__criterion-text">{text}</span>
            </div>
          ))}
        </section>
      )}

      <section className="storydetail__block">
        <h3 className="storydetail__heading">Tasks</h3>
        <TaskLines tasks={tasks} focusedTask={focusedTask} tag={tag} />
      </section>

      {story.files.length === 0 ? null : (
        <section className="storydetail__block storydetail__block--ruled">
          <h3 className="storydetail__heading">Touches</h3>
          {story.files.map((path, index) => (
            <div className="storydetail__file" key={`${index}:${path}`} title={path}>
              {path}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function Clause({ lead, text }: { lead: string; text: string | null }): React.JSX.Element | null {
  if (text === null) return null;

  return (
    <p className="storydetail__clause">
      <span className="storydetail__lead">{lead}</span> {text}
    </p>
  );
}

/**
 * A story's tasks, shown but not selectable — this is the Stories tab, and
 * navigating from here to the Tasks tab is feature 006's job to *not* do
 * implicitly. Selection lives in one place per view.
 */
function TaskLines({
  tasks,
  focusedTask,
  tag,
}: {
  tasks: readonly Task[];
  focusedTask: string;
  tag: string | null;
}): React.JSX.Element {
  if (tasks.length === 0) {
    return (
      <p className="storydetail__empty" data-testid="story-no-tasks">
        No tasks were reported for this story.
      </p>
    );
  }

  return (
    <>
      {tasks.map((task, index) => {
        const current = focusedTask !== '' && task.id.trim() === focusedTask;

        return (
          <div
            className="storydetail__task"
            key={`${task.id}#${index}`}
            data-current={current}
            data-testid={`story-task-${task.id}`}
          >
            <StatusDisc status={task.status} />
            <span className="storydetail__task-id" title={task.id}>
              {task.id}
            </span>
            <span className="storydetail__task-title" title={task.title}>
              {task.title}
            </span>
            <StatusLabel status={task.status} />
            {current && tag !== null ? (
              <span className="storydetail__task-age" data-testid={`story-task-age-${task.id}`}>
                {tag}
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
