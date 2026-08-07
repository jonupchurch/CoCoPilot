import { useEffect, useRef, useState } from 'react';

import type { Scope } from '../../state/useSelection.js';
import { taskSummary } from './StoryList.js';

import './StoryPicker.css';

/**
 * The story list, collapsed to one row, for a panel too narrow to hold both.
 *
 * Each option shows identifier, title and task count — enough to tell them
 * apart, which US4 scenario 4 asks for explicitly and which a bare title would
 * fail for a spec whose stories all begin "As a developer…".
 *
 * A `<button>` and a list of `<button>`s rather than a `<select>`: the option
 * rows carry three fields at three weights, and a native select can only hold a
 * string. The cost is that dismissal has to be built, which is the code below.
 */

const NO_STORY_ID = '—';
const NO_STORY_TITLE = 'Tasks belonging to no reported story';

export function StoryPicker({
  scopes,
  selected,
  onSelect,
}: {
  scopes: readonly Scope[];
  selected: string;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    // Dismiss on anything that means "not this": a click elsewhere, or Escape.
    // Both are subscriptions with cleanup, which is what an effect is for.
    const onPointerDown = (event: MouseEvent): void => {
      if (!(event.target instanceof Node)) return;
      if (root.current?.contains(event.target) === true) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const current = scopes.find((scope) => scope.id === selected) ?? scopes[0];
  if (current === undefined) {
    // Unreachable while the view checks for an empty selection first, and
    // cheaper than making every field below optional to prove it.
    return <div className="storypicker" />;
  }

  return (
    <div className="storypicker" ref={root}>
      <button
        type="button"
        className="storypicker__current"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen((was) => !was);
        }}
        data-testid="story-picker"
      >
        <Fields scope={current} />
        <span className="storypicker__caret" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div className="storypicker__options" role="listbox" data-testid="story-picker-options">
          {scopes.map((scope) => (
            <button
              type="button"
              key={scope.id}
              className="storypicker__option"
              role="option"
              aria-selected={scope.id === selected}
              data-selected={scope.id === selected}
              onClick={() => {
                onSelect(scope.id);
                setOpen(false);
              }}
              data-testid={`story-option-${scope.id}`}
            >
              <Fields scope={scope} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Fields({ scope }: { scope: Scope }): React.JSX.Element {
  const id = scope.story?.id ?? NO_STORY_ID;
  const title = scope.story?.title ?? NO_STORY_TITLE;

  return (
    <>
      <span className="storypicker__id" title={id}>
        {id}
      </span>
      <span className="storypicker__title" title={title}>
        {title}
      </span>
      <span className="storypicker__tasks">{taskSummary(scope.tasks)}</span>
    </>
  );
}
