import { useState } from 'react';

import type { SessionView } from '../../../../main/view.js';
import { ChangedFilesSection } from './ChangedFilesSection.js';
import { FocusSection } from './FocusSection.js';
import { LastPromptSection } from './LastPromptSection.js';
import { PlanSection } from './PlanSection.js';
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

export type SectionKey = 'lastPrompt' | 'focus' | 'spec' | 'plan' | 'changed';

/**
 * Component state, not persisted. It survives an arriving report because this
 * component does not remount (FR-015); it does not survive a restart, which is
 * true of everything else in the product.
 */
const ALL_OPEN: Record<SectionKey, boolean> = {
  lastPrompt: true,
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
      {/*
        Above the reported sections, as the export has it: what was *asked*
        frames everything the agent then said it was doing. Read from the
        transcript rather than pushed, and unable to affect anything below it.
      */}
      <LastPromptSection
        prompts={session.transcript.prompts}
        now={now}
        open={open.lastPrompt}
        onToggle={() => {
          toggle('lastPrompt');
        }}
      />

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

      <PlanSection
        plan={session.plan}
        open={open.plan}
        onToggle={() => {
          toggle('plan');
        }}
      />

      <ChangedFilesSection
        files={session.changedFiles}
        open={open.changed}
        onToggle={() => {
          toggle('changed');
        }}
      />
    </div>
  );
}
