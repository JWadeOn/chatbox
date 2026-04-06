import { describe, expect, it } from 'vitest';
import { parseSseChunk } from '../../src/lib/chat-transport';

describe('parseSseChunk', () => {
  it('buffers partial SSE events until the next chunk arrives', () => {
    const first = parseSseChunk('data: {"type":"app_render","appSlug":"chess"');
    expect(first.events).toEqual([]);
    expect(first.remainder).toBe('data: {"type":"app_render","appSlug":"chess"');

    const second = parseSseChunk(
      ',"iframeUrl":"/apps/chess","sessionId":"session-1","invocationId":"a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d","toolName":"start_game","toolArgs":{},"toolResult":{}}\n\n',
      first.remainder
    );

    expect(second.remainder).toBe('');
    expect(second.events).toEqual([
      {
        type: 'app_render',
        appSlug: 'chess',
        iframeUrl: '/apps/chess',
        sessionId: 'session-1',
        invocationId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        toolName: 'start_game',
        toolArgs: {},
        toolResult: {},
      },
    ]);
  });

  it('parses multiple complete events from one chunk', () => {
    const parsed = parseSseChunk(
      'data: {"type":"tool_call","appSlug":"chess","toolName":"start_game","args":{},"result":{"status":"ok"}}\n' +
        'data: {"done":true}\n\n'
    );

    expect(parsed.remainder).toBe('');
    expect(parsed.events).toEqual([
      {
        type: 'tool_call',
        appSlug: 'chess',
        toolName: 'start_game',
        args: {},
        result: { status: 'ok' },
      },
      { done: true },
    ]);
  });

  it('flushes a final event even without a trailing newline', () => {
    const parsed = parseSseChunk('data: {"content":"hello"}', '', true);

    expect(parsed.remainder).toBe('');
    expect(parsed.events).toEqual([{ content: 'hello' }]);
  });
});
