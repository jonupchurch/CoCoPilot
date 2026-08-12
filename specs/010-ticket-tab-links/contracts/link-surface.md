# Contract: opening a link

**Feature**: 010 | **Date**: 2026-08-12

The first action this product takes outside its own window. This document is the
whole of that surface, deliberately small.

---

## What exists today, and must go on existing

- **Not one anchor tag or `href` in the renderer.** Every value is a text node.
- `setWindowOpenHandler` **denies every** window-open request.
- `will-navigate` is blocked.
- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`.
- `read-only.spec.ts` asserts the preload bridge is **exactly two reads and two
  local writes**, fails on any unknown bridge member, and records any outbound
  `http`/`https`/`ws` request as a violation.

None of that is relaxed. The window still navigates nowhere and still opens no
window of its own; the guarantee becomes **three** local writes instead of two,
and the tests are extended to say so rather than deleted. A test that was
counting is the right kind of test to have to update deliberately.

## The bridge gains one member

```
openLink(url: string): void
```

- **Fire-and-forget**, like `select` and `dismiss`. Returns nothing: there is
  nothing to report back, and a result would be a fourth thing to keep in step.
- Carries a URL string and nothing else. Not a ticket, not a session key — the
  renderer asks for one specific thing to be opened.
- The renderer may call it for **any** string. It is not trusted to have
  validated one.

## The rule, enforced in the main process

On receiving a URL, before anything else:

1. It must be a string. Anything else is dropped silently, as the existing two
   channels already do with a non-string key.
2. Parse it with the platform URL parser. Unparseable is dropped.
3. The parsed protocol must be **exactly** `http:` or `https:`. Anything else is
   dropped.
4. Only then is it handed to the operating system.

**Dropped, not repaired.** No protocol is added, no address is rewritten. See
[research.md §2](../research.md) for why parsing rather than string-matching is
load-bearing, and why this is checked here as well as at ingest.

**Nothing is logged, and no failure is reported to the renderer.** A refused
address is a refused address; there is no error channel back to a window whose
job is drawing text.

## What the renderer does with it

A reported address is **always shown as text**, whether or not it can be opened
(FR-021). Openable addresses additionally get a control that calls `openLink`.

The developer must be able to see where a link goes before activating it
(FR-025) — the address itself is on screen, so this is satisfied by showing it
rather than by a hover affordance that has to be discovered.

The renderer decides openability with the **same rule**, so a control never
appears for an address the main process would drop. Two implementations of one
rule would drift, so the check is one shared function used on both sides of the
bridge.

## What is explicitly not in this surface

| Not this | Why |
|---|---|
| Opening a file path | `file:` is not an ordinary web address, and changed-file paths stay text |
| A preview, a title, a favicon, resolving a redirect | Each is the board making a request of its own, which FR-024 forbids |
| Copy-to-clipboard | Worth having, not asked for, and separate |
| Opening anything from a section other than the ticket and its parent | FR-019 and FR-020 name both; everything else stays text |
| Reporting back whether the browser opened | The OS owns that, and the board would be guessing |

## Verification this surface owes

- Every non-`http(s)` address kind attempted and observed **not** to open —
  `file:`, a script address, and a registered application handler at minimum
  (SC-004).
- Zero outbound requests from the application on activation, and nothing to any
  agent (SC-005, FR-024).
- The window itself navigates nowhere and opens no additional window (FR-023).
- `read-only.spec.ts` still passes with its count raised to three, and still fails
  if a fourth member appears.
