/**
 * The one rule for whether a reported address may be opened, with three callers.
 *
 * A ticket's address is **agent-composed**, and any local process may report to
 * the board (decision 18). Handing such a string to the operating system's URL
 * handler is the only genuinely dangerous act this product performs: the OS will
 * gladly launch a registered application handler, and the board would have asked
 * it to.
 *
 * So there is exactly one implementation, imported by all three places that need
 * an answer — the contract at ingest, the renderer deciding whether to draw a
 * control, and the main process re-checking immediately before the OS call. Two
 * copies of a security rule drift, and the one that drifts is the one nobody
 * reads. This mirrors how `caps.ts` is already shared.
 */

/**
 * Whether an address is an ordinary web address, and therefore openable.
 *
 * **Parsed, never matched, and this is load-bearing rather than fastidious.**
 * Every cheaper form of this check is wrong in a way that has a working exploit:
 *
 * - `startsWith('http')` admits `httpx://example.com`, and any other protocol
 *   somebody registers whose name begins with those four letters.
 * - `includes('https://')` admits `javascript:void(0)//https://example.com`,
 *   where the real protocol is `javascript:` and the rest is a comment.
 * - A regular expression over the whole string has to re-implement URL parsing,
 *   including the percent-encoding, unicode and backslash cases the platform
 *   parser already handles and a hand-written pattern does not.
 *
 * Only the *parsed* protocol is trusted, and only two values of it. `URL` also
 * normalises the protocol to lower case with its colon, so `HTTPS:` compares
 * equal without a case fold of our own.
 *
 * **Nothing is repaired** (FR-022). `www.example.com` has no protocol, so it is
 * refused rather than promoted to `https:`; a `file:` address is refused rather
 * than rewritten. Repairing an address is guessing what the sender meant, and
 * the sender is a program.
 *
 * Anything that is not a string is refused without being coerced — the value
 * crosses a process boundary, and `String(x)` on a hostile object calls its own
 * `toString`.
 */
export function isOpenable(url: unknown): url is string {
  if (typeof url !== 'string') return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // No protocol, or unparseable. Either way there is nothing to open.
    return false;
  }

  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}
