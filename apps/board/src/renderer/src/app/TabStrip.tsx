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
  onSelect,
}: {
  available: readonly Tab[];
  active: Tab;
  onSelect: (tab: Tab) => void;
}): React.JSX.Element | null {
  if (available.length === 0) return null;

  return (
    <nav className="tabstrip" aria-label="Views">
      {available.map((tab) => (
        <button
          key={tab}
          type="button"
          className="tabstrip__tab"
          aria-current={tab === active ? 'page' : undefined}
          data-active={tab === active}
          data-testid={`tab-${tab}`}
          onClick={() => {
            onSelect(tab);
          }}
        >
          <span className="tabstrip__label">{LABELS[tab]}</span>
          <span className="tabstrip__rule" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
