# Vite + React

Defaults for the renderer. The repo wins where it already differs.

## Defaults

- **Function components, hooks, TypeScript strict.** No class components.
- **Server state is not component state.** Board state arrives from main; hold
  it in one place and subscribe. Do not scatter `useState` copies of it.
- **Derive, don't duplicate.** Elapsed time, completion counts and status
  colours are computed at render from held state, never stored alongside it.
- **Keys are stable identifiers**, not array indices — lists here reorder when a
  report replaces them.
- **Co-locate**: `Component.tsx` beside `Component.test.tsx`.
- **CSS variables for the design tokens**, one definition, referenced by name.
  A hex literal in a component is a bug.
- **`useEffect` is for subscriptions and cleanup.** If it is computing
  something, it should have been derived during render.

## Where things go

```
renderer/src/
├── app/          # shell, routing between tabs
├── views/        # one per tab
├── components/   # shared, presentational
├── state/        # the single subscription to main, and selectors
├── tokens.css    # design system variables
└── lib/          # pure helpers — formatting, vocabulary mapping
```

## Don't

- Don't render agent text as HTML. It is untrusted by construction — text
  nodes only, no `dangerouslySetInnerHTML`, ever.
- Don't set timers to refresh data. Updates are pushed; a timer here
  contradicts the whole design. (Elapsed-time *display* ticks are the one
  exception, and they render existing state rather than fetching.)
- Don't reach for a state library before one is needed. A subscription plus
  context is enough for a single-window board.
- Don't animate on data arrival — the panel sits beside an editor in someone's
  peripheral vision.
- Don't add a router for tabs; they are view state, not URLs.

## Verify

- [ ] `npm run typecheck` clean, strict mode on
- [ ] No `dangerouslySetInnerHTML` anywhere
- [ ] No `setInterval`/`setTimeout` fetching or refetching data
- [ ] No colour literals outside `tokens.css`
- [ ] Layout holds at the minimum window size with no horizontal scroll
- [ ] Renders correctly with empty, missing, and maximum-length content
