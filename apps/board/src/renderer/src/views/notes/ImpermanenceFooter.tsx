import './ImpermanenceFooter.css';

/**
 * The statement that makes the rest of this view honest.
 *
 * **Its own component on purpose.** As markup inside `NotesView` it could be
 * lost in a refactor by someone tidying a wrapper; as a component it has to be
 * *deliberately deleted*, and deleting a file called `ImpermanenceFooter`
 * cannot be done absent-mindedly. It is a requirement — FR-006 and FR-007 — not
 * decoration.
 *
 * **Not dismissible.** A warning that can be dismissed stops being read, and
 * this one has to be as true on the four hundredth note as on the first.
 *
 * The count is deliberate, and it is the one number this feature draws. The
 * spec's assumption that notes are not counted anywhere is an argument about a
 * *badge*: "a count invites clearing, and there is nothing to clear". That
 * reasoning is about the tab, where a number would read as an inbox — and the
 * tab has none. Here the number does the opposite work: `clears all 12` makes
 * the loss concrete, where "clears these notes" leaves the reader to guess
 * whether it means much. The sentence is the product's most important one, and
 * it is more true with the number in it.
 */
export function ImpermanenceFooter({ count }: { count: number }): React.JSX.Element {
  return (
    <footer className="impermanence" data-testid="impermanence">
      <p className="impermanence__text">
        Notes live in this window only. Closing it clears {clears(count)} — ask the agent to
        write anything worth keeping into the repository.
      </p>
    </footer>
  );
}

/**
 * `all 12`, `this one`, or `them` when there are none yet.
 *
 * The zero case still states the rule rather than going quiet: someone reading
 * an empty view is exactly the person about to ask for their first note, and
 * that is the best moment for them to know it will not be kept.
 */
function clears(count: number): string {
  if (count === 0) return 'them';
  if (count === 1) return 'the one below';
  return `all ${count}`;
}
