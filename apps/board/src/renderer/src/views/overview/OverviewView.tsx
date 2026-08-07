import { useState } from 'react';

import type { SessionView } from '../../../../main/view.js';
import { FocusSection } from './FocusSection.js';
import { SpecSection } from './SpecSection.js';

import './OverviewView.css';

/**
 * The default view: the sections the agent reported.
 *
 * Everything here traces to a field in the last push. Nothing is counted that
 * the agent did not count, nothing is sorted that the agent did not order, and
 * no section appears because it would look tidier if it did (FR-016). This view
 * is where "the board could just work that out" is most tempting, and the
 * comparison test in `tests/e2e/only-reported.spec.ts` is what actually holds
 * the line.
 *
 * Feature 005 adds the prompt, history and in-context sections above these —
 * same tab, different source.
 */

export type SectionKey = 'focus' | 'spec' | 'plan' | 'changed';

/**
 * Component state, not persisted. It survives an arriving report because this
 * component does not remount (FR-015); it does not survive a restart, which is
 * true of everything else in the product.
 */
const ALL_OPEN: Record<SectionKey, boolean> = {
  focus: true,
  spec: true,
  plan: true,
  changed: true,
};

export function OverviewView({
  session,
  now,
}: {
  session: SessionView;
  now: number;
}): React.JSX.Element {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>(ALL_OPEN);

  const toggle = (key: SectionKey): void => {
    setOpen((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  return (
    <div className="overview" data-testid="overview">
      <FocusSection
        focus={session.focus}
        reportedAt={session.reportedAt}
        now={now}
        open={open.focus}
        onToggle={() => {
          toggle('focus');
        }}
      />

      <SpecSection
        feature={session.feature}
        tasks={session.tasks}
        focus={session.focus}
        reportedAt={session.reportedAt}
        now={now}
        open={open.spec}
        onToggle={() => {
          toggle('spec');
        }}
      />
    </div>
  );
}
