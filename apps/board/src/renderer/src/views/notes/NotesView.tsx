import type { SessionView } from '../../../../main/view.js';
import { elapsed } from '../../lib/elapsed.js';
import { ImpermanenceFooter } from './ImpermanenceFooter.js';
import { NoteRow } from './NoteRow.js';

import './NotesView.css';

/**
 * The notes tab: what the agent recorded this session, newest first.
 *
 * The only view on the board whose content **accumulates**. Everything else is
 * replaced wholesale by the next report (decision 26), which is why this is the
 * only place where a row's identity across an update matters at all — see the
 * key below.
 *
 * Read-only and structurally so, like the other two detail views: there is no
 * control in this tree that sends anything anywhere, because no such component
 * exists to import. Here the absence carries more weight than usual, because a
 * pin or a star would not break any code — it would falsify the footer.
 */
export function NotesView({
  session,
  now,
}: {
  session: SessionView;
  now: number;
}): React.JSX.Element {
  /*
   * Newest first by **reversing arrival order**, not by sorting on
   * `receivedAt`.
   *
   * Two notes can share a millisecond, and a sort would order those two
   * arbitrarily — differently between renders, given an unstable sort — where
   * arrival order is a fact the store already established. The reverse is a
   * display decision, made here and nowhere else; the projection stays in the
   * order the notes arrived.
   */
  const newest = session.notes.map((note, arrival) => ({ note, arrival })).reverse();

  return (
    <div className="notes" data-testid="notes">
      <div className="notes__head">
        <span className="notes__label">This session</span>
        <span className="notes__summary" data-testid="notes-summary">
          {summary(session.notes.length, session.notes[0]?.receivedAt ?? null, now)}
        </span>
      </div>

      {/*
        A guard rather than a state the strip can currently produce: a tab whose
        view would be empty is not offered (feature 003), so this tab appears
        only once a note exists and the active tab falls back if it stops being
        available. FR-010 is satisfied by that rule; this is what would be shown
        if the rule ever changed, and the other two detail views hold the same
        line for the same reason.
      */}
      {newest.length === 0 ? (
        <p className="notes__empty" data-testid="notes-empty">
          Nothing recorded yet. Ask the agent to note something and it will appear here.
        </p>
      ) : (
        <div className="notes__list" data-testid="notes-list">
          {newest.map(({ note, arrival }) => (
            // An array index as a key, which `stacks/vite-react.md` forbids —
            // and this is the one list in the product where it is right. The
            // rule exists because these lists *reorder* when a report replaces
            // them, so position is not identity. Notes never reorder: they only
            // append, so a note's arrival index is fixed for the life of the
            // window and is the only stable identifier available (`receivedAt`
            // is not one; two notes can share a millisecond).
            //
            // Keying by *display* position would be the failure the rule
            // describes: every row renumbered on each arrival, remounting the
            // list under a reader mid-sentence.
            <NoteRow key={arrival} note={note} arrival={arrival} now={now} />
          ))}
        </div>
      )}

      <ImpermanenceFooter count={session.notes.length} />
    </div>
  );
}

/**
 * `12 notes · over 47m`, the export's header summary.
 *
 * The export writes `since 09:14`. A wall clock is the one time format nothing
 * else in this product uses: every other time here is elapsed, which is true in
 * any timezone and never needs to say which day it means. So the span is stated
 * the way the rest of the board states time.
 *
 * The count is allowed here for the reason `ImpermanenceFooter` gives: the
 * assumption that notes are not counted anywhere is an argument against a badge
 * on the tab, and this is a header describing the list beneath it — the same
 * derived summary every other section header on the board carries.
 */
function summary(count: number, oldest: number | null, now: number): string {
  if (count === 0) return 'none yet';

  const noun = count === 1 ? '1 note' : `${count} notes`;
  if (oldest === null) return noun;

  return `${noun} · over ${elapsed(oldest, now)}`;
}
