import { describe, expect, it } from 'vitest';

import { resolvePresence } from './usePresence.js';

/**
 * The sequences in `contracts/presence.md`, and then the property they exist to
 * establish.
 *
 * The per-case tests say what is offered when. The last block says something
 * stronger and less obvious, and the precise wording matters: it is **not** that
 * nothing offered is ever taken back — the old views are withdrawn, and that is
 * the feature. It is that nothing is ever taken back *from a developer who
 * opened it*, and that every withdrawal happens to someone who never did.
 *
 * That is FR-007, and it is the requirement decision 36 was raised about, so it
 * is asserted over a sequence rather than at a moment: a test that looks at one
 * state cannot see it.
 */

describe('resolvePresence — what a session offers', () => {
  it('offers the old views and no tree to a session that has never reported a story', () => {
    expect(resolvePresence(false, false)).toEqual({ tree: false, oldViews: true });
  });

  it('offers the tree and withdraws the old views once stories arrive', () => {
    expect(resolvePresence(true, false)).toEqual({ tree: true, oldViews: false });
  });

  it('keeps the old views for a developer who had already opened one', () => {
    expect(resolvePresence(true, true)).toEqual({ tree: true, oldViews: true });
  });

  it('offers the old views to a non-Spec-Kit session whether or not they were used', () => {
    // Nothing to withdraw them in favour of, so "used" is not consulted.
    expect(resolvePresence(false, true).oldViews).toBe(true);
    expect(resolvePresence(false, false).oldViews).toBe(true);
  });

  it('never leaves a session with no work destination at all', () => {
    for (const stories of [false, true]) {
      for (const used of [false, true]) {
        const { tree, oldViews } = resolvePresence(stories, used);
        expect(tree || oldViews).toBe(true);
      }
    }
  });
});

describe('resolvePresence — nothing is taken back from a developer who opened it', () => {
  /**
   * Both inputs are monotonic in the real system: `everReportedStories` is set
   * and never cleared, and a session id is only ever added to the used set. So a
   * legal sequence is any run of those two values in which neither goes back to
   * false.
   */
  const SEQUENCES: Array<{ name: string; steps: Array<[boolean, boolean]> }> = [
    {
      name: 'a session that reports stories, with the old views never opened',
      steps: [
        [false, false],
        [false, false],
        [true, false],
        [true, false],
      ],
    },
    {
      name: 'a developer who opens the task view before stories arrive',
      steps: [
        [false, false],
        [false, true],
        [true, true],
        [true, true],
      ],
    },
    {
      name: 'a developer who opens the task view after stories arrive',
      // Reachable when the tree and the old views are briefly offered together
      // only if something already kept them; here it stands for the general
      // monotonic case rather than a specific screen.
      steps: [
        [true, false],
        [true, true],
        [true, true],
      ],
    },
    {
      name: 'a session that stays ordinary forever',
      steps: [
        [false, false],
        [false, false],
        [false, true],
      ],
    },
    {
      name: 'a Spec-Kit session from its very first report',
      steps: [
        [true, false],
        [true, false],
      ],
    },
  ];

  for (const { name, steps } of SEQUENCES) {
    it(`holds across ${name}`, () => {
      let treeEverOffered = false;
      let everUsedOldViews = false;
      let sawAWithdrawal = false;

      for (const [stories, used] of steps) {
        const now = resolvePresence(stories, used);

        // The tree is offered on a one-way fact, so it is simply monotonic.
        if (treeEverOffered) expect(now.tree).toBe(true);

        // The old views may be withdrawn — that is the feature. What may never
        // happen is withdrawing them from someone who has opened them.
        if (everUsedOldViews) expect(now.oldViews).toBe(true);

        // And when they are withdrawn, nobody was reading them.
        if (!now.oldViews) {
          sawAWithdrawal = true;
          expect(used).toBe(false);
          expect(everUsedOldViews).toBe(false);
        }

        treeEverOffered ||= now.tree;
        everUsedOldViews ||= used;
      }

      // Teeth: a sequence that never offers anything, or never exercises either
      // branch, would satisfy the loop above vacuously.
      expect(treeEverOffered || everUsedOldViews || sawAWithdrawal).toBe(true);
    });
  }

  it('is exhaustive over every legal transition, not just the sequences above', () => {
    // Four states, and every transition in which neither input moves from true
    // back to false — which is every transition the real system can make.
    const states: Array<[boolean, boolean]> = [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ];
    let withdrawals = 0;

    for (const [fromStories, fromUsed] of states) {
      for (const [toStories, toUsed] of states) {
        if (toStories < fromStories || toUsed < fromUsed) continue;

        const before = resolvePresence(fromStories, fromUsed);
        const after = resolvePresence(toStories, toUsed);

        // The tree, once offered, stays offered.
        if (before.tree) expect(after.tree).toBe(true);

        // The old views survive for anyone who had opened them...
        if (fromUsed) expect(after.oldViews).toBe(true);

        // ...and any withdrawal happened to a developer who never had.
        if (before.oldViews && !after.oldViews) {
          withdrawals += 1;
          expect(fromUsed).toBe(false);
          expect(toUsed).toBe(false);
        }
      }
    }

    // Teeth: if no transition ever withdrew the old views, the assertion inside
    // that branch never ran and this test proved nothing about withdrawal.
    expect(withdrawals).toBeGreaterThan(0);
  });
});
