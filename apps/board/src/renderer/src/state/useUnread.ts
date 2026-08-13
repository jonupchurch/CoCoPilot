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
 *
 * **The comparison is per session, and that is not a detail.** FR-011 asks
 * whether a note arrived *for the selected session*, so a count from one session
 * says nothing about another and the two must never be subtracted. Keyed the way
 * `usePresence` keys its set, and for the same reason.
 */

export interface Unread {
  /** The count to remember. Equal to the one passed in when nothing changed. */
  seen: number;
  unread: boolean;
}

/**
 * The whole rule, as a function of what is remembered *for this session* and
 * what is on screen.
 *
 * Pure and exported so it can be tested directly: there is no React testing
 * library in this repo, and a rule this small does not justify introducing one.
 *
 * `seen` is null when this session has never been on screen before.
 */
export function resolveUnread(seen: number | null, noteCount: number, viewing: boolean): Unread {
  /*
   * Arriving at a session is not a note arriving at the developer.
   *
   * Whatever is already there is what they are turning up to, however much of
   * it there is — FR-011 marks a note that arrived *while the session was
   * selected and another view was active*, and none of these did. Without this,
   * switching to a busier session raises the dot for notes that arrived while
   * nobody was watching it, which is the false positive US3 exists to prevent.
   *
   * It is also the same seeding rule the window opens with, now stated once
   * instead of living in `useState`'s initialiser: a board that opens onto
   * existing notes has not had one *arrive* behind the developer's back.
   */
  if (seen === null) return { seen: noteCount, unread: false };

  // Looking at them is having seen them, at whatever count they are now.
  if (viewing) return { seen: noteCount, unread: false };

  /*
   * Fewer notes than were remembered means this is not the session that was
   * counted: notes only ever append, so within one session the count cannot
   * fall. It can only be a key reused — dismissed, then re-created under the
   * same repository and session id. The count on screen is the truth; the
   * memory is stale, and keeping it would swallow the next several arrivals.
   */
  if (noteCount < seen) return { seen: noteCount, unread: false };

  return { seen, unread: noteCount > seen };
}

/**
 * State adjusted during render rather than in an effect, which is the pattern
 * React documents for a value derived from props that needs to remember
 * something. An effect would paint the dot for one frame on the very tab it is
 * meant to be absent from.
 *
 * The map holds one number per session the window has shown, and is never
 * pruned: it dies with the window, and a number per session is nothing beside
 * the notes themselves. Pruning it would mean knowing which sessions are still
 * held, which is a second reason to re-render for no visible change.
 */
export function useUnread(
  sessionKey: string | null,
  noteCount: number,
  viewing: boolean,
): boolean {
  const [seen, setSeen] = useState<ReadonlyMap<string, number>>(() => new Map());

  // Nothing selected is nothing to have missed. Checked after the hook, never
  // before it.
  if (sessionKey === null) return false;

  const remembered = seen.get(sessionKey) ?? null;
  const next = resolveUnread(remembered, noteCount, viewing);
  if (next.seen !== remembered) {
    setSeen((current) => new Map(current).set(sessionKey, next.seen));
  }

  return next.unread;
}
