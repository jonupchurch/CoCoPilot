import type { Chip as ChipValue } from '@cocoapilot/contract';

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

export function Chip({
  value,
  labelled = true,
}: {
  value: ChipValue;
  /**
   * False on a crowded session pill, where the dot alone carries the state.
   *
   * The label is still in the accessible name, because dropping a word to save
   * width is a *visual* trade and a screen reader has no width problem. What is
   * never dropped is the colour and the dot, which is what makes an unselected
   * `needs-you` visible at a glance across a row of pills.
   */
  labelled?: boolean;
}): React.JSX.Element {
  return (
    <span className={`chip chip--${value}`} data-chip={value} data-labelled={labelled}>
      <span className="chip__dot" aria-hidden="true" />
      {labelled ? LABELS[value] : <span className="visually-hidden">{LABELS[value]}</span>}
    </span>
  );
}
