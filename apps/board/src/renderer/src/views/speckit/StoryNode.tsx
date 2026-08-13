import { StatusLabel } from '../../components/StatusLabel.js';
import { formatStoryProgress, storyProgress } from '../../lib/summarise.js';
import { scopeKey, type Scope } from '../../state/useSelection.js';

import './StoryNode.css';

/**
 * One story at the tree's top level: expand control, identifier, title, status.
 *
 * **Two controls rather than one**, because the row does two unrelated things.
 * The chevron opens the story; the rest of the row selects it so the pane can
 * show it in full. Folding them together would mean a developer could not read a
 * story's narrative without also expanding its tasks, or could not collapse a
 * long story without losing what the pane was showing.
 *
 * Nested buttons are invalid, so the row is a container holding two siblings
 * rather than a button inside a button.
 *
 * Status goes through `StatusLabel` and is never classified here —
 * `source-hygiene.test.ts` fails the build otherwise, and it is the right answer
 * anyway: a tracker's *Done* should look like every other *Done* on the board.
 */

/**
 * The scope with no story behind it, named where it is drawn.
 *
 * **These two strings also exist in `views/stories/StoryList.tsx`**, which draws
 * the same scope in the view this one displaces. Two copies is a real cost and
 * it is deliberate: sharing them would mean exporting vocabulary from a
 * component, and the duplication ends when the Stories and Tasks views retire.
 * If you change one, change the other.
 */
const NO_STORY_ID = '—';
const NO_STORY_TITLE = 'Tasks belonging to no reported story';

export function StoryNode({
  scope,
  open,
  selected,
  onToggle,
  onSelect,
  children,
}: {
  scope: Scope;
  open: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  /** The counted progress slot, filled by the view. */
  children?: React.ReactNode;
}): React.JSX.Element {
  const { story } = scope;

  // Narrowed to values rather than booleans, so the `title` attributes can see
  // they are strings.
  const reported = story !== null && story.status !== null && story.status.trim() !== ''
    ? story.status
    : null;
  const id = story?.id ?? NO_STORY_ID;
  const title = story?.title ?? NO_STORY_TITLE;
  const key = scopeKey(scope);

  /*
   * Counted only where the agent said nothing about the story's state.
   *
   * A reported status always wins (FR-024), and putting a count beside one would
   * invite the reader to notice a disagreement the board is forbidden to present
   * (FR-029). The unassigned group gets none either: it has no story, so there
   * is no reported status for a count to stand in for, and counting a group the
   * agent never declared would be inventing a subject.
   */
  const progress = reported === null && story !== null ? storyProgress(scope.tasks) : null;

  return (
    <div className="storynode" data-selected={selected} data-open={open}>
      <button
        type="button"
        className="storynode__toggle"
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${id}`}
        onClick={() => {
          onToggle(scope.id);
        }}
        data-testid={`speckit-toggle-${key}`}
      >
        <span className="storynode__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>

      <button
        type="button"
        className="storynode__main"
        data-selected={selected}
        aria-current={selected ? 'true' : undefined}
        onClick={() => {
          onSelect(scope.id);
        }}
        data-testid={`speckit-story-${key}`}
      >
        <span className="storynode__id" title={id}>
          {id}
        </span>
        <span className="storynode__title" title={title}>
          {title}
        </span>
        {reported === null ? null : <StatusLabel status={reported} />}
        {/*
          Arithmetic, and it looks like arithmetic — no disc, no colour, no pill.
          FR-026 wants it distinguishable from a reported status by inspection
          alone, and the cheapest way to be distinguishable from a status is not
          to be styled as one.
        */}
        {progress === null ? null : (
          <span className="storynode__progress" data-testid={`speckit-progress-${key}`}>
            {formatStoryProgress(progress)}
          </span>
        )}
        {children}
      </button>
    </div>
  );
}
