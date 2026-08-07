import { createService, type Service } from '../../src/main/index.js';

/**
 * A service on an ephemeral port.
 *
 * Never the real range: a developer running these tests probably has a board
 * open, and a suite that fought it for port 41847 would fail for a reason that
 * has nothing to do with the code under test.
 */
export interface TestService extends Service {
  readonly baseUrl: string;
  post(path: string, body: unknown, init?: RequestInit): Promise<PostResult>;
  get(path: string): Promise<PostResult>;
}

export interface PostResult {
  status: number;
  body: unknown;
}

export async function startTestService(now?: () => number): Promise<TestService> {
  const service = await createService(now === undefined ? { port: 0 } : { port: 0, now });
  const baseUrl = `http://127.0.0.1:${service.port}`;

  const request = async (
    path: string,
    init: RequestInit,
  ): Promise<PostResult> => {
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    return { status: response.status, body: text === '' ? null : JSON.parse(text) };
  };

  return {
    ...service,
    baseUrl,
    post: (path, body, init = {}) =>
      request(path, {
        ...init,
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    get: (path) => request(path, { method: 'GET' }),
  };
}

/** A valid envelope pointing at a directory that certainly exists. */
export function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    repo: process.cwd(),
    branch: 'feat/session-hook',
    sessionId: 'a1b2c3',
    ...overrides,
  };
}
