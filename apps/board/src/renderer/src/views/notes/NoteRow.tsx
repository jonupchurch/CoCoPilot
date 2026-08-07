import type { Note } from '../../../../main/store.js';
import { elapsed } from '../../lib/elapsed.js';

import './NoteRow.css';

/**
 * One note: when, what, and — if the agent said so — why.
 *
 * **Flat, and no card.** Three lines at 13px with no container, because the
 * density is the design: forty cards is forty boxes to read past, and forty
 * rows is one column to read down. This is the design round's reasoning and it
 * is what makes a long session survivable.
 *
 * `elapsed` rather than `focusAge`: the focus tag coarsens the first minute to
 * `now`, which is right for one value that ticks and wrong for a list where
 * several notes can land inside the same minute and need telling apart.
 *
 * Two departures from the export, both because the payload does not carry what
 * it draws:
 *
 * - It shows **two** mono values under each note — a phrase (`noticed while
 *   editing`) and a file path or identifier (`src/hooks/useSession.ts`,
 *   `US-002`). `NoteRequest` has exactly one optional `source`. Splitting it on
 *   a separator to manufacture the second would be inventing structure the
 *   agent did not write.
 * - The gutter dot is teal on the newest row and **ember** on one of the
 *   others. Neither is available. Ember is the attention colour and decision 15
 *   makes the chip the only channel by which an agent asks for a human, so a
 *   note colouring itself ember would be a second one — and every note would
 *   arrive claiming it, because nothing distinguishes them. Teal on the newest
 *   says "most recent", which the relative time beside it already says exactly.
 *   So the dot is one muted treatment: a mark that a row starts here, which is
 *   the only thing it actually knows.
 */
export function NoteRow({
  note,
  arrival,
  now,
}: {
  note: Note;
  /**
   * Its position in arrival order — **not** its position on screen.
   *
   * Two notes can share a `receivedAt` to the millisecond, so the timestamp is
   * not an identifier. Arrival order is: notes only ever append, so a note's
   * arrival index never changes, where its display index shifts by one every
   * time another arrives.
   */
  arrival: number;
  now: number;
}): React.JSX.Element {
  const source = note.source?.trim() === '' ? null : note.source;

  return (
    <div className="noterow" data-testid={`note-${arrival}`}>
      <div className="noterow__gutter">
        <span className="noterow__age" data-testid={`note-age-${arrival}`}>
          {elapsed(note.receivedAt, now)}
        </span>
        <span className="noterow__dot" aria-hidden="true" />
      </div>

      <div className="noterow__body">
        <p className="noterow__text">{note.text}</p>
        {source === null ? null : (
          <div className="noterow__meta">
            <span className="noterow__source" title={source}>
              {source}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
