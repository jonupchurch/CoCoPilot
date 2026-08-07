import { useState } from 'react';

/**
 * Whether a note arrived while the developer was looking at something else.
 *
 * **Deliberately trivial, and it has to stay that way.** No count, no
 * persistence, no per-note read state. A count would read as an inbox with
 * something to clear, and there is nothing to clear — which is precisely the
 * misunderstanding this feature's second P1 story exists to prevent. So the
 * answer is a boolean, and there is no number for a caller to reach.
 *
 * The rule is a comparison, not an event: "more notes exist than existed when
 * the notes view was last on screen". That matters because an arrival is not
 * observable from the renderer — state arrives as a whole snapshot over the
 * bridge, so two notes landing between renders are one update. An effect
 * watching for arrivals would need a previous value to compare against anyway,
 * and would leave the answer one render behind the thing it describes.
 */

export interface Unread {
  /** The count to remember. Equal to the one passed in when nothing changed. */
  seen: number;
  unread: boolean;
}

/**
 * The whole rule, as a function of what is held and what is on screen.
 *
 * Pure and exported so it can be tested directly: there is no React testing
 * library in this repo, and a rule this small does not justify introducing one.
 */
export function resolveUnread(seen: number, noteCount: number, viewing: boolean): Unread {
  // Looking at them is having seen them, at whatever count they are now.
  if (viewing) return { seen: noteCount, unread: false };

  /*
   * Fewer notes than were seen is not an arrival.
   *
   * This cannot happen within one session — notes only ever append — but the
   * count belongs to whichever session is *selected*, and since feature 008 the
   * developer can switch. Switching from a session with forty notes to one with
   * two is a drop, and without this line the dot would appear for a note nobody
   * wrote and never clear. Written defensively before it was reachable; it is
   * reachable now, and `sessions.spec.ts` exercises it.
   */
  if (noteCount < seen) return { seen: noteCount, unread: false };

  return { seen, unread: noteCount > seen };
}

/**
 * State adjusted during render rather than in an effect, which is the pattern
 * React documents for a value derived from props that needs to remember
 * something. An effect would paint the dot for one frame on the very tab it is
 * meant to be absent from.
 */
export function useUnread(noteCount: number, viewing: boolean): boolean {
  // Seeded with what is already held: a board that opens onto existing notes
  // has not had one *arrive* behind the developer's back.
  const [seen, setSeen] = useState(noteCount);

  const next = resolveUnread(seen, noteCount, viewing);
  if (next.seen !== seen) setSeen(next.seen);

  return next.unread;
}
