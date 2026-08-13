import type { ExtraField } from 'cocoapilot-contract';

import './FieldList.css';

/**
 * The fields the board does not model — FR-012, and the reason this feature
 * outlives its first tracker.
 *
 * Azure DevOps has an Area Path and an Iteration Path; Jira has a dozen custom
 * fields per project; something in-house has whatever somebody added last
 * quarter. None of those can be designed for in advance, and the alternative to
 * this component is that a second tracker needs a release of the board rather
 * than an agent-side adapter.
 *
 * **In the order reported**, and that is not laziness. The agent knows which of
 * these matter and position is the only signal it has for saying so — sorting
 * them alphabetically would throw away the only judgement anyone made about
 * them. Nothing here is grouped, renamed, or interpreted; a label is printed as
 * a label and a value as text.
 */
export function FieldList({ fields }: { fields: readonly ExtraField[] }): React.JSX.Element {
  return (
    <dl className="fieldlist" data-testid="ticket-fields">
      {fields.map((field, index) => (
        // Position is identity, as it is for comments: these arrive as a list
        // and are replaced as a list, and two labels can legitimately repeat.
        <div className="fieldlist__row" key={`${index}:${field.label}`}>
          <dt className="fieldlist__label" data-testid={`ticket-field-label-${index}`}>
            {field.label}
          </dt>
          <dd className="fieldlist__value" data-testid={`ticket-field-value-${index}`}>
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
