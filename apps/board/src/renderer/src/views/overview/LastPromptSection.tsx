import type { Prompt } from '../../../../main/transcript/classify.js';
import type { Availability } from '../../../../main/transcript/availability.js';
import { Section } from '../../components/Section.js';
import { elapsed } from '../../lib/elapsed.js';

import './LastPromptSection.css';

/**
 * The instruction the agent is working from.
 *
 * This reframes everything else on the board: "editing the auth middleware"
 * means one thing after "fix the login bug" and something quite different after
 * "delete the auth system".
 *
 * The latest prompt is the last of the list, not a `last-prompt` record. Those
 * exist and look like a shortcut — 217 of them against 57 real prompts in the
 * measured sample, so they are not one-per-prompt and using them would overstate
 * the history nearly fourfold. One code path, one set of assumptions.
 *
 * Three states, never two. A section that cannot read its source says so, and
 * says something different from a session that genuinely has no prompts yet
 * (SC-006). Collapsing those would present a failure as a confident answer.
 */
export function LastPromptSection({
  prompts,
  now,
  open,
  onToggle,
}: {
  prompts: Availability<readonly Prompt[]>;
  now: number;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const latest = prompts.state === 'available' ? (prompts.value.at(-1) ?? null) : null;

  return (
    <Section
      label="Last prompt"
      summary={summary(prompts, latest, now)}
      open={open}
      onToggle={onToggle}
      testId="last-prompt"
    >
      {prompts.state === 'unreadable' ? (
        <p className="prompt__unavailable" data-testid="last-prompt-unavailable">
          Unavailable — no transcript could be read for this session.
        </p>
      ) : latest === null ? (
        <p className="prompt__none" data-testid="last-prompt-none">
          No prompt has been recorded for this session yet.
        </p>
      ) : (
        <div className="prompt__card">
          {/*
            Rendered as a text node, like everything else on the board. This is
            the developer's own words rather than a model's, but it lands in the
            same window and gets the same treatment (FR-014).
          */}
          <p className="prompt__text" data-testid="last-prompt-text">
            {latest.text}
          </p>
        </div>
      )}
    </Section>
  );
}

function summary(
  prompts: Availability<readonly Prompt[]>,
  latest: Prompt | null,
  now: number,
): string {
  if (prompts.state === 'unreadable') return 'unavailable';
  if (latest === null) return 'none yet';
  return latest.at === null ? 'recorded' : elapsed(latest.at, now);
}
