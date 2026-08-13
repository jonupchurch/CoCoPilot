import { MAX_BODY_BYTES, MAX_RICH_TEXT, MAX_URL } from 'cocoapilot-contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { envelope, startTestService, type TestService } from '../helpers/service.js';

interface Rejection {
  ok: false;
  error: string;
  field: string;
  message: string;
}

const TICKET = { key: 'PROJ-1234', title: 'The login form loses focus' };

describe('POST /v1/ticket', () => {
  let service: TestService;

  beforeEach(async () => {
    service = await startTestService();
  });

  afterEach(async () => {
    await service.close();
  });

  const session = () => service.store.getSession(process.cwd(), 'a1b2c3');

  it('holds a reported ticket', async () => {
    const response = await service.post('/v1/ticket', {
      ...envelope(),
      ticket: { ...TICKET, state: 'In Progress', criteria: ['Focus advances to Submit'] },
    });

    expect(response.status).toBe(200);
    expect(session()?.ticket?.key).toBe('PROJ-1234');
    expect(session()?.ticket?.criteria).toEqual(['Focus advances to Submit']);
    expect(session()?.ticketReportedAt).toBeGreaterThan(0);
  });

  it('creates the session with no report when a ticket arrives first', async () => {
    // FR-006: first contact may be any of the three doors.
    await service.post('/v1/ticket', { ...envelope(), ticket: TICKET });

    expect(session()?.report).toBeNull();
    expect(session()?.ticket?.title).toBe('The login form loses focus');
  });

  it('survives a report that says nothing about it, and replaces on a new one', async () => {
    /*
     * FR-003 and FR-004 over the wire. The unit test asserts the same thing
     * about reach; this one asserts it about the *doors*, which is where a
     * future refactor would most plausibly reintroduce the coupling — by having
     * one handler call the other's store method.
     */
    await service.post('/v1/ticket', { ...envelope(), ticket: TICKET });
    await service.post('/v1/push', {
      ...envelope(),
      tasks: [{ id: 'T001', title: 'Wire the fetch', status: 'active' }],
    });

    expect(session()?.ticket?.key).toBe('PROJ-1234');

    await service.post('/v1/ticket', {
      ...envelope(),
      ticket: { key: 'PROJ-9999', title: 'A different ticket' },
    });

    expect(session()?.ticket?.key).toBe('PROJ-9999');
    // Replaced, not accumulated: there is one ticket per session, never a list.
    expect(session()?.report?.tasks).toHaveLength(1);
  });

  it('holds a ticket carrying an unopenable address, and keeps the address', async () => {
    /*
     * **The asymmetry worth stating.** A ticket whose `url` is `file:` is a
     * perfectly good ticket: the developer still needs its description and its
     * acceptance criteria, and the address is simply never offered as a control.
     * Refusing the request would discard everything to protect against a link
     * nobody can activate.
     */
    for (const url of [
      'file:///C:/Windows/System32/calc.exe',
      'javascript:alert(1)',
      'ms-msdt:/id',
      'httpx://example.com',
      'javascript:void(0)//https://example.com',
      'www.example.com',
    ]) {
      const response = await service.post('/v1/ticket', {
        ...envelope(),
        ticket: { ...TICKET, url },
      });

      expect(response.status, `${url} should be accepted`).toBe(200);
      expect(session()?.ticket?.url, `${url} should be kept verbatim`).toBe(url);
    }
  });

  it('refuses an over-length description, naming the field and its limit', async () => {
    const response = await service.post('/v1/ticket', {
      ...envelope(),
      ticket: { ...TICKET, description: 'd'.repeat(MAX_RICH_TEXT + 1) },
    });

    expect(response.status).toBe(400);
    const body = response.body as Rejection;
    expect(body.error).toBe('invalid_field');
    expect(body.field).toBe('ticket.description');
    expect(body.message).toContain(String(MAX_RICH_TEXT));
    // Refused rather than shortened (FR-027): nothing was held at all.
    expect(session()).toBeUndefined();
  });

  it('refuses an over-length address, which is the one address rule at ingest', async () => {
    const response = await service.post('/v1/ticket', {
      ...envelope(),
      ticket: { ...TICKET, url: `https://example.com/${'x'.repeat(MAX_URL)}` },
    });

    expect(response.status).toBe(400);
    expect((response.body as Rejection).field).toBe('ticket.url');
  });

  it('refuses a ticket with no key, naming it', async () => {
    const response = await service.post('/v1/ticket', {
      ...envelope(),
      ticket: { title: 'no key at all' },
    });

    expect(response.status).toBe(400);
    expect((response.body as Rejection).field).toBe('ticket.key');
  });

  it('answers 413 before parsing, on size alone', async () => {
    // Decided from the body length, so a payload this size is never held in
    // memory as an object graph — the same path the other two doors use.
    const response = await service.post('/v1/ticket', 'x'.repeat(MAX_BODY_BYTES + 1));

    expect(response.status).toBe(413);
    expect((response.body as Rejection).error).toBe('payload_too_large');
  });

  it('answers 415 for a wrong content type', async () => {
    const response = await service.post(
      '/v1/ticket',
      { ...envelope(), ticket: TICKET },
      { headers: { 'content-type': 'text/plain' } },
    );

    expect(response.status).toBe(415);
  });

  it('answers 405 for a method other than POST', async () => {
    const response = await service.get('/v1/ticket');

    expect(response.status).toBe(405);
  });

  it('answers 404 for a path that is not one of the three doors', async () => {
    // Named here so the route table's completeness is asserted somewhere: three
    // verbs and nothing else, whatever a caller guesses at.
    const response = await service.post('/v1/tickets', { ...envelope(), ticket: TICKET });

    expect(response.status).toBe(404);
  });

  it('refuses a repository path that does not exist, changing nothing', async () => {
    const response = await service.post('/v1/ticket', {
      ...envelope({ repo: 'D:\\definitely\\not\\here' }),
      ticket: TICKET,
    });

    expect(response.status).toBe(400);
    expect((response.body as Rejection).field).toBe('repo');
  });

  it('stamps its own clock rather than trusting one that was sent', async () => {
    await service.close();
    service = await startTestService(() => 4_242);

    await service.post('/v1/ticket', {
      ...envelope(),
      receivedAt: 999,
      ticket: TICKET,
    });

    expect(session()?.ticketReportedAt).toBe(4_242);
  });
});
