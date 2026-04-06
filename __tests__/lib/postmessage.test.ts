import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvocationBuffer } from '../../src/lib/invocation-buffer';
import { createPostMessageListener, createToolInvokeMessage } from '../../src/lib/postmessage';

describe('createPostMessageListener', () => {
  const handlers = {
    onToolResult: vi.fn(),
    onAppComplete: vi.fn(),
    onAppStateUpdate: vi.fn(),
    onAppError: vi.fn(),
    onHeartbeat: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const listener = createPostMessageListener('https://chess.app', handlers);

  it('rejects messages from wrong origin', () => {
    listener({ origin: 'https://evil.com', data: '{}' } as MessageEvent);
    expect(handlers.onToolResult).not.toHaveBeenCalled();
    expect(handlers.onAppComplete).not.toHaveBeenCalled();
  });

  it('handles app_complete from correct origin', () => {
    listener({
      origin: 'https://chess.app',
      data: { jsonrpc: '2.0', method: 'app_complete', params: { summary: 'Game over', data: { winner: 'white' } } },
    } as MessageEvent);
    expect(handlers.onAppComplete).toHaveBeenCalledWith('Game over', { winner: 'white' });
  });

  it('handles app_error', () => {
    listener({
      origin: 'https://chess.app',
      data: { jsonrpc: '2.0', method: 'app_error', params: { message: 'Invalid move', recoverable: true } },
    } as MessageEvent);
    expect(handlers.onAppError).toHaveBeenCalledWith('Invalid move', true);
  });

  it('handles app_state_update', () => {
    listener({
      origin: 'https://chess.app',
      data: { jsonrpc: '2.0', method: 'app_state_update', params: { summary: 'Move 12', board_fen: 'abc' } },
    } as MessageEvent);
    expect(handlers.onAppStateUpdate).toHaveBeenCalledWith('Move 12', { summary: 'Move 12', board_fen: 'abc' });
  });

  it('handles heartbeat', () => {
    listener({
      origin: 'https://chess.app',
      data: { jsonrpc: '2.0', method: 'heartbeat', params: { timestamp: 123456 } },
    } as MessageEvent);
    expect(handlers.onHeartbeat).toHaveBeenCalledWith(123456);
  });

  it('handles tool result (JSON-RPC response)', () => {
    listener({
      origin: 'https://chess.app',
      data: { jsonrpc: '2.0', result: { success: true, board_fen: 'xyz' }, id: 1 },
    } as MessageEvent);
    expect(handlers.onToolResult).toHaveBeenCalledWith('1', { success: true, board_fen: 'xyz' });
  });

  it('rejects app_complete when sessionId does not match expected', () => {
    const scoped = createPostMessageListener('https://chess.app', handlers, false, 'session-a');
    scoped({
      origin: 'https://chess.app',
      data: {
        jsonrpc: '2.0',
        method: 'app_complete',
        params: { sessionId: 'other', summary: 'x', data: {} },
      },
    } as MessageEvent);
    expect(handlers.onAppComplete).not.toHaveBeenCalled();
  });

  it('accepts app_complete when sessionId matches', () => {
    const scoped = createPostMessageListener('https://chess.app', handlers, false, 'session-a');
    scoped({
      origin: 'https://chess.app',
      data: {
        jsonrpc: '2.0',
        method: 'app_complete',
        params: { sessionId: 'session-a', summary: 'done', data: { ok: true } },
      },
    } as MessageEvent);
    expect(handlers.onAppComplete).toHaveBeenCalledWith('done', { ok: true });
  });

  it('ignores invalid JSON string', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    listener({ origin: 'https://chess.app', data: 'not json{' } as MessageEvent);
    spy.mockRestore();
    // Should not throw
  });
});

describe('createToolInvokeMessage', () => {
  it('creates correct JSON-RPC message', () => {
    const msg = createToolInvokeMessage('make_move', { move: 'e2e4' }, 'abc12345-0000-0000-0000-000000000000');
    expect(msg.jsonrpc).toBe('2.0');
    expect(msg.method).toBe('tool_invoke');
    expect(msg.params.tool).toBe('make_move');
    expect(msg.params.arguments).toEqual({ move: 'e2e4' });
    expect(msg.params.invocationId).toBe('abc12345-0000-0000-0000-000000000000');
  });
});

describe('InvocationBuffer', () => {
  it('buffers messages before iframe is ready', () => {
    const send = vi.fn();
    const buffer = new InvocationBuffer(send);
    const msg = createToolInvokeMessage('test', {}, '00000000-0000-0000-0000-000000000000');

    buffer.enqueue(msg);
    expect(send).not.toHaveBeenCalled();
    expect(buffer.getQueueLength()).toBe(1);

    buffer.destroy();
  });

  it('flushes queue when iframe becomes ready', () => {
    const send = vi.fn();
    const buffer = new InvocationBuffer(send);
    const msg1 = createToolInvokeMessage('t1', {}, '00000000-0000-0000-0000-000000000001');
    const msg2 = createToolInvokeMessage('t2', {}, '00000000-0000-0000-0000-000000000002');

    buffer.enqueue(msg1);
    buffer.enqueue(msg2);
    expect(send).not.toHaveBeenCalled();

    buffer.markReady();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(1, msg1);
    expect(send).toHaveBeenNthCalledWith(2, msg2);
    expect(buffer.getQueueLength()).toBe(0);

    buffer.destroy();
  });

  it('sends immediately after ready', () => {
    const send = vi.fn();
    const buffer = new InvocationBuffer(send);
    buffer.markReady();

    const msg = createToolInvokeMessage('test', {}, '00000000-0000-0000-0000-000000000003');
    buffer.enqueue(msg);
    expect(send).toHaveBeenCalledWith(msg);

    buffer.destroy();
  });

  it('calls onTimeout if iframe never becomes ready', async () => {
    const send = vi.fn();
    const onTimeout = vi.fn();
    const buffer = new InvocationBuffer(send, onTimeout, 50);

    await new Promise((r) => setTimeout(r, 100));
    expect(onTimeout).toHaveBeenCalled();

    buffer.destroy();
  });

  it('does not call onTimeout if iframe becomes ready in time', async () => {
    const send = vi.fn();
    const onTimeout = vi.fn();
    const buffer = new InvocationBuffer(send, onTimeout, 100);

    buffer.markReady();
    await new Promise((r) => setTimeout(r, 150));
    expect(onTimeout).not.toHaveBeenCalled();

    buffer.destroy();
  });

  it('isReady reflects state correctly', () => {
    const buffer = new InvocationBuffer(vi.fn());
    expect(buffer.isReady()).toBe(false);
    buffer.markReady();
    expect(buffer.isReady()).toBe(true);
    buffer.destroy();
  });
});
