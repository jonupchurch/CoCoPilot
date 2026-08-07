import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

import { MAX_BODY_BYTES, rejection, type Rejection } from '@cocoapilot/contract';

import { handleHealth } from './routes/health.js';
import { handleNote } from './routes/note.js';
import { handlePush } from './routes/push.js';
import type { Store } from './store.js';

export interface ServiceDeps {
  store: Store;
  /**
   * Injected so a test can prove the service stamps its own clock rather than
   * trusting anything a client sent (FR-003).
   */
  now: () => number;
}

export interface HttpResult {
  status: number;
  body: unknown;
}

type BodyResult = { ok: true; value: unknown } | { ok: false; rejection: Rejection; oversized: boolean };

const JSON_CONTENT_TYPE = 'application/json';

export function createServer(deps: ServiceDeps): Server {
  return createHttpServer((req, res) => {
    void dispatch(req, res, deps).catch(() => {
      // Nothing below is expected to throw, and a caller cannot act on this, so
      // it says so rather than blaming a field.
      if (!res.headersSent) {
        sendJson(res, 500, rejection('internal', '(none)', 'the request could not be handled'));
      }
    });
  });
}

async function dispatch(req: IncomingMessage, res: ServerResponse, deps: ServiceDeps): Promise<void> {
  const method = req.method ?? 'GET';
  const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;

  if (path === '/v1/health') {
    if (method !== 'GET') return sendJson(res, 405, notAllowed(method, 'GET'));
    const result = handleHealth();
    return sendJson(res, result.status, result.body);
  }

  const handler = path === '/v1/push' ? handlePush : path === '/v1/note' ? handleNote : null;
  if (handler === null) {
    return sendJson(
      res,
      404,
      rejection('not_found', '(path)', `no route for ${method} ${path}`),
    );
  }
  if (method !== 'POST') return sendJson(res, 405, notAllowed(method, 'POST'));

  // Requiring a JSON content type is what forces a browser to preflight before
  // it can reach this service cross-origin, and nothing here answers a preflight.
  // Decision 18 accepts that any *local process* may report; it does not accept
  // that any page the user happens to have open may.
  const contentType = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
  if (contentType !== JSON_CONTENT_TYPE) {
    return sendJson(
      res,
      415,
      rejection('unsupported_media_type', '(headers)', `content-type must be ${JSON_CONTENT_TYPE}`),
    );
  }

  const body = await readJsonBody(req);
  if (!body.ok) {
    sendJson(res, body.oversized ? 413 : 400, body.rejection);
    // Respond first, then hang up: a client still streaming an oversized body
    // should get the reason rather than a bare connection reset.
    if (body.oversized) req.destroy();
    return;
  }

  const result = handler(body.value, deps);
  sendJson(res, result.status, result.body);
}

async function readJsonBody(req: IncomingMessage): Promise<BodyResult> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      return {
        ok: false,
        oversized: true,
        rejection: rejection(
          'payload_too_large',
          '(body)',
          `request body exceeds ${MAX_BODY_BYTES} bytes`,
        ),
      };
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (raw.trim() === '') {
    return {
      ok: false,
      oversized: false,
      rejection: rejection('invalid_json', '(body)', 'request body is empty'),
    };
  }

  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return {
      ok: false,
      oversized: false,
      rejection: rejection('invalid_json', '(body)', 'request body is not valid JSON'),
    };
  }
}

function notAllowed(method: string, allowed: string): Rejection {
  return rejection('method_not_allowed', '(method)', `${method} not allowed; use ${allowed}`);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}
