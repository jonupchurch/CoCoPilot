import { classify, type Vocabulary } from '../lib/vocabulary.js';

import './StatusLabel.css';

/**
 * The vocabulary made visible, two ways — the disc and the text.
 *
 * Both live in one file because they must never disagree. A row showing a teal
 * ✓ beside the word `blocked` would be worse than either alone, and the only way
 * that happens is if two files each decide what a status means.
 *
 * The text shown is always the text that was reported. A recognised status is
 * never replaced by its canonical form: an agent that wrote `wip` gets `wip`
 * back, coloured as active. Substituting `active` would be the board putting a
 * word on screen that nobody wrote.
 */

/**
 * `null` for an unrecognised status, and that is the point: the todo disc is an
 * outline circle, which says "not started" — a claim about a string the board
 * does not understand. The slot keeps its width so rows stay aligned, and the
 * status text carries the whole meaning instead.
 */
const GLYPHS: Readonly<Record<Vocabulary, string | null>> = {
  done: '✓',
  active: '',
  blocked: '!',
  todo: '',
  unrecognised: null,
};

export function StatusDisc({
  status,
  size = 14,
}: {
  status: string;
  size?: number;
}): React.JSX.Element {
  const kind = classify(status);
  const glyph = GLYPHS[kind];

  return (
    <span
      className={`disc disc--${kind}`}
      data-vocabulary={kind}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    >
      {kind === 'active' ? <span className="disc__pip" /> : glyph}
    </span>
  );
}

export function StatusLabel({ status }: { status: string }): React.JSX.Element | null {
  // Nothing reported is nothing to show. An empty span would still occupy a gap.
  if (status.trim() === '') return null;

  const kind = classify(status);

  return (
    <span className={`status status--${kind}`} data-vocabulary={kind} title={status}>
      {status}
    </span>
  );
}
