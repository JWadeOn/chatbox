import { createServer } from 'node:http';
import next from 'next';
import { logger } from './lib/logger';
import { WSManager } from './lib/ws-manager';

const dev = process.env.NODE_ENV !== 'production';
const port = Number.parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  // Attach WebSocket manager to the HTTP server
  const _wsManager = new WSManager(server);

  server.listen(port, () => {
    logger.info({ port, env: process.env.NODE_ENV || 'development' }, `ChatBridge server ready on port ${port}`);
  });
});
