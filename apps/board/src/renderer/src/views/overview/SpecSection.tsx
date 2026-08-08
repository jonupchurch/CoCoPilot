import type { Focus, ReportedFeature, Task } from 'cocoapilot-contract';

import { Section } from '../../components/Section.js';
import { TaskRow } from '../../components/TaskRow.js';
import { focusAge } from '../../lib/elapsed.js';
import { specSummary } from '../../lib/summarise.js';

import './SpecSection.css';

/**
 * The feature being worked and its tasks, in the agent's order.
 *
 * Not sorted, not grouped, not filtered. The order is the agent's — it read the
 * repository and we did not, so reordering would assert a structure the board
 * has no way to know is right.
 *
 * The section is absent when nothing was reported for it, rather than drawn as
 * an empty frame (FR-017).
 */
export function SpecSection({
  feature,
  tasks,
  focus,
  reportedAt,
  now,
  open,
  onToggle,
}: {
  feature: ReportedFeature | null;
  tasks: readonly Task[];
  focus: Focus | null;
  reportedAt: number | null;
  now: number;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element | null {
  if (feature === null && tasks.length === 0) return null;

  const focused = focus?.task?.trim() ?? '';
  const tag = reportedAt === null ? null : focusAge(reportedAt, now);

  return (
    <Section
      label="Spec"
      summary={specSummary(feature, tasks)}
      open={open}
      onToggle={onToggle}
      testId="spec"
    >
      {feature === null ? null : (
        <div className="spec__card" data-testid="feature-card">
          <span className="spec__id" data-testid="feature-id">
            {feature.id}
          </span>
          <span className="spec__title" data-testid="feature-title">
            {feature.title}
          </span>
          {feature.specPath === null ? null : (
            <span className="spec__path" title={feature.specPath} data-testid="feature-path">
              {feature.specPath}
            </span>
          )}
        </div>
      )}

      {tasks.length === 0 ? null : (
        <div className="spec__tasks">
          {tasks.map((task, index) => (
            // Keyed by identifier, with the index as the tiebreak an agent can
            // force by reporting the same id twice. React needs the key unique;
            // the board does not get to drop a row for being a duplicate.
            <TaskRow
              key={`${task.id}#${index}`}
              task={task}
              focused={focused !== '' && task.id.trim() === focused}
              elapsedTag={tag}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
