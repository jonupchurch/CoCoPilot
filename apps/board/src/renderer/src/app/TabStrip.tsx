import './TabStrip.css';

/**
 * The four destinations. Rendered only when there is somewhere to go.
 *
 * A tab whose view would be empty is a dead end, so the strip is hidden entirely
 * in the waiting state and each individual tab appears only once its content
 * exists (FR-009). The contents themselves are features 004 through 008; this
 * feature owns the frame.
 *
 * Tabs are view state, not routes. Giving them URLs would invent history, deep
 * links and back semantics that a single desktop panel does not have.
 */

export const TABS = ['overview', 'stories', 'tasks', 'notes'] as const;

export type Tab = (typeof TABS)[number];

const LABELS: Record<Tab, string> = {
  overview: 'Overview',
  stories: 'User Stories',
  tasks: 'Tasks',
  notes: 'Notes',
};

export function TabStrip({
  available,
  active,
  unread,
  onSelect,
}: {
  available: readonly Tab[];
  active: Tab;
  /**
   * Whether a note arrived while the developer was elsewhere.
   *
   * A boolean, and the strip is told it rather than working it out: this file
   * knows about destinations, not about notes. **There is no number here and no
   * way to pass one** — FR-012 lives as much in this signature as in the markup
   * below, because a component that cannot receive a count cannot start
   * rendering one.
   */
  unread?: boolean;
  onSelect: (tab: Tab) => void;
}): React.JSX.Element | null {
  if (available.length === 0) return null;

  return (
    <nav className="tabstrip" aria-label="Views">
      {available.map((tab) => {
        const marked = tab === 'notes' && unread === true;

        return (
          <button
            key={tab}
            type="button"
            className="tabstrip__tab"
            aria-current={tab === active ? 'page' : undefined}
            data-active={tab === active}
            data-unread={marked}
            data-testid={`tab-${tab}`}
            onClick={() => {
              onSelect(tab);
            }}
          >
            <span className="tabstrip__top">
              <span className="tabstrip__label">{LABELS[tab]}</span>
              {/*
                A mark, not a badge. `aria-hidden`, with the fact carried in the
                tab's accessible name instead — a decorative dot announced as
                "bullet" tells a screen reader user nothing, and a count would
                tell everyone something untrue.
              */}
              {marked ? (
                <>
                  <span className="tabstrip__dot" aria-hidden="true" data-testid="tab-notes-unread" />
                  <span className="visually-hidden">new</span>
                </>
              ) : null}
            </span>
            <span className="tabstrip__rule" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
