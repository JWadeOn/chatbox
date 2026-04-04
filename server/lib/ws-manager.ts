import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { authService } from '../services/auth.service';
import { chatService } from '../services/chat.service';
import { logEvent } from './logger';

type AuthenticatedSocket = WebSocket & { userId: string; role: string; isAlive: boolean };

const MAX_CONNECTIONS_PER_USER = 2;
const HEARTBEAT_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 10_000;

export class WSManager {
  private wss: WebSocketServer;
  private clients = new Map<string, Set<AuthenticatedSocket>>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  // biome-ignore lint: server type is intentionally loose for http.Server compatibility
  constructor(server: { on: (event: string, cb: (...args: any[]) => void) => void }) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket: unknown, head: Buffer) => {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      if (url.pathname !== '/api/chat') {
        (socket as { destroy: () => void }).destroy();
        return;
      }

      const token = url.searchParams.get('token');
      if (!token) {
        (socket as { destroy: () => void }).destroy();
        return;
      }

      try {
        const payload = authService.verifyToken(token);
        this.wss.handleUpgrade(request, socket as never, head, (ws) => {
          const authedWs = ws as AuthenticatedSocket;
          authedWs.userId = payload.userId;
          authedWs.role = payload.role;
          authedWs.isAlive = true;
          this.handleConnection(authedWs);
        });
      } catch {
        (socket as { destroy: () => void }).destroy();
      }
    });

    // Start heartbeat to detect dead connections
    this.startHeartbeat();
  }

  private handleConnection(ws: AuthenticatedSocket) {
    const userSockets = this.clients.get(ws.userId) || new Set<AuthenticatedSocket>();

    // Enforce per-user connection limit: close oldest if at max
    if (userSockets.size >= MAX_CONNECTIONS_PER_USER) {
      const oldest = userSockets.values().next().value;
      if (oldest) {
        oldest.close(1008, 'Connection limit exceeded');
        userSockets.delete(oldest);
      }
    }

    userSockets.add(ws);
    this.clients.set(ws.userId, userSockets);

    logEvent({ event: 'ws_connected', userId: ws.userId });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await this.handleMessage(ws, msg);
      } catch (_error) {
        this.send(ws, { type: 'error', message: 'Invalid message format', recoverable: true });
      }
    });

    ws.on('close', () => {
      const sockets = this.clients.get(ws.userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) this.clients.delete(ws.userId);
      }
      logEvent({ event: 'ws_disconnected', userId: ws.userId });
    });
  }

  /** Ping all clients every 30s; terminate those that don't respond within 10s. */
  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      for (const [, sockets] of this.clients) {
        for (const ws of sockets) {
          if (!ws.isAlive) {
            ws.terminate();
            sockets.delete(ws);
            continue;
          }
          ws.isAlive = false;
          ws.ping();
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref();
  }

  private async handleMessage(
    ws: AuthenticatedSocket,
    msg: { type: string; conversationId?: string; content?: string }
  ) {
    if (msg.type === 'user_message') {
      if (!msg.conversationId || !msg.content) {
        this.send(ws, { type: 'error', message: 'Missing conversationId or content', recoverable: true });
        return;
      }

      await chatService.handleMessage(msg.conversationId, ws.userId, msg.content, {
        onStart: (messageId) => this.send(ws, { type: 'stream_start', messageId }),
        onChunk: (messageId, content) => this.send(ws, { type: 'stream_chunk', messageId, content }),
        onEnd: (messageId) => this.send(ws, { type: 'stream_end', messageId }),
        onError: (message) => this.send(ws, { type: 'error', message, recoverable: true }),
      });
    }
  }

  sendToUser(userId: string, data: Record<string, unknown>) {
    const sockets = this.clients.get(userId);
    if (sockets) {
      for (const ws of sockets) {
        this.send(ws, data);
      }
    }
  }

  private send(ws: WebSocket, data: Record<string, unknown>) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
}
