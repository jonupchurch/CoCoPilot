import { describe, expect, it } from 'vitest';

import {
  MAX_COMMENTS,
  MAX_CRITERIA,
  MAX_EXTRA_FIELDS,
  MAX_LABEL,
  MAX_RICH_TEXT,
  MAX_TEXT,
  MAX_TICKET_LABELS,
  MAX_URL,
} from '../src/caps.js';
import { fieldPath } from '../src/errors.js';
import { NoteRequest, PushRequest, TicketRequest } from '../src/schema.js';

describe('PushRequest', () => {
  it('accepts a complete report', () => {
    const parsed = PushRequest.parse({
      repo: 'D:\\Codelib\\example',
      branch: 'feat/session-hook',
      sessionId: 'a1b2c3',
      feature: { id: '002', title: 'Share one session fetch', specPath: 'specs/002/spec.md' },
      stories: [{ id: 'US-002', title: 'A story', criteria: ['it works'], taskIds: ['T012'] }],
      tasks: [
        {
          id: 'T012',
          storyId: 'US-002',
          title: 'Wire the fetch',
          status: 'waiting on CI',
          checks: [],
          files: [],
        },
      ],
      plan: [{ text: 'Read the call sites', status: 'done' }],
      focus: { task: 'T012', note: 'blocked — the harness never sets the cookie', chip: 'needs-you' },
      changedFiles: [{ path: 'src/api/client.ts', change: 'modified', added: 21, removed: 18 }],
    });

    expect(parsed.feature?.title).toBe('Share one session fetch');
    expect(parsed.tasks[0]?.status).toBe('waiting on CI');
    expect(parsed.focus?.chip).toBe('needs-you');
    expect(parsed.changedFiles[0]?.added).toBe(21);
  });

  it('accepts an envelope alone — every field below it is optional', () => {
    const parsed = PushRequest.parse({ repo: 'D:\\Codelib\\example', branch: 'main' });

    expect(parsed.sessionId).toBeNull();
    expect(parsed.feature).toBeNull();
    expect(parsed.focus).toBeNull();
    expect(parsed.stories).toEqual([]);
    expect(parsed.tasks).toEqual([]);
    expect(parsed.plan).toEqual([]);
    expect(parsed.changedFiles).toEqual([]);
  });

  it('defaults the chip to thinking when a report omits it', () => {
    const parsed = PushRequest.parse({
      repo: 'D:\\Codelib\\example',
      branch: 'main',
      focus: { note: 'reading the call sites' },
    });

    expect(parsed.focus?.chip).toBe('thinking');
  });

  it('rejects a chip outside the closed set', () => {
    // The one enum in the payload, because it is how an agent asks for a human.
    const parsed = PushRequest.safeParse({
      repo: 'D:\\Codelib\\example',
      branch: 'main',
      focus: { chip: 'panicking' },
    });

    expect(parsed.success).toBe(false);
  });

  it('takes any status text, because status is not an enum', () => {
    const statuses = ['done', 'waiting on CI', 'blocked on review', 'ᕕ( ᐛ )ᕗ', ''];

    for (const status of statuses) {
      const parsed = PushRequest.safeParse({
        repo: 'D:\\Codelib\\example',
        branch: 'main',
        tasks: [{ id: 'T001', title: 'A task', status }],
      });
      expect(parsed.success, `status ${JSON.stringify(status)} should be accepted`).toBe(true);
    }
  });

  it('strips unknown keys instead of failing, so a newer client degrades', () => {
    const parsed = PushRequest.parse({
      repo: 'D:\\Codelib\\example',
      branch: 'main',
      somethingFromNextYear: { nested: true },
      tasks: [{ id: 'T001', title: 'A task', status: 'todo', futureField: 7 }],
    });

    expect(parsed).not.toHaveProperty('somethingFromNextYear');
    expect(parsed.tasks[0]).not.toHaveProperty('futureField');
    expect(parsed.tasks[0]?.id).toBe('T001');
  });

  it('discards a client-supplied timestamp rather than rejecting the request', () => {
    const parsed = PushRequest.parse({
      repo: 'D:\\Codelib\\example',
      branch: 'main',
      receivedAt: 1,
    });

    expect(parsed).not.toHaveProperty('receivedAt');
  });

  it('requires a repo and a branch', () => {
    expect(PushRequest.safeParse({ branch: 'main' }).success).toBe(false);
    expect(PushRequest.safeParse({ repo: 'D:\\x' }).success).toBe(false);
    expect(PushRequest.safeParse({ repo: '', branch: 'main' }).success).toBe(false);
  });
});

describe('NoteRequest', () => {
  it('accepts text with an optional source', () => {
    const parsed = NoteRequest.parse({
      repo: 'D:\\Codelib\\example',
      branch: 'main',
      text: 'The auth middleware expects a cookie the harness never sets.',
      source: 'you asked',
    });

    expect(parsed.source).toBe('you asked');
  });

  it('defaults source to null', () => {
    const parsed = NoteRequest.parse({ repo: 'D:\\x', branch: 'main', text: 'a note' });
    expect(parsed.source).toBeNull();
  });

  it('rejects an empty note', () => {
    expect(NoteRequest.safeParse({ repo: 'D:\\x', branch: 'main', text: '' }).success).toBe(false);
  });
});

