import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import next from 'next';
import { pool } from './lib/db';
import { isHealthCheckPath, shouldDelegateToNext } from './lib/http-static-routing';
import { logger } from './lib/logger';
import { WSManager } from './lib/ws-manager';

const dev = process.env.NODE_ENV !== 'production';
const port = Number.parseInt(process.env.PORT || '3000', 10);

// Chatbox web build static assets directory
const CHATBOX_DIST = join(__dirname, '..', 'chatbox', 'release', 'app', 'dist', 'renderer');
const chatboxAvailable = existsSync(join(CHATBOX_DIST, 'index.html'));

if (chatboxAvailable) {
  logger.info({ path: CHATBOX_DIST }, 'Chatbox SPA detected — serving as frontend');
} else {
  logger.info('Chatbox SPA not found — falling back to Next.js-only mode');
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const url = req.url || '/';
    const pathname = url.split('?')[0];

    // Health check endpoint — lightweight, no auth required
    if (isHealthCheckPath(pathname)) {
      const status = {
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        db: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        },
        memory: {
          rss: Math.floor(process.memoryUsage().rss / 1024 / 1024),
          heapUsed: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
        },
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
      return;
    }

    // API routes, /apps/* (Next app bundles), Next internals — or Next-only mode
    if (shouldDelegateToNext(pathname, chatboxAvailable)) {
      return handle(req, res);
    }

    // Try to serve Chatbox static file with cache headers
    const filePath = join(CHATBOX_DIST, pathname);
    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const cacheControl = ext === '.html' ? 'public, max-age=3600' : 'public, max-age=86400, immutable';
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': cacheControl });
      res.end(readFileSync(filePath));
      return;
    }

    // SPA fallback — serve index.html for client-side routing
    const indexPath = join(CHATBOX_DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(readFileSync(indexPath));
  });

  // Attach WebSocket manager to the HTTP server
  const _wsManager = new WSManager(server);

  server.listen(port, () => {
    logger.info(
      {
        port,
        env: process.env.NODE_ENV || 'development',
        OAUTH_REDIRECT_BASE_URL: process.env.OAUTH_REDIRECT_BASE_URL || '(not set)',
        NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || '(not set)',
      },
      'ChatBridge server ready'
    );
  });
});
