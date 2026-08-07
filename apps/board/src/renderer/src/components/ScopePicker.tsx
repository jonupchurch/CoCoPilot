import { useEffect, useRef, useState } from 'react';

import { taskSummary } from '../lib/summarise.js';
import { scopeKey, type Scope } from '../state/useSelection.js';

import './ScopePicker.css';

/**
 * The story list collapsed to one row, with the rest behind a caret.
 *
 * Shared by both detail views, and for **different reasons** — which is why it
 * lives here rather than in either of them. The Stories tab shows it only below
 * the breakpoint, as the narrow substitute for its column. The Tasks tab shows
 * it at every width, because there it is not a fallback: it is the control that
 * says which story's tasks are on screen, and a scope control that disappeared
 * when the window grew would leave the view with no way to change scope at all.
 *
 * One component rather than two near-identical ones. The dismissal below is the
 * fiddly part, and a second copy of it would be a second thing to get wrong.
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

export function ScopePicker({
  scopes,
  selected,
  onSelect,
  testId,
}: {
  scopes: readonly Scope[];
  selected: string;
  onSelect: (id: string) => void;
  /** Names this instance, so two of them on two tabs are separately addressable. */
  testId: string;
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
    return <div className="scopepicker" />;
  }

  return (
    <div className="scopepicker" ref={root}>
      <button
        type="button"
        className="scopepicker__current"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          setOpen((was) => !was);
        }}
        data-testid={testId}
      >
        <Fields scope={current} />
        <span className="scopepicker__caret" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div className="scopepicker__options" role="listbox" data-testid={`${testId}-options`}>
          {scopes.map((scope) => (
            <button
              type="button"
              key={scope.id}
              className="scopepicker__option"
              role="option"
              aria-selected={scope.id === selected}
              data-selected={scope.id === selected}
              onClick={() => {
                onSelect(scope.id);
                setOpen(false);
              }}
              data-testid={`${testId}-option-${scopeKey(scope)}`}
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
      <span className="scopepicker__id" title={id}>
        {id}
      </span>
      <span className="scopepicker__title" title={title}>
        {title}
      </span>
      <span className="scopepicker__tasks">{taskSummary(scope.tasks)}</span>
    </>
  );
}
