import { StatusLabel } from '../../components/StatusLabel.js';
import { taskSummary } from '../../lib/summarise.js';
import { scopeKey, type Scope } from '../../state/useSelection.js';

import './StoryList.css';

/**
 * The story column: which stories exist, and which one is being read.
 *
 * Every value on a row is reported except the task summary, which counts what
 * was sent — deriving a summary *of the report* is not inventing content, and
 * `only-reported.spec.ts` is where that distinction is held rather than
 * asserted here. It comes from `lib/summarise.ts` because three components now
 * draw it, and three of them counting separately is three chances to disagree.
 *
 * Rows are buttons, so the list is operable from the keyboard without this file
 * knowing anything about keys.
 */

/**
 * The scope with no story behind it, named where it is drawn.
 *
 * Two strings rather than one, so the identifier slot keeps the shape every
 * other row has. A bare "Unassigned" spanning both would read as a heading
 * rather than as one more thing to select.
 */
const NO_STORY_ID = '—';
const NO_STORY_TITLE = 'Tasks belonging to no reported story';

export function StoryList({
  scopes,
  selected,
  focusedTask,
  onSelect,
}: {
  scopes: readonly Scope[];
  selected: string | null;
  /** The current task's id, so the story that owns it can say so. */
  focusedTask: string;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  return (
    <div className="storylist" data-testid="story-list">
      <div className="storylist__head">
        <span className="storylist__label">Stories</span>
        <span className="storylist__count" data-testid="story-count">
          {scopes.length}
        </span>
      </div>

      {scopes.map((scope) => (
        <StoryRow
          key={scope.id}
          scope={scope}
          selected={scope.id === selected}
          focusedTask={focusedTask}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function StoryRow({
  scope,
  selected,
  focusedTask,
  onSelect,
}: {
  scope: Scope;
  selected: boolean;
  focusedTask: string;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const { story } = scope;
  const owns = focusedTask !== '' && scope.tasks.some((task) => task.id.trim() === focusedTask);

  // Narrowed to values rather than booleans, so the `title` attributes below can
  // see they are strings.
  const priority = story !== null && story.priority !== null ? story.priority : null;
  const status = story !== null && story.status !== null ? story.status : null;
  const id = story?.id ?? NO_STORY_ID;
  const title = story?.title ?? NO_STORY_TITLE;

  return (
    <button
      type="button"
      className="storylist__row"
      data-selected={selected}
      aria-current={selected ? 'true' : undefined}
      onClick={() => {
        onSelect(scope.id);
      }}
      data-testid={`story-row-${scopeKey(scope)}`}
    >
      <span className="storylist__top">
        <span className="storylist__id" title={id}>
          {id}
        </span>
        {priority === null ? null : (
          <span className="storylist__priority" title={priority}>
            {priority}
          </span>
        )}
        {status === null ? null : <StatusLabel status={status} />}
      </span>

      <span className="storylist__title" title={title}>
        {title}
      </span>

      <span className="storylist__foot">
        <span className="storylist__tasks">{taskSummary(scope.tasks)}</span>
        {owns ? (
          <span className="storylist__owns" data-testid={`story-current-${scopeKey(scope)}`}>
            · current
          </span>
        ) : null}
      </span>
    </button>
  );
}
