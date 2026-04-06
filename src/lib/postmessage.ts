export type JsonRpcRequest = {
  jsonrpc: '2.0';
  method: string;
  params: Record<string, unknown>;
  id?: number;
};

export type JsonRpcResponse = {
  jsonrpc: '2.0';
  result?: unknown;
  error?: { code: number; message: string };
  id: number;
};

export type PostMessageHandler = {
  onToolResult: (invocationId: string, result: unknown) => void;
  onAppComplete: (summary: string, data: Record<string, unknown>) => void;
  onAppStateUpdate: (summary: string, data: Record<string, unknown>) => void;
  onAppError: (message: string, recoverable: boolean) => void;
  onHeartbeat: (timestamp: number) => void;
};

function paramsSessionOk(params: Record<string, unknown> | undefined, expectedSessionId: string | undefined): boolean {
  if (!expectedSessionId) return true;
  return params?.sessionId === expectedSessionId;
}

export function createPostMessageListener(
  expectedOrigin: string,
  handlers: PostMessageHandler,
  allowNullOrigin = false,
  expectedSessionId?: string
) {
  return (event: MessageEvent) => {
    if (event.origin !== expectedOrigin && !(allowNullOrigin && event.origin === 'null')) {
      console.warn(`[postmessage] Origin rejected: received ${event.origin}, expected ${expectedOrigin}`);
      return;
    }

    let msg: JsonRpcRequest | JsonRpcResponse;
    try {
      msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      console.warn('[postmessage] Invalid JSON received');
      return;
    }

    if ('jsonrpc' in msg && msg.jsonrpc !== '2.0') {
      console.warn('[postmessage] Rejected: jsonrpc must be 2.0');
      return;
    }

    if ('method' in msg) {
      if (!paramsSessionOk(msg.params, expectedSessionId)) {
        console.warn('[postmessage] Session mismatch or missing sessionId on app message');
        return;
      }
      switch (msg.method) {
        case 'app_complete':
          handlers.onAppComplete(
            (msg.params?.summary as string) || '',
            (msg.params?.data as Record<string, unknown>) || {}
          );
          break;
        case 'app_state_update':
          handlers.onAppStateUpdate((msg.params?.summary as string) || '', msg.params || {});
          break;
        case 'app_error':
          handlers.onAppError(
            (msg.params?.message as string) || 'Unknown error',
            (msg.params?.recoverable as boolean) ?? true
          );
          break;
        case 'heartbeat':
          handlers.onHeartbeat((msg.params?.timestamp as number) || Date.now());
          break;
        case 'iframe_ready':
          // Handled by AppRenderer directly
          break;
      }
    } else if ('result' in msg && msg.id !== undefined) {
      const res = msg.result;
      if (expectedSessionId) {
        if (!res || typeof res !== 'object' || Array.isArray(res)) {
          console.warn('[postmessage] Tool result rejected: expected object with sessionId');
          return;
        }
        const ro = res as Record<string, unknown>;
        if (ro.sessionId !== expectedSessionId) {
          console.warn('[postmessage] Tool result session mismatch');
          return;
        }
      }
      const inv =
        typeof res === 'object' &&
        res !== null &&
        'invocationId' in res &&
        typeof (res as { invocationId: unknown }).invocationId === 'string'
          ? (res as { invocationId: string }).invocationId
          : String(msg.id);
      handlers.onToolResult(inv, msg.result);
    }
  };
}

export function createToolInvokeMessage(
  tool: string,
  args: Record<string, unknown>,
  invocationId: string
): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    method: 'tool_invoke',
    params: { tool, arguments: args, invocationId },
    id: Number.parseInt(invocationId.slice(0, 8), 16) || 1,
  };
}
