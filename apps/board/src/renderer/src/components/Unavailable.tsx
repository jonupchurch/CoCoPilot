import './Unavailable.css';

/**
 * "This section could not read its source" — in one place, for all three of
 * them.
 *
 * The Last prompt, History and In context sections share a single source, so
 * they share a single failure and should say so identically. Written once
 * because three copies of a sentence drift, and because SC-006's requirement is
 * about how the two states *look*, which is not a thing to re-decide per
 * section.
 *
 * The wording is fixed rather than passed in. What failed is the same fact every
 * time — the transcript could not be read — and a caller free to phrase it would
 * eventually phrase one of them as though nothing were wrong.
 */

const SENTENCE = 'Unavailable — no transcript could be read for this session.';

/** The body treatment: a bordered block, where an empty state is bare text. */
export function UnavailableNote({ testId }: { testId: string }): React.JSX.Element {
  return (
    <p className="unavailable__note" data-testid={testId}>
      {SENTENCE}
    </p>
  );
}

/**
 * The header treatment, which exists because collapsing a section unmounts its
 * body and leaves the summary carrying the whole distinction on its own.
 */
export function UnavailableSummary({ testId }: { testId: string }): React.JSX.Element {
  return (
    <span className="unavailable__summary" data-testid={testId}>
      unavailable
    </span>
  );
}
