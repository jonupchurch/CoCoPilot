import './Section.css';

/**
 * A labelled, collapsible division — the organising unit of the Overview tab.
 *
 * `summary` is **required**, and typed so that neither `null` nor `undefined`
 * satisfies it. That is the whole point of this component: SC-002 says a
 * developer with every section closed can still read the feature's completion,
 * position in the plan and volume of change, and the only way to keep that true
 * as sections are added later is to make a section without a summary fail to
 * compile. A convention would have decayed by feature 006.
 *
 * The header is a real `<button>`, so it is reachable and operable from the
 * keyboard without this file knowing anything about keys, and carries
 * `aria-expanded` so the state is announced rather than only drawn.
 *
 * The body is unmounted when collapsed rather than hidden. A hidden subtree
 * still holds agent-composed text in the accessibility tree and still ticks with
 * every render; collapsed should mean gone.
 */
export function Section({
  label,
  summary,
  open,
  onToggle,
  testId,
  children,
}: {
  label: string;
  summary: string | React.JSX.Element;
  open: boolean;
  onToggle: () => void;
  testId: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const id = `section-${testId}`;

  return (
    <section className="section" data-testid={`section-${testId}`} data-open={open}>
      <button
        type="button"
        className="section__header"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        data-testid={`section-toggle-${testId}`}
      >
        <span className="section__caret" aria-hidden="true">
          {open ? '▼' : '▶'}
        </span>
        <span className="section__label">{label}</span>
        <span className="section__summary" data-testid={`section-summary-${testId}`}>
          {summary}
        </span>
      </button>

      {open ? (
        <div className="section__body" id={id}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