describe('TicketRequest', () => {
  const ENVELOPE = { repo: 'D:\\Codelib\\example', branch: 'main' };
  const MINIMAL = { key: 'PROJ-1234', title: 'The login form loses focus' };

  const ticket = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...ENVELOPE,
    ticket: { ...MINIMAL, ...overrides },
  });

  it('accepts a complete ticket', () => {
    const parsed = TicketRequest.parse(
      ticket({
        url: 'https://example.atlassian.net/browse/PROJ-1234',
        system: 'Jira',
        type: 'Bug',
        state: 'Ready for QA',
        priority: 'High',
        assignee: 'A. Developer',
        reporter: 'A. Tester',
        sprint: 'Sprint 42',
        description: 'Tabbing past the password field returns focus to the top.',
        criteria: ['Focus advances to Submit', 'Shift-tab returns to Password'],
        labels: ['accessibility', 'regression'],
        comments: [
          { author: 'A. Tester', text: 'Only in Firefox.', at: '3 days ago' },
          { text: 'Reproduced on 129.' },
        ],
        commentsOmitted: 150,
        fields: [{ label: 'Area Path', value: 'Contoso\\Web\\Identity' }],
        parent: { key: 'PROJ-1000', title: 'Accessibility pass', url: 'https://example.com/e/1000' },
      }),
    );

    expect(parsed.ticket.state).toBe('Ready for QA');
    expect(parsed.ticket.comments[0]?.at).toBe('3 days ago');
    expect(parsed.ticket.comments[1]?.author).toBeNull();
    expect(parsed.ticket.commentsOmitted).toBe(150);
    expect(parsed.ticket.fields[0]?.label).toBe('Area Path');
    expect(parsed.ticket.parent?.key).toBe('PROJ-1000');
  });

  it('accepts a key and a title alone — everything else is optional', () => {
    const parsed = TicketRequest.parse(ticket());

    expect(parsed.ticket.url).toBeNull();
    expect(parsed.ticket.system).toBeNull();
    expect(parsed.ticket.state).toBeNull();
    expect(parsed.ticket.description).toBeNull();
    expect(parsed.ticket.parent).toBeNull();
    expect(parsed.ticket.commentsOmitted).toBeNull();
    expect(parsed.ticket.criteria).toEqual([]);
    expect(parsed.ticket.labels).toEqual([]);
    expect(parsed.ticket.comments).toEqual([]);
    expect(parsed.ticket.fields).toEqual([]);
  });

  it('requires a key and a title', () => {
    expect(TicketRequest.safeParse({ ...ENVELOPE, ticket: { title: 'no key' } }).success).toBe(false);
    expect(TicketRequest.safeParse({ ...ENVELOPE, ticket: { key: 'PROJ-1' } }).success).toBe(false);
    expect(TicketRequest.safeParse(ENVELOPE).success).toBe(false);
  });

  it('puts no format rule on a key, whatever the tracker mints', () => {
    // The contract has never constrained an identifier and must not start here:
    // a pattern would be the board deciding which trackers may exist.
    for (const key of ['PROJ-1234', '45678', 'AB#12345', 'a/b/c', 'ticket 7']) {
      const parsed = TicketRequest.safeParse(ticket({ key }));
      expect(parsed.success, `key ${JSON.stringify(key)} should be accepted`).toBe(true);
    }
  });

  it('accepts an unopenable address, because that is not an invalid ticket', () => {
    /*
     * A `file:` address is refused at the point of *opening*, never at ingest.
     * Discarding a description and its acceptance criteria over one field that
     * will never become a control would serve nobody — the developer loses the
     * thing they came for to be protected from a link they cannot activate.
     * The rule that decides openability is tested in url.test.ts.
     */
    for (const url of [
      'file:///C:/Windows/System32/calc.exe',
      'javascript:alert(1)',
      'www.example.com',
    ]) {
      const parsed = TicketRequest.safeParse(ticket({ url }));
      expect(parsed.success, `${url} should be held`).toBe(true);
      if (parsed.success) expect(parsed.data.ticket.url).toBe(url);
    }
  });

  it('refuses an over-length address, because that is a size limit not a judgement', () => {
    const parsed = TicketRequest.safeParse(ticket({ url: `https://e.com/${'x'.repeat(MAX_URL)}` }));

    expect(parsed.success).toBe(false);
    expect(fieldPath(parsed.error?.issues[0]?.path ?? [])).toBe('ticket.url');
  });

  it('names the field and states a limit for every cap, at limit + 1 (FR-026)', () => {
    // A caller must be able to correct the request from the response alone, so
    // each refusal is checked for the field path *and* for stating a number.
    const cases: [string, Record<string, unknown>][] = [
      ['ticket.key', { key: 'k'.repeat(MAX_LABEL + 1) }],
      ['ticket.title', { title: 't'.repeat(MAX_LABEL + 1) }],
      ['ticket.description', { description: 'd'.repeat(MAX_RICH_TEXT + 1) }],
      ['ticket.criteria', { criteria: Array.from({ length: MAX_CRITERIA + 1 }, () => 'c') }],
      ['ticket.criteria[0]', { criteria: ['c'.repeat(MAX_TEXT + 1)] }],
      ['ticket.labels', { labels: Array.from({ length: MAX_TICKET_LABELS + 1 }, () => 'l') }],
      [
        'ticket.comments',
        { comments: Array.from({ length: MAX_COMMENTS + 1 }, () => ({ text: 'c' })) },
      ],
      ['ticket.comments[0].text', { comments: [{ text: 'c'.repeat(MAX_TEXT + 1) }] }],
      [
        'ticket.fields',
        { fields: Array.from({ length: MAX_EXTRA_FIELDS + 1 }, () => ({ label: 'l', value: 'v' })) },
      ],
      ['ticket.fields[0].value', { fields: [{ label: 'l', value: 'v'.repeat(MAX_TEXT + 1) }] }],
      ['ticket.parent.title', { parent: { title: 'p'.repeat(MAX_LABEL + 1) } }],
    ];

    for (const [field, overrides] of cases) {
      const parsed = TicketRequest.safeParse(ticket(overrides));

      expect(parsed.success, `${field} should refuse at limit + 1`).toBe(false);
      expect(fieldPath(parsed.error?.issues[0]?.path ?? [])).toBe(field);
      expect(parsed.error?.issues[0]?.message ?? '', `${field} should state its limit`).toMatch(/\d/);
    }
    // The loop above is vacuous if the table is ever emptied.
    expect(cases).toHaveLength(11);
  });

  it('accepts every cap exactly at its limit, so the boundary is the stated one', () => {
    // Without this, the test above would pass against a cap that is off by one
    // in the safe direction — refusing reports the spec permits.
    const parsed = TicketRequest.safeParse({
      ...ENVELOPE,
      ticket: {
        key: 'k'.repeat(MAX_LABEL),
        title: 't'.repeat(MAX_LABEL),
        description: 'd'.repeat(MAX_RICH_TEXT),
        criteria: Array.from({ length: MAX_CRITERIA }, () => 'c'),
        labels: Array.from({ length: MAX_TICKET_LABELS }, () => 'l'),
        comments: Array.from({ length: MAX_COMMENTS }, () => ({ text: 'c' })),
        fields: Array.from({ length: MAX_EXTRA_FIELDS }, () => ({ label: 'l', value: 'v' })),
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('truncates nothing it accepts (FR-027)', () => {
    const description = 'd'.repeat(MAX_RICH_TEXT);
    const parsed = TicketRequest.parse(ticket({ description }));

    expect(parsed.ticket.description).toHaveLength(MAX_RICH_TEXT);
    expect(parsed.ticket.description).toBe(description);
  });

  it('leaves MAX_TEXT where it was, so the larger cap reaches one field only', () => {
    // The bigger cap belongs to the one field somebody else wrote. If the second
    // assertion ever passes, 20,000 characters of agent prose can reach a focus
    // note, which is a regression in every other view.
    expect(MAX_RICH_TEXT).toBeGreaterThan(MAX_TEXT);
    expect(
      PushRequest.safeParse({ ...ENVELOPE, focus: { note: 'n'.repeat(MAX_TEXT + 1) } }).success,
    ).toBe(false);
  });

  it('rejects an empty comment, extra-field label, or parent title', () => {
    const accepts = (overrides: Record<string, unknown>): boolean =>
      TicketRequest.safeParse(ticket(overrides)).success;

    expect(accepts({ comments: [{ text: '' }] })).toBe(false);
    expect(accepts({ fields: [{ label: '', value: 'v' }] })).toBe(false);
    expect(accepts({ parent: { title: '' } })).toBe(false);
    // A field's *value* may legitimately be empty — the tracker had nothing there.
    expect(accepts({ fields: [{ label: 'Area Path', value: '' }] })).toBe(true);
  });

  it('refuses a negative or fractional omitted-comment count', () => {
    expect(TicketRequest.safeParse(ticket({ commentsOmitted: -1 })).success).toBe(false);
    expect(TicketRequest.safeParse(ticket({ commentsOmitted: 1.5 })).success).toBe(false);
    expect(TicketRequest.safeParse(ticket({ commentsOmitted: 0 })).success).toBe(true);
  });

  it('strips unknown keys on the ticket too, so a newer agent degrades', () => {
    const parsed = TicketRequest.parse(
      ticket({ watchers: 12, comments: [{ text: 'c', reactions: ['+1'] }] }),
    );

    expect(parsed.ticket).not.toHaveProperty('watchers');
    expect(parsed.ticket.comments[0]).not.toHaveProperty('reactions');
  });
});
