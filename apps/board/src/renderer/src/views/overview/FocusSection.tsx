import type { Focus } from 'cocoapilot-contract';

import { Section } from '../../components/Section.js';
import { focusAge } from '../../lib/elapsed.js';
import { focusSummary } from '../../lib/summarise.js';

import './FocusSection.css';

/**
 * What the agent said it is doing, in its own words.
 *
 * The design export has no section for this: it marks focus *on* a task row —
 * the teal left rule and the elapsed tag — and stops there. That cannot hold the
 * agent's prose (FR-004), and it has nowhere to put a `focus.task` naming
 * something absent from the task list, which the spec calls out as an edge case
 * that must still be shown. So focus is both: this section, built in the idiom
 * of the export's own "Last prompt" block, and the row marker, unchanged,
 * wherever the named task appears.
 *
 * The elapsed tag is a **measurement**. It never changes colour or weight at any
 * duration and is never removed because time has passed (FR-003) — the design
 * round proposed muting it after ten minutes and that was rejected for the same
 * reason every other threshold was: a healthy agent goes quiet during a
 * typecheck.
 */
export function FocusSection({
  focus,
  reportedAt,
  now,
  open,
  onToggle,
}: {
  focus: Focus | null;
  reportedAt: number | null;
  now: number;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const task = focus?.task?.trim() === '' ? null : (focus?.task ?? null);
  const note = focus?.note?.trim() === '' ? null : (focus?.note ?? null);

  return (
    <Section
      label="Focus"
      summary={focusSummary(focus, reportedAt, now)}
      open={open}
      onToggle={onToggle}
      testId="focus"
    >
      {task === null && note === null ? (
        <p className="focus__absent" data-testid="focus-absent">
          No current task reported.
        </p>
      ) : (
        <div className="focus__card">
          {task === null ? null : (
            <div className="focus__head">
              <span className="focus__task" title={task} data-testid="focus-task">
                {task}
              </span>
              {reportedAt === null ? null : (
                <span className="focus__elapsed" data-testid="focus-elapsed">
                  {focusAge(reportedAt, now)}
                </span>
              )}
            </div>
          )}
          {note === null ? null : (
            <p className="focus__note" data-testid="focus-note">
              {note}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
