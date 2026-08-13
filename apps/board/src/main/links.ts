import { isOpenable } from 'cocoapilot-contract';
import { shell } from 'electron';

/**
 * The only outbound action this product has, and the only place it happens.
 *
 * Everything else CoCoapilot does is inward: it accepts what an agent reports
 * and draws it. This hands a string to the operating system's URL handler, which
 * will launch whatever application claims the protocol. That makes it the one
 * genuinely dangerous act here, and the reason it lives in a file of its own
 * rather than beside the other two IPC channels.
 *
 * **This check is the one that counts**, even though the renderer already ran
 * the same rule before drawing a control. The renderer is where agent-composed
 * text lives, and "the renderer only asks for validated addresses" is a claim
 * about the whole renderer — every component, now and later — rather than about
 * one function. This is a claim about one function.
 *
 * The rule itself is `isOpenable` from the contract, shared rather than
 * restated: two copies of a security check drift, and the copy that drifts is
 * the one nobody reads.
 */
export function openLink(url: unknown): void {
  /*
   * Refused, never repaired (FR-022). Nothing here promotes `www.example.com` to
   * `https:`, strips a leading space, or rewrites a `file:`. Repairing an
   * address means guessing what the sender meant, and the sender is a program
   * that any local process may be driving (decision 18).
   *
   * `isOpenable` also does the type check, so a non-string is refused without
   * ever being coerced — `String(x)` on a hostile object runs its own code.
   */
  if (!isOpenable(url)) return;

  /*
   * Nothing is logged and nothing is reported back to the renderer, which is
   * deliberate on both counts. A log of refused addresses would be a record of
   * agent-composed strings written somewhere durable, and this product holds
   * nothing durable. An error returned to the renderer would let a component
   * distinguish "refused" from "opened" and start explaining the difference to
   * the developer — but the address is already on screen, and the board has
   * nothing to add about why the operating system is not the right place for it.
   */
  void shell.openExternal(url);
}
