import type { ZodError } from 'zod';

/**
 * Why a request was refused.
 *
 * `invalid_field` covers everything the schema catches plus the repository-path
 * check. The two `_limit` codes are separate because they are not the caller's
 * mistake — the request was well-formed and the board simply has no room — and
 * they map to 409 rather than 400.
 */
export type RejectionCode =
  | 'not_found'
  | 'method_not_allowed'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'invalid_json'
  | 'invalid_field'
  | 'session_limit'
  | 'note_limit';

export interface Rejection {
  ok: false;
  error: RejectionCode;
  /**
   * The offending field, always populated (FR-009). A caller must be able to
   * correct the request from the response alone, without reading our source
   * (SC-007).
   */
  field: string;
  message: string;
}

/** Used when the problem is the request as a whole rather than one field. */
const WHOLE_BODY = '(body)';

/**
 * Renders a zod issue path the way a developer would write it: `tasks[3].title`.
 */
export function fieldPath(path: readonly PropertyKey[]): string {
  let rendered = '';
  for (const segment of path) {
    if (typeof segment === 'number') {
      rendered += `[${segment}]`;
    } else {
      const name = String(segment);
      rendered += rendered === '' ? name : `.${name}`;
    }
  }
  return rendered === '' ? WHOLE_BODY : rendered;
}

export function rejection(error: RejectionCode, field: string, message: string): Rejection {
  return { ok: false, error, field, message };
}

/**
 * The first issue wins. Zod reports issues in field order, so this is stable
 * across runs, and reporting one clearly beats reporting twenty vaguely.
 */
export function rejectionFromZodError(error: ZodError): Rejection {
  const issue = error.issues[0];
  if (issue === undefined) {
    return rejection('invalid_field', WHOLE_BODY, 'the request could not be validated');
  }
  return rejection('invalid_field', fieldPath(issue.path), issue.message);
}
