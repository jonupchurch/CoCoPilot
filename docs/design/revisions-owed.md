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

Recorded here from that feature's research so the list is in one place; the
feature is planned rather than built.

**A fifth destination**, and the shortening of `User Stories` to `Stories` to
make five fit at the minimum supported width. The exports draw four and the
longer label.

**An openable link.** The first control in the product that leads outside the
window. The exports have no affordance for one, and the difference between an
address shown as text and an address that can be opened is exactly the thing a
developer needs to see before they click.

---

## The measurement that is still owed

Both features are held to the same bar: every destination legible and operable at
the minimum supported width, with no horizontal scrolling.

Feature 011 measures the widest strip *it* can produce — five destinations, which
requires a Spec-Kit session whose developer also opened one of the displaced
views. **Six has not been measured**, because the sixth is feature 010's ticket
tab and it does not exist yet. That measurement is owed the moment 010 lands.

If six will not fit, the recorded answer is to bring forward the retirement of
the Stories and Tasks views — which returns the strip to four — rather than to
relax the floor or introduce a second navigation idiom. That is a product
decision with a design consequence, which is why it is written down here as well
as in feature 011's research.
