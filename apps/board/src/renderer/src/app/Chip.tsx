import type { Chip as ChipValue } from '@cocopilot/contract';

import './Chip.css';

/**
 * The attention chip.
 *
 * Renders exactly what the agent reported and derives nothing. The board never
 * moves a chip on its own — no timer, no threshold, no inference (decision 15).
 * `needs-you` in particular is the sole channel by which an agent asks for a
 * human, which is why it is the one value carrying the ember treatment.
 */

const LABELS: Record<ChipValue, string> = {
  idle: 'Idle',
  watching: 'Watching',
  thinking: 'Thinking',
  'needs-you': 'Needs you',
};

export function Chip({ value }: { value: ChipValue }): React.JSX.Element {
  return (
    <span className={`chip chip--${value}`} data-chip={value}>
      <span className="chip__dot" aria-hidden="true" />
      {LABELS[value]}
    </span>
  );
}
