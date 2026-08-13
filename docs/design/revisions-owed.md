# Design revisions owed

The exports in `resources/` are canon for look and feel (decision 8). They draw
**four fixed destinations** and the views behind them. Features since have
introduced surfaces the exports do not cover, and each of those is a revision
owed to the next design round rather than a licence to improvise.

This file is the list. It exists so that "the design does not show this" is
recorded when it happens, rather than reconstructed later from the code.

---

## From feature 011 — the Spec-Kit tree

**A tree.** The exports have lists, sections and detail panes; they have no
nested, expandable structure anywhere. The implementation invents one: a chevron
control, a one-level indent for tasks under their story, and a row that is two
controls side by side because opening a story and reading it are different acts.
Nothing about that was drawn.

**A detail pane beside a tree.** The Stories and Tasks tabs put a list beside a
detail and the exports show both. This puts a *tree* beside a detail, in the same
proportions, and reuses the existing detail components unchanged. The reuse is
deliberate and should survive the revision; the proportions are a guess.

**A strip whose membership varies by session.** The largest of the three. Until
now every session offered the same four destinations, so the strip could be drawn
once. It now depends on whether the session has reported a story and on whether
the developer has opened either of the two views the tree displaces, which means
between three and five destinations for the same board on the same day.

The revision should say what the strip does as it changes — whether the
transition is shown at all, and if so how — because the code currently just draws
the new set. It should also settle the label: `Spec-Kit` is the product's own
word for the thing, and it is the only tab label naming a tool rather than a kind
of content.

**Counted progress.** `3 of 7 done`, and `3 of 7 done · 2 not recognised` where
the vocabulary could not read a status. Drawn as muted monospace so that it does
not read as a status — status carries a signal colour, this carries a number —
but no export shows the two beside each other, and that adjacency is the thing
worth checking with a designer's eye.

**What is not owed:** the story and task detail bodies, the task row, the status
treatments and the section headings. All are reused unchanged and remain as the
exports drew them.

---

## From feature 010 — the ticket tab

**Built 2026-08-13.** This section was written from the feature's research while
it was still planned, and said "a fifth destination". It is the **sixth**: 011
shipped first and the tree is the fifth.

**A sixth destination**, and the shortening of `User Stories` to `Stories` to
make six fit at the minimum supported width. The exports draw four and the
longer label. `Stories` was chosen because it is the only label with a word that
distinguishes it from nothing — every story on this board is a user story — so
it was cheaper than shrinking type or dropping a destination.

**An openable link.** The first control in the product that leads outside the
window. The exports have no affordance for one, and the difference between an
address shown as text and an address that can be opened is exactly the thing a
developer needs to see before they click. As built: an unopenable address is
muted monospace text, an openable one is the same text underlined in the action
colour with a pointer. **Both show the whole address** — that is what makes the
destination readable before activation rather than after — and the two are
distinguished only by treatment, which is the thing to check with a designer's
eye. There is nothing to tell a developer *why* one is not openable, which is
deliberate and may be wrong.

**A label/value list, twice, with two different treatments.** The five fields
the board models use uppercase labels like every other row on the board; the
fields it does not model keep their own capitalisation, because those are
somebody else's words and transforming their case is the board editing them.
Whether two label treatments in one view reads as deliberate or as an oversight
is a design question and is not settled here.

**A thread.** Comments are oldest-first with a rule down the left rather than a
card each, on the argument that fifty cards is a wall. No export shows a
discussion at all.

---

## The measurement that was owed — discharged 2026-08-13

Both features are held to the same bar: every destination legible and operable at
the minimum supported width, with no horizontal scrolling.

Feature 011 measured the widest strip *it* could produce — five destinations —
and recorded that **six had not been measured**, because the sixth was feature
010's ticket tab and it did not exist yet.

**Six has now been measured, and six fits.** `ticket.spec.ts` drives the window
to 380px with a session that is every kind at once: a ticket reported, a story
reported, and a developer who opened the old views before the tree arrived so
they are kept. All six labels have a real box, entirely inside the window, and
each still selects its view at that width.

So the contingency below was not needed. It stays recorded, because the
conditions that would trigger it have not gone away — a seventh destination, a
longer label, or a larger minimum type size would each reopen it.

> If six will not fit, the recorded answer is to bring forward the retirement of
> the Stories and Tasks views — which returns the strip to four — rather than to
> relax the floor or introduce a second navigation idiom.

One caveat on the measurement, from the harness rather than the design: the
requested content width is not always the applied one, because a fractional
display scale quantises to whole physical pixels. The test asserts what was
actually applied, and this machine was at 100%. A designer checking this on a
scaled display should expect the window to be a few pixels wider than asked for.
