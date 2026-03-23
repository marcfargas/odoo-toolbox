import { Server as HttpServer } from 'node:http';
import express, { type Request, type Response } from 'express';
import debug from 'debug';
import { OdooAuthError } from '@marcfargas/odoo-client';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { OdooClientPool, OdooConnectionConfig } from '../client-pool';
import { McpPoolFullError } from '../client-pool';
import { McpOdooServer } from '../server';

const log = debug('odoo-mcp:transport:http');

export interface HttpTransportOptions {
  port: number;
  host?: string;
  /** Allowed Odoo base URLs (scheme + host only). Requests to unlisted URLs → 401. */
  allowedUrls: string[];
  pool: OdooClientPool;
  trustProxy: boolean;
  /** express.json body size limit (default: '1mb'). */
  bodyLimit?: string;
}

export interface HttpTransportHandle {
  close: () => Promise<void>;
}

function unauthorized(res: Response): void {
  res.status(401).json({ error: 'Unauthorized' });
}

function extractClientIp(req: Request, trustProxy: boolean): string | null {
  if (trustProxy) {
    const xff = req.header('x-forwarded-for');
    if (xff) {
      return xff.split(',')[0]?.trim() ?? null;
    }
  }
  return req.socket.remoteAddress ?? null;
}

/**
 * Parse the four X-Odoo-* connection headers.
 * Returns null if any required header is missing.
 */
function parseOdooHeaders(req: Request): OdooConnectionConfig | null {
  const url = req.header('x-odoo-url')?.trim();
  const db = req.header('x-odoo-db')?.trim();
  const user = req.header('x-odoo-user')?.trim();
  const password = req.header('x-odoo-password')?.trim();

  if (!url || !db || !user || !password) {
    return null;
  }

  return { url, db, user, password };
}

/**
 * Normalise a URL for whitelist comparison:
 * strip trailing slash, lowercase scheme+host.
 */
function normaliseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/\/$/, '');
  }
}

export async function startHttpTransport(
  options: HttpTransportOptions
): Promise<HttpTransportHandle> {
  const normalisedAllowed = options.allowedUrls.map(normaliseUrl);

  const app = express();
  app.use(express.json({ limit: options.bodyLimit ?? '1mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', transport: 'http', pool: options.pool.size });
  });

  app.post('/mcp', async (req: Request, res: Response) => {
    // 1. Require all four X-Odoo-* headers.
    const headers = parseOdooHeaders(req);
    if (!headers) {
      unauthorized(res);
      return;
    }

    // 2. Validate X-Odoo-Url against whitelist.
    const normUrl = normaliseUrl(headers.url);
    if (!normalisedAllowed.includes(normUrl)) {
      log('Rejected request for non-whitelisted URL: %s', headers.url);
      unauthorized(res);
      return;
    }

    const clientIp = extractClientIp(req, options.trustProxy);
    log(
      'MCP request from %s → %s/%s@%s',
      clientIp ?? 'unknown',
      headers.user,
      headers.db,
      headers.url
    );

    try {
      // 3. Acquire (or create) the authenticated session for these credentials.
      //    Throws OdooAuthError if credentials are invalid.
      const session = await options.pool.acquire(headers);

      // 4. Build a fresh McpOdooServer + transport for this request.
      //
      //    The MCP SDK's stateless StreamableHTTPServerTransport sets
      //    _hasHandledRequest=true on first use and throws on reuse.
      //    Each HTTP request therefore needs its own transport instance.
      //    McpOdooServer creation is cheap (auth is already done via the pool).
      const { version, getPolicy, audit } = options.pool.serverOptions;
      const mcpServer = new McpOdooServer({
        version,
        client: session.client,
        getPolicy,
        cache: session.cache,
        audit,
        userLogin: headers.user,
      });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (error instanceof OdooAuthError) {
        log('Odoo auth failed for %s@%s: %s', headers.user, headers.url, (error as Error).message);
        unauthorized(res);
        return;
      }

      if (error instanceof McpPoolFullError) {
        log('Pool full: %s', (error as Error).message);
        res.status(429).json({ error: (error as Error).message });
        return;
      }

      log('MCP HTTP request failed: %o', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  });

  const host = options.host ?? '0.0.0.0';

  const httpServer = await new Promise<HttpServer>((resolve, reject) => {
    const instance = app.listen(options.port, host, () => resolve(instance));
    instance.on('error', reject);
  });

  log('HTTP transport listening on %s:%d', host, options.port);

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        httpServer.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      }),
  };
}
