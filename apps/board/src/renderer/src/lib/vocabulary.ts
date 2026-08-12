/**
 * Which reported statuses the board is willing to paint a colour on.
 *
 * `status` is free text in the contract, deliberately (decision 25). Mapping
 * some of those strings to signal colours is a *display* decision, which is why
 * this table lives in the renderer and not in `packages/contract`: a union there
 * would make an unrecognised status a validation failure rather than a display
 * case, and the board would start rejecting agents for describing their own work
 * in their own words.
 *
 * Teal, blue and ember each mean something specific. An arbitrary string cannot
 * honestly be given one, so anything not in the table below renders neutral with
 * its text shown exactly as it arrived.
 */

/** The four the design has treatments for. */
export type Recognised = 'todo' | 'active' | 'blocked' | 'done';

export type Vocabulary = Recognised | 'unrecognised';

/**
 * The documented set, and the whole of it. Small on purpose — an unrecognised
 * status is harmless, so the cost of leaving a term out is far below the cost of
 * claiming one means something it does not.
 *
 * Mirrored in `docs/design/push-schema.md`, which is what an agent author reads.
 *
 * A `Map` rather than an object literal, because the lookup key is text an agent
 * composed: `SYNONYMS['constructor']` on a plain object returns something
 * inherited and truthy, and a task whose status is `toString` would render a
 * treatment nobody chose. A `Map` has no such keys.
 */
export const SYNONYMS: ReadonlyMap<string, Recognised> = new Map<string, Recognised>([
  ['done', 'done'],
  ['complete', 'done'],
  ['completed', 'done'],
  ['finished', 'done'],

  ['active', 'active'],
  ['in progress', 'active'],
  ['in-progress', 'active'],
  ['wip', 'active'],
  ['doing', 'active'],
  ['working', 'active'],
  ['started', 'active'],

  ['blocked', 'blocked'],
  ['blocker', 'blocked'],
  ['stuck', 'blocked'],

  ['todo', 'todo'],
  ['to do', 'todo'],
  ['to-do', 'todo'],
  ['pending', 'todo'],
  ['not started', 'todo'],
  ['queued', 'todo'],
]);

/**
 * Case and surrounding whitespace are ignored. **Nothing else is.**
 *
 * No prefix matching, no stemming, no edit distance. A near miss — `donee` —
 * renders neutral, which costs a colour. A wrong match paints a signal colour on
 * something the board does not understand, which tells the developer a thing
 * that is not true. The asymmetry is the whole argument.
 */
export function classify(status: string): Vocabulary {
  return SYNONYMS.get(status.trim().toLowerCase()) ?? 'unrecognised';
}

/** Counting completion for a section header. Recognition only, never a guess. */
export function isDone(status: string): boolean {
  return classify(status) === 'done';
}

export function isActive(status: string): boolean {
  return classify(status) === 'active';
}

/** Every bucket, plus how many statuses were counted into them. */
export type Tally = Record<Vocabulary, number> & { total: number };

/**
 * Counting a set of statuses, bucket by bucket.
 *
 * Here rather than beside the caller for the reason `classify` is here at all:
 * `source-hygiene.test.ts` fails the build if anything outside this file and
 * `StatusLabel.tsx` classifies a status, and counting *is* classifying — a
 * tallier elsewhere would be a second place deciding what `wip` means.
 *
 * **`unrecognised` is a bucket, never a remainder.** Folding it into `todo`
 * would be the guess `classify` refuses two paragraphs above: a story whose five
 * tasks carry idiosyncratic words is not five tasks outstanding, it is five
 * tasks the board cannot read, and a caller that wants to say so needs the
 * number to say it with.
 */
export function tally(statuses: readonly string[]): Tally {
  const counts: Tally = {
    todo: 0,
    active: 0,
    blocked: 0,
    done: 0,
    unrecognised: 0,
    total: statuses.length,
  };

  for (const status of statuses) counts[classify(status)] += 1;

  return counts;
}
