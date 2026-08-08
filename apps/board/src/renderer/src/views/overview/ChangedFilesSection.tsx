import type { ChangedFile } from 'cocoapilot-contract';

import { Section } from '../../components/Section.js';
import { changedFilesSummary, formatChangedFiles, MINUS } from '../../lib/summarise.js';

import './ChangedFilesSection.css';

/**
 * What the agent says it has touched.
 *
 * Explicitly the lowest-priority section (decision 12) and the one whose
 * information is most likely to be stale, because it changes only when an agent
 * reports. Editing the repository by hand changes nothing here, by design: the
 * board never reads the repository, so this is a record of what was said, not a
 * view of what is on disk.
 *
 * A file carrying a `note` is the flagged one. The field has a cap in the data
 * model and had no stated meaning until this feature gave it one — *why this
 * file wants your eye* — which is rendering a field the agent chose to fill
 * rather than inferring attention from the numbers.
 */
export function ChangedFilesSection({
  files,
  open,
  onToggle,
}: {
  files: readonly ChangedFile[];
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element | null {
  if (files.length === 0) return null;

  const summary = changedFilesSummary(files);

  return (
    <Section
      label="Changed files"
      summary={
        summary.added === null && summary.removed === null ? (
          formatChangedFiles(summary)
        ) : (
          <span className="changed__counts">
            {summary.added === null ? null : (
              <span className="changed__added">+{summary.added}</span>
            )}
            {summary.removed === null ? null : (
              <span className="changed__removed">
                {MINUS}
                {summary.removed}
              </span>
            )}
          </span>
        )
      }
      open={open}
      onToggle={onToggle}
      testId="changed"
    >
      {files.map((file, index) => {
        // Narrowed to a value rather than a boolean, so the `title` below can
        // see it is a string.
        const note = file.note !== null && file.note.trim() !== '' ? file.note : null;
        const flagged = note !== null;

        return (
          // Paths repeat legitimately -- an agent may report the same file twice
          // with different notes -- so the index joins the key rather than the
          // board silently collapsing the rows.
          <div
            className="changed__row"
            key={`${file.path} ${index}`}
            data-flagged={flagged}
            data-testid={`changed-${index}`}
          >
            {flagged ? (
              <span className="changed__flag" aria-hidden="true">
                !
              </span>
            ) : null}
            <span className="changed__kind" title={file.change}>
              {file.change}
            </span>
            <span className="changed__path" title={file.path}>
              {file.path}
            </span>
            {note !== null ? (
              <span className="changed__note" title={note} data-testid={`changed-note-${index}`}>
                {note}
              </span>
            ) : (
              <span className="changed__counts">
                {file.added === null ? null : <span className="changed__added">+{file.added}</span>}
                {file.removed === null ? null : (
                  <span className="changed__removed">
                    {MINUS}
                    {file.removed}
                  </span>
                )}
              </span>
            )}
          </div>
        );
      })}
    </Section>
  );
}
