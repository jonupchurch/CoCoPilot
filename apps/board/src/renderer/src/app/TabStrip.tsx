import './TabStrip.css';

/**
 * The four destinations. Rendered only when there is somewhere to go.
 *
 * The strip is hidden entirely in the waiting state, and that is the only time
 * it is hidden: since decision 36 every tab is offered from the first report
 * onwards whether or not its view has content, and each view answers its own
 * emptiness. This component never decided which tabs to draw — it is handed
 * `available` — so the change is not here; what is here is the one remaining
 * absence, which is about there being no session rather than no content.
 *
 * Tabs are view state, not routes. Giving them URLs would invent history, deep
 * links and back semantics that a single desktop panel does not have.
 */

/**
 * The Spec-Kit tree sits where the story view sits, because it is what displaces
 * it: the reading order stays overview, then the work, then the log. Which of
 * these a session is actually offered is `usePresence`'s decision, not this
 * file's — see `App.tsx`.
 */
/**
 * The reading order: overview, where the work came from, the work, then the log.
 * Which of these a session is actually offered is decided in `App.tsx` — this
 * component is handed `available` and has never chosen.
 *
 * The Spec-Kit tree sits where the story view sits, because it is what displaces
 * it.
 *
 * **The ticket sits second, and that is functional rather than aesthetic.** The
 * active destination falls back to the first available one, so a ticket
 * destination placed first would silently change which view a ticket-driven
 * session lands on. Overview stays the landing view for every session. Second
 * because the ticket is where the work *came from*, and so is read before what
 * the agent decided to do about it.
 */
export const TABS = ['overview', 'ticket', 'speckit', 'stories', 'tasks', 'notes'] as const;

export type Tab = (typeof TABS)[number];

/**
 * "Stories" rather than "User Stories" since feature 010.
 *
 * Six destinations have to fit the 380px floor, and this is the only label with
 * a word that carries nothing: every story on this board is a user story, so
 * "User" distinguishes it from nothing. Shortening a label is cheaper than
 * shrinking type or dropping a destination, and it is the only one where a word
 * could go without losing meaning.
 */
const LABELS: Record<Tab, string> = {
  overview: 'Overview',
  ticket: 'Ticket',
  speckit: 'Spec-Kit',
  stories: 'Stories',
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
