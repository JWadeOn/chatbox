import type { IncomingMessage } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { authService } from '../services/auth.service';
import { chatService } from '../services/chat.service';
import { logEvent } from './logger';

type AuthenticatedSocket = WebSocket & { userId: string; role: string };

export class WSManager {
  private wss: WebSocketServer;
  private clients = new Map<string, Set<AuthenticatedSocket>>();

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
          this.handleConnection(authedWs);
        });
      } catch {
        (socket as { destroy: () => void }).destroy();
      }
    });
  }

  private handleConnection(ws: AuthenticatedSocket) {
    const userSockets = this.clients.get(ws.userId) || new Set();
    userSockets.add(ws);
    this.clients.set(ws.userId, userSockets);

    logEvent({ event: 'ws_connected', userId: ws.userId });

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
