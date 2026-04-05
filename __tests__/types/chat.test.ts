import { describe, expect, it } from 'vitest';
import type { ServerMessage, StreamEventToolCall } from '../../src/types/chat';
import {
  createStreamingAssistantMessage,
  createUserMessage,
  getTextContent,
  getToolCallParts,
  normalizeServerMessage,
  toolCallEventToMessage,
} from '../../src/types/chat';

describe('normalizeServerMessage', () => {
  it('converts a user message to ChatMessageViewModel', () => {
    const server: ServerMessage = { id: '1', role: 'user', content: 'hello' };
    const vm = normalizeServerMessage(server);
    expect(vm.role).toBe('user');
    expect(vm.contentParts).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('converts an assistant message to ChatMessageViewModel', () => {
    const server: ServerMessage = { id: '2', role: 'assistant', content: 'hi there' };
    const vm = normalizeServerMessage(server);
    expect(vm.role).toBe('assistant');
    expect(getTextContent(vm)).toBe('hi there');
  });

  it('parses legacy tool-call format into tool-call content part', () => {
    const server: ServerMessage = {
      id: '3',
      role: 'system',
      content:
        '[chess] start_game({"color":"white"}) → {"board_fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","status":"in_progress"}',
    };
    const vm = normalizeServerMessage(server);
    expect(vm.role).toBe('tool');
    const toolParts = getToolCallParts(vm);
    expect(toolParts).toHaveLength(1);
    expect(toolParts[0].appSlug).toBe('chess');
    expect(toolParts[0].toolName).toBe('start_game');
    expect(toolParts[0].state).toBe('result');
  });

  it('parses tool-call error result', () => {
    const server: ServerMessage = {
      id: '4',
      role: 'system',
      content: '[khan] open_topic({"topic":"mars"}) → {"error":"No active topic"}',
    };
    const vm = normalizeServerMessage(server);
    const toolParts = getToolCallParts(vm);
    expect(toolParts[0].state).toBe('error');
  });

  it('handles system messages that are not tool calls', () => {
    const server: ServerMessage = { id: '5', role: 'system', content: 'Session started' };
    const vm = normalizeServerMessage(server);
    expect(vm.role).toBe('system');
    expect(getTextContent(vm)).toBe('Session started');
  });

  it('normalizes tool_result role to tool', () => {
    const server: ServerMessage = { id: '6', role: 'tool_result', content: 'result data' };
    const vm = normalizeServerMessage(server);
    expect(vm.role).toBe('tool');
  });

  it('includes timestamp from createdAt', () => {
    const server: ServerMessage = { id: '7', role: 'user', content: 'test', createdAt: '2026-01-01T00:00:00Z' };
    const vm = normalizeServerMessage(server);
    expect(vm.timestamp).toBe(new Date('2026-01-01T00:00:00Z').getTime());
  });
});

describe('toolCallEventToMessage', () => {
  it('creates a tool message from a stream event', () => {
    const event: StreamEventToolCall = {
      type: 'tool_call',
      appSlug: 'chess',
      toolName: 'start_game',
      args: { color: 'white' },
      result: { board_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
    };
    const msg = toolCallEventToMessage(event);
    expect(msg.role).toBe('tool');
    const parts = getToolCallParts(msg);
    expect(parts).toHaveLength(1);
    expect(parts[0].appSlug).toBe('chess');
    expect(parts[0].toolName).toBe('start_game');
  });

  it('marks error results as error state', () => {
    const event: StreamEventToolCall = {
      type: 'tool_call',
      appSlug: 'khan',
      toolName: 'open_topic',
      args: {},
      result: { error: 'API down' },
    };
    const msg = toolCallEventToMessage(event);
    expect(getToolCallParts(msg)[0].state).toBe('error');
  });
});

describe('createStreamingAssistantMessage', () => {
  it('creates an empty generating message', () => {
    const msg = createStreamingAssistantMessage('asst-1');
    expect(msg.id).toBe('asst-1');
    expect(msg.role).toBe('assistant');
    expect(msg.contentParts).toEqual([]);
    expect(msg.generating).toBe(true);
  });
});

describe('createUserMessage', () => {
  it('creates a user message with text content', () => {
    const msg = createUserMessage('hello world');
    expect(msg.role).toBe('user');
    expect(getTextContent(msg)).toBe('hello world');
    expect(msg.timestamp).toBeGreaterThan(0);
  });
});

describe('getTextContent', () => {
  it('concatenates text parts', () => {
    const msg = {
      id: '1',
      role: 'assistant' as const,
      contentParts: [
        { type: 'text' as const, text: 'Hello ' },
        { type: 'text' as const, text: 'world' },
      ],
    };
    expect(getTextContent(msg)).toBe('Hello world');
  });

  it('ignores non-text parts', () => {
    const msg = {
      id: '1',
      role: 'tool' as const,
      contentParts: [
        {
          type: 'tool-call' as const,
          state: 'result' as const,
          toolCallId: 'tc1',
          appSlug: 'chess',
          toolName: 'start',
          args: {},
          result: {},
        },
        { type: 'text' as const, text: 'Done' },
      ],
    };
    expect(getTextContent(msg)).toBe('Done');
  });
});
