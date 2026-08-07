/**
 * Three states, and the third is the reason this module exists.
 *
 * `available` | `empty` | `unreadable`. A section that shows nothing because it
 * could not parse anything, drawn identically to one that shows nothing because
 * there is nothing, misleads silently — and it misleads in the worst direction,
 * by looking like a confident answer. SC-006 forbids it and this type is what
 * makes the collapse hard to write by accident.
 *
 * The value rides on the `available` arm only. A caller cannot reach a list out
 * of an unreadable section without first narrowing, which is the whole point of
 * a discriminated union over `{ value, error }`.
 */

export type Availability<T> =
  | { state: 'available'; value: T }
  | { state: 'empty' }
  | { state: 'unreadable'; reason: string };

export function available<T>(value: T): Availability<T> {
  return { state: 'available', value };
}

export function empty<T>(): Availability<T> {
  return { state: 'empty' };
}

export function unreadable<T>(reason: string): Availability<T> {
  return { state: 'unreadable', reason };
}

/**
 * A list that is genuinely empty reports `empty`, not `available: []`.
 *
 * Both would render the same today. They stop being the same the moment a
 * section wants to say "nothing yet" differently from "nothing at all", and
 * deciding it here means no section has to decide it twice.
 */
export function fromList<T>(items: readonly T[]): Availability<readonly T[]> {
  return items.length === 0 ? empty() : available(items);
}
