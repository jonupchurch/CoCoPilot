import { useState } from 'react';

import type { Availability } from '../../../../main/transcript/availability.js';
import type { ContextFile, ContextView } from '../../../../main/transcript/context.js';
import { Section } from '../../components/Section.js';
import { UnavailableNote, UnavailableSummary } from '../../components/Unavailable.js';
import { formatTokens } from '../../lib/summarise.js';

import './ContextSection.css';

/**
 * What the agent is holding, so "does it even know about the file I care about?"
 * costs a glance instead of an interruption.
 *
 * Files come from tool calls that named one and from attachments that carried
 * one, most recently touched first, and the list is emptied at every compact
 * boundary because that is where the agent's context was genuinely thrown away.
 * The figure beside the count is the whole input window — see `context.ts` for
 * why `input_tokens` alone is the wrong field to read.
 *
 * **Two deviations from the design export, both because the transcript does not
 * carry what it draws.** The export shows a per-file token size (`3.1k`) — that
 * number exists nowhere in the format, and the only way to produce one would be
 * to estimate it, which is inventing content (FR-016). The slot shows what
 * touched the file instead, which the transcript does say. The export also
 * distinguishes teal from muted discs among the held files with no visible rule;
 * lacking a source for the distinction, held files are all muted and only the
 * one still running is marked.
 */

/**
 * How many files the list shows before it offers the rest.
 *
 * Eight rather than History's four: a path is one short line, and the question
 * this section answers is "is *my* file in there", which a longer list answers
 * more often. Measured against a real session, 28 files were open at the point
 * of reading — enough that showing all of them by default would bury every
 * section below.
 */
const VISIBLE = 8;

export function ContextSection({
  context,
  repo,
  open,
  onToggle,
}: {
  context: Availability<ContextView>;
  repo: string;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const [showAll, setShowAll] = useState(false);

  // Newest touch first. The projection keeps the reader's order; reversing is a
  // display choice and belongs here.
  const files = context.state === 'available' ? [...context.value.files].reverse() : [];
  const shown = showAll ? files : files.slice(0, VISIBLE);

  return (
    <Section
      label="In context"
      summary={summary(context)}
      open={open}
      onToggle={onToggle}
      testId="context"
    >
      {context.state === 'unreadable' ? (
        <UnavailableNote testId="context-unavailable" />
      ) : files.length === 0 ? (
        <p className="context__none" data-testid="context-none">
          {context.state === 'available' && context.value.tokens !== null
            ? 'No files opened since the agent last compacted.'
            : 'The transcript says nothing about what is in context.'}
        </p>
      ) : (
        <>
          {shown.map((file) => (
            <div
              className="context__row"
              key={file.path}
              data-active={file.active}
              data-testid={`context-${file.path}`}
            >
              <span className="context__disc" aria-hidden="true" />
              <span className="context__path" title={file.path}>
                {display(file.path, repo)}
              </span>
              <span
                className="context__action"
                title={file.active ? `${file.action} — still running` : file.action}
              >
                {file.action}
              </span>
            </div>
          ))}

          {showAll || files.length <= VISIBLE ? null : (
            <button
              type="button"
              className="context__more"
              onClick={() => {
                setShowAll(true);
              }}
              data-testid="context-show-all"
            >
              Show all {files.length}
            </button>
          )}
        </>
      )}
    </Section>
  );
}

/**
 * The path relative to the repository, when it is inside it.
 *
 * The transcript writes absolute paths; the export shows repository-relative
 * ones, and a panel this narrow cannot afford `d:\Codelib\CoCoPilot\` on every
 * row. Trimming a prefix the board already holds is formatting, not
 * reconciliation — nothing is checked, corrected or contradicted, and the full
 * path stays on `title`. A file outside the repository is shown whole, because
 * *that* is the interesting thing about it.
 */
function display(path: string, repo: string): string {
  const normal = (value: string): string => value.replaceAll('\\', '/').toLowerCase();
  const prefix = `${normal(repo).replace(/\/$/, '')}/`;

  return normal(path).startsWith(prefix) ? path.slice(prefix.length) : path;
}

function summary(context: Availability<ContextView>): string | React.JSX.Element {
  if (context.state === 'unreadable') {
    return <UnavailableSummary testId="context-summary-unavailable" />;
  }
  if (context.state === 'empty') return 'nothing yet';

  const { files, tokens } = context.value;
  const count = `${files.length} ${files.length === 1 ? 'file' : 'files'}`;

  // No count where none was read. A window whose size is unknown and one that
  // is empty are different claims, and only one of them is ours to make.
  return tokens === null ? count : `${count} · ${formatTokens(tokens)}`;
}

export type { ContextFile };
