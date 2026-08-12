import { useCallback, useState } from 'react';

/**
 * Which of the work destinations a session offers: the Spec-Kit tree, the
 * separate Stories and Tasks views, or — for a while — both.
 *
 * **Two booleans, both one-way, and that is the entire safety argument.**
 *
 * `everReportedStories` is held in the store and never cleared. A session id is
 * only ever *added* to the set of those whose legacy views have been opened.
 * Neither can go from true to false while a session lives, so no destination
 * governed here can go from offered to not-offered — except the legacy views at
 * the single moment the tree first appears, and at that moment "has the
 * developer opened one" decides.
 *
 * A developer who has never opened a view cannot be reading it. So there is no
 * state of the world in which a destination is taken away from a reader, which
 * is why FR-007 needs no code of its own: it is a property of these two
 * monotonic values rather than a rule anyone has to honour.
 *
 * This matters because it is exactly what decision 36 was raised about. That
 * decision records the count-gated tab strip withdrawing the Tasks tab from a
 * developer mid-read, "whereupon the active-tab fallback moved them to
 * Overview". Nothing here can produce that sequence. **Anything that can clear
 * either value re-opens it.**
 *
 * Every other destination — Overview, Notes, and feature 010's ticket view —
 * keeps whatever rule it already has and is not this file's business.
 */

export interface Presence {
  /** The Spec-Kit tree. Offered once this session has ever reported a story. */
  tree: boolean;
  /** The Stories and Tasks views, which stand or fall together. */
  oldViews: boolean;
}

/**
 * The whole rule, as a function of the two facts behind it.
 *
 * Pure and exported so it can be tested directly, following `resolveUnread`:
 * there is no React testing library in this repo, and a rule this small does not
 * justify introducing one.
 */
export function resolvePresence(everReportedStories: boolean, usedOldViews: boolean): Presence {
  const tree = everReportedStories;

  // A session that is not Spec-Kit shaped keeps the old views because they are
  // the only ones it has; a Spec-Kit session keeps them only if the developer
  // has already been there.
  return { tree, oldViews: !tree || usedOldViews };
}

export interface PresenceState extends Presence {
  /**
   * Record that the developer opened the story or task view for this session.
   *
   * Called from the navigation itself rather than from a render of either view,
   * so that a view rendered for any other reason cannot mark it used.
   */
  noteOldViewOpened: () => void;
}

/**
 * `usedOldViews` lives here rather than in the store because it is not a fact
 * about the work: no agent reported it, and no other window would agree about
 * it. History belongs to the main process; one person's use of one window
 * belongs to the window. It dies on restart, which FR-039 requires.
 *
 * Keyed by session (FR-006). Opening the task view in one session says nothing
 * about another.
 */
export function usePresence(
  sessionKey: string | null,
  everReportedStories: boolean,
): PresenceState {
  const [used, setUsed] = useState<ReadonlySet<string>>(() => new Set());

  const noteOldViewOpened = useCallback((): void => {
    if (sessionKey === null) return;
    setUsed((current) => {
      // Adding what is already there would still be a new Set and a new render.
      if (current.has(sessionKey)) return current;
      return new Set(current).add(sessionKey);
    });
  }, [sessionKey]);

  const resolved = resolvePresence(
    everReportedStories,
    sessionKey !== null && used.has(sessionKey),
  );

  return { ...resolved, noteOldViewOpened };
}
