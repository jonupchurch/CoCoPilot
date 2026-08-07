import { useEffect, useState } from 'react';

import type { Availability } from '../../../../main/transcript/availability.js';
import type { Prompt } from '../../../../main/transcript/classify.js';
import { Section } from '../../components/Section.js';
import { UnavailableNote, UnavailableSummary } from '../../components/Unavailable.js';
import { elapsed } from '../../lib/elapsed.js';
import { MINUS } from '../../lib/summarise.js';

import './HistorySection.css';

/**
 * The instructions before this one, newest first.
 *
 * How a long session is actually resumed: not by reading what the agent is
 * doing, but by finding the sentence that put it there. Everything here is the
 * developer's own words, read back off disk — which is why it survives a
 * restart when nothing else on the board does (SC-008), and why a copy has to
 * come back character for character (SC-002).
 *
 * **Earlier prompts, not all of them.** The newest is the card directly above
 * this section, and repeating it would spend the most valuable row in the list
 * on something already on screen.
 */

/**
 * How many rows the list shows before it offers the rest.
 *
 * Four, which is what the design export draws, and it is a real choice rather
 * than a placeholder: the Overview is a stack of six sections in a panel around
 * 450px wide, and a history that lists everything pushes Spec, Plan and Changed
 * files off the bottom of any session long enough to want history for. The
 * measured sample had 57 prompts.
 *
 * The export's "Show all 18" was carried into design round 2 as an open item,
 * because it had no destination — there is no history *view* to send anyone to,
 * and inventing one would be a second place to read the same thing. It expands
 * this list in place instead. The section is collapsible, so a long list closes
 * the same way everything else on this tab does.
 */
const VISIBLE = 4;

/** Long enough to notice, short enough not to look like a state. */
const CONFIRM_MS = 1_200;

interface Row {
  prompt: Prompt;
  /**
   * Stable across arrivals: the position from the *start* of the list, which
   * does not move when a prompt is appended, unlike the position from the end.
   */
  key: string;
}

export function HistorySection({
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
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (copied === null) return undefined;
    const timer = setTimeout(() => {
      setCopied(null);
    }, CONFIRM_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [copied]);

  const rows = earlier(prompts);
  const shown = showAll ? rows : rows.slice(0, VISIBLE);

  const toggleRow = (key: string): void => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  };

  /**
   * The stored text, written out as it was stored. No trim, no normalising, no
   * re-wrapping (SC-002) — a prompt is reused by pasting it back, and a copy
   * that had been tidied would silently stop being the instruction that produced
   * the state the developer is looking at.
   *
   * One thing is out of our hands: **Windows expands every newline to CRLF.**
   * The clipboard's text format there is CF_UNICODETEXT, whose convention is
   * CRLF, and Chromium converts on the way out — no API puts a bare LF on it.
   * That is the platform's line ending rather than an edit, it pastes correctly
   * everywhere, and the end-to-end test asserts exactly that: strip `\r` and the
   * result is the original character for character.
   */
  const copy = (key: string, text: string): void => {
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopied(key);
      },
      () => {
        // Nothing reached the clipboard, so nothing is confirmed. A tick here
        // would be a lie about the one thing this control promises.
      },
    );
  };

  return (
    <Section
      label="History"
      summary={summary(prompts, rows.length)}
      open={open}
      onToggle={onToggle}
      testId="history"
    >
      {prompts.state === 'unreadable' ? (
        <UnavailableNote testId="history-unavailable" />
      ) : rows.length === 0 ? (
        <p className="history__none" data-testid="history-none">
          Nothing earlier in this session.
        </p>
      ) : (
        <>
          {shown.map(({ prompt, key }) => {
            const isOpen = expanded.has(key);

            return (
              <div className="history__entry" key={key} data-testid={`history-${key}`}>
                <div className="history__row">
                  {/*
                    A button, so the row is reachable from the keyboard without
                    this file knowing anything about keys. `title` carries the
                    whole prompt, so the full text is retrievable without
                    expanding (FR-009).
                  */}
                  <button
                    type="button"
                    className="history__text"
                    title={prompt.text}
                    aria-expanded={isOpen}
                    onClick={() => {
                      toggleRow(key);
                    }}
                    data-testid={`history-text-${key}`}
                  >
                    {prompt.text}
                  </button>

                  <span className="history__age" data-testid={`history-age-${key}`}>
                    {prompt.at === null ? MINUS : elapsed(prompt.at, now)}
                  </span>

                  <button
                    type="button"
                    className="history__action"
                    title="Copy prompt"
                    onClick={() => {
                      copy(key, prompt.text);
                    }}
                    data-testid={`history-copy-${key}`}
                  >
                    {copied === key ? (
                      <span className="history__copied" data-testid={`history-copied-${key}`}>
                        ✓
                      </span>
                    ) : (
                      <CopyGlyph />
                    )}
                  </button>

                  <button
                    type="button"
                    className="history__action history__caret"
                    title={isOpen ? 'Collapse' : 'Expand'}
                    aria-expanded={isOpen}
                    onClick={() => {
                      toggleRow(key);
                    }}
                    data-testid={`history-toggle-${key}`}
                  >
                    {isOpen ? '▼' : '▶'}
                  </button>
                </div>

                {isOpen ? (
                  <div className="history__full" data-testid={`history-full-${key}`}>
                    {prompt.text}
                  </div>
                ) : null}
              </div>
            );
          })}

          {showAll || rows.length <= VISIBLE ? null : (
            <button
              type="button"
              className="history__more"
              onClick={() => {
                setShowAll(true);
              }}
              data-testid="history-show-all"
            >
              Show all {rows.length}
            </button>
          )}
        </>
      )}
    </Section>
  );
}

/**
 * Every prompt but the latest, newest first.
 *
 * The index is taken before the reversal so it counts from the oldest entry,
 * which makes it a stable React key: appending a prompt shifts every
 * position-from-the-end by one and would remount every row, losing whichever
 * ones the developer had expanded.
 */
function earlier(prompts: Availability<readonly Prompt[]>): Row[] {
  if (prompts.state !== 'available') return [];

  return prompts.value
    .slice(0, -1)
    .map((prompt, index) => ({ prompt, key: prompt.id ?? `p${index}` }))
    .reverse();
}

function summary(
  prompts: Availability<readonly Prompt[]>,
  count: number,
): string | React.JSX.Element {
  if (prompts.state === 'unreadable') {
    return <UnavailableSummary testId="history-summary-unavailable" />;
  }
  return count === 0 ? 'none' : String(count);
}

/** Transcribed from the export, which draws a copy affordance rather than a word. */
function CopyGlyph(): React.JSX.Element {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
