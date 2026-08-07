import type { PlanStep } from '@cocopilot/contract';

import { StatusDisc, StatusLabel } from '../../components/StatusLabel.js';
import { Section } from '../../components/Section.js';
import { planSummary } from '../../lib/summarise.js';
import { isDone } from '../../lib/vocabulary.js';

import './PlanSection.css';

/**
 * The sequence the agent said it would work through, in the order it sent.
 *
 * A plan answers "how much longer" better than a task list does, because it is
 * ordered. The rail restates the same done count the header summary states —
 * both are derived from held state at render, and neither is a number the agent
 * supplied that could disagree with the steps printed beneath it.
 *
 * Absent when no plan was reported, rather than an empty frame or, worse, a
 * fabricated one.
 */
export function PlanSection({
  plan,
  open,
  onToggle,
}: {
  plan: readonly PlanStep[];
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element | null {
  if (plan.length === 0) return null;

  const summary = planSummary(plan);
  const done = plan.filter((step) => isDone(step.status)).length;

  return (
    <Section
      label="Plan"
      summary={
        summary.active ? (
          <span className="plan__pill">
            <span className="plan__pip" aria-hidden="true" />
            {summary.text}
          </span>
        ) : (
          summary.text
        )
      }
      open={open}
      onToggle={onToggle}
      testId="plan"
    >
      <div
        className="plan__rail"
        role="presentation"
        data-testid="plan-rail"
        // A width, computed from the same count the summary states. Not a colour
        // and not content -- it restates what was reported and asserts nothing.
        style={{ '--plan-progress': `${(done / plan.length) * 100}%` } as React.CSSProperties}
      >
        <span className="plan__fill" />
      </div>

      {plan.map((step, index) => (
        // Steps have no identifier in the contract, so the index is the only key
        // available. Reordering re-renders the row it lands on, which is correct
        // here: a plan is a sequence, and position is what a step *is*.
        <div className="plan__step" key={index} data-testid={`plan-step-${index}`}>
          <StatusDisc status={step.status} size={16} />
          <div className="plan__text">
            <span className="plan__label">{step.text}</span>
            {step.detail === null || step.detail.trim() === '' ? null : (
              <span className="plan__detail">{step.detail}</span>
            )}
          </div>
          <StatusLabel status={step.status} />
        </div>
      ))}
    </Section>
  );
}
