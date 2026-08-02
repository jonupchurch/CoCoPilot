# Cheat Sheet — Dropped Into an Unfamiliar Codebase, Live

One page. Skim it once before you start, glance back at it if you feel
scope creeping or an assumption sneaking in unexamined.

## The loop

1. **Orient fast** — spin off `codebase-scout` in the background to map
   the repo while you start talking to the client. Don't burn live
   conversation time on manual exploration you can delegate.
2. **Clarify before building** — ask, don't assume. Ambiguous requirement?
   Ask the client. Can't ask right now? Say your assumption out loud.
3. **Mini-spec, out loud or in 3 bullets**: what's being asked / how
   you'll know it's done / what's explicitly NOT in scope.
4. **Plan before typing**: approach + files touched + the one real
   tradeoff, said out loud.
5. **Build to match what's already there** — find the nearest existing
   pattern first, follow its shape.
6. **Verify before calling it done** — run it, don't just believe it.
7. **Narrate as you go** — the talk-through IS the record; there's no
   commit history to reconstruct intent from later.

## Red flags to catch yourself on

- Writing code before you can state the acceptance criteria in one
  sentence → stop, go clarify.
- An idea that's "while I'm in here, I could also..." → name it out
  loud as future work, don't fold it in.
- "I think this works" when you haven't actually run it → run it.
- A new pattern/style that doesn't match anything already in the repo
  → look for the existing analog again before you write more.
- Going quiet for a long stretch → narrate what you're doing, even
  briefly, so the client isn't left wondering.

## Delegating to codebase-scout

Ask the main assistant to spin it off in the background for anything
you don't need to watch happen live: "how does auth work here," "where
would a new X go," "what's the existing pattern for Y." It reports back
a short, skimmable summary (relevant files, existing pattern to follow,
open questions worth asking the client) — it never edits anything, so
you stay in full control of what actually changes.

## If you're really out of time

Cut ceremony, never cut clarification or verification. A narrow,
correctly-scoped, actually-working answer beats a broad one you can't
verify or explain.
