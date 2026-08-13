import type { Comment } from 'cocoapilot-contract';

import './CommentList.css';

/**
 * The ticket's discussion — routinely where the actual requirement lives.
 *
 * **Oldest first, as reported**, which is the opposite of the notes view and
 * deliberately so: a note log is read newest-first because the newest is the one
 * that just arrived, while a discussion is read forward because each comment
 * answers the one above it. Reversing a thread makes the replies come first.
 *
 * Nothing here is sorted, deduplicated or re-attributed. The order is the
 * agent's, which is the tracker's.
 */
export function CommentList({
  comments,
  omitted,
}: {
  comments: readonly Comment[];
  omitted: number | null;
}): React.JSX.Element {
  if (comments.length === 0) {
    return (
      <p className="comments__empty" data-testid="ticket-no-comments">
        No comments were reported for this ticket.
      </p>
    );
  }

  return (
    <div className="comments" data-testid="ticket-comments">
      {comments.map((comment, index) => (
        /*
         * Position is identity. Comments arrive as a list and are replaced as a
         * list — they never reorder or update in place — so there is no
         * identifier to model, exactly as for a report's tasks. The index is
         * part of the key because two comments can legitimately be identical.
         */
        <article className="comments__row" key={`${index}:${comment.author ?? ''}`}>
          <div className="comments__meta">
            {comment.author === null ? null : (
              <span className="comments__author" data-testid={`ticket-comment-author-${index}`}>
                {comment.author}
              </span>
            )}
            {comment.at === null ? null : (
              /*
               * Rendered as **the label it is**, never parsed into a time.
               *
               * Every time this board shows is elapsed and stamped from a clock
               * it controls. A tracker's comment date is neither: parsing it
               * would mean guessing a format and a timezone, and then computing
               * an age the board cannot vouch for. Shown as the tracker wrote
               * it, and it sits in a different slot from the board's own
               * elapsed time so the two are never read as the same kind of
               * thing.
               */
              <span className="comments__at" data-testid={`ticket-comment-at-${index}`}>
                {comment.at}
              </span>
            )}
          </div>
          <p className="comments__text">{comment.text}</p>
        </article>
      ))}

      <Omitted shown={comments.length} omitted={omitted} />
    </div>
  );
}

/**
 * How many comments the agent left out — FR-016.
 *
 * **Reported, never derived**, and this is a place the board is honestly
 * dependent on the agent: it cannot know a ticket had 200 comments when it was
 * sent 50. The alternative was showing 50 as though they were all of them, which
 * is worse than saying nothing, because a developer who has read the whole
 * discussion behaves differently from one who thinks they have.
 *
 * Absent when nothing was omitted, rather than "0 not included" — a line saying
 * nothing is missing is itself a claim the board would be making on the agent's
 * behalf every time the field is simply unreported.
 */
function Omitted({
  shown,
  omitted,
}: {
  shown: number;
  omitted: number | null;
}): React.JSX.Element | null {
  if (omitted === null || omitted <= 0) return null;

  return (
    <p className="comments__omitted" data-testid="ticket-comments-omitted">
      {shown} shown, {omitted} not included
    </p>
  );
}
