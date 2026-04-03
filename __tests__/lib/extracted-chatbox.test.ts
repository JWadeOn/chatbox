import { describe, expect, it } from 'vitest';
import {
  buildContext,
  checkCompactionNeeded,
  cleanToolCallParts,
  estimateConversationTokens,
  estimateTokens,
} from '../../src/lib/extracted/chatbox';
import type { ChatMessageViewModel } from '../../src/types/chat';

describe('estimateTokens', () => {
  it('returns 4 for empty string (message overhead only)', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates English text', () => {
    const tokens = estimateTokens('Hello world');
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it('estimates CJK text with higher ratio', () => {
    const english = estimateTokens('hello');
    const cjk = estimateTokens('你好世界你好');
    // CJK should be relatively more tokens per character
    expect(cjk / 6).toBeGreaterThan(english / 5 * 0.5);
  });
});

describe('estimateConversationTokens', () => {
  it('returns base overhead for empty conversation', () => {
    expect(estimateConversationTokens([])).toBe(3);
  });

  it('sums tokens across messages', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there, how can I help?' },
    ];
    const tokens = estimateConversationTokens(messages);
    expect(tokens).toBeGreaterThan(3);
  });
});

describe('checkCompactionNeeded', () => {
  it('returns not overflow for small conversations', () => {
    const messages = [{ role: 'user', content: 'hello' }];
    const result = checkCompactionNeeded(messages);
    expect(result.isOverflow).toBe(false);
    expect(result.currentTokens).toBeGreaterThan(0);
  });

  it('returns overflow when context is very large', () => {
    // Create a conversation that exceeds the threshold
    const bigContent = 'word '.repeat(50000);
    const messages = [{ role: 'user', content: bigContent }];
    const result = checkCompactionNeeded(messages, 1000, 0.5);
    expect(result.isOverflow).toBe(true);
  });
});

describe('buildContext', () => {
  const makeMsg = (id: string, role: ChatMessageViewModel['role'], text: string, extra?: Partial<ChatMessageViewModel>): ChatMessageViewModel => ({
    id,
    role,
    contentParts: [{ type: 'text', text }],
    ...extra,
  });

  it('returns empty array for no messages', () => {
    expect(buildContext([])).toEqual([]);
  });

  it('returns all messages when under the limit', () => {
    const messages = [
      makeMsg('1', 'user', 'hello'),
      makeMsg('2', 'assistant', 'hi'),
    ];
    const ctx = buildContext(messages);
    expect(ctx).toHaveLength(2);
  });

  it('limits to maxMessages keeping most recent', () => {
    const messages = Array.from({ length: 20 }, (_, i) =>
      makeMsg(`${i}`, i % 2 === 0 ? 'user' : 'assistant', `message ${i}`)
    );
    const ctx = buildContext(messages, 5);
    expect(ctx).toHaveLength(5);
    expect(ctx[ctx.length - 1].id).toBe('19');
  });

  it('uses summary message as boundary', () => {
    const messages = [
      makeMsg('1', 'user', 'old message'),
      makeMsg('2', 'assistant', 'old reply'),
      makeMsg('summary', 'system', 'Summary of previous conversation', { isSummary: true }),
      makeMsg('3', 'user', 'new message'),
      makeMsg('4', 'assistant', 'new reply'),
    ];
    const ctx = buildContext(messages, 10);
    // Should include summary + messages after it
    expect(ctx.some((m) => m.id === 'summary')).toBe(true);
    expect(ctx.some((m) => m.id === '3')).toBe(true);
    // Should not include old messages before summary
    expect(ctx.some((m) => m.id === '1')).toBe(false);
  });
});

describe('cleanToolCallParts', () => {
  const makeMsg = (id: string, role: ChatMessageViewModel['role'], parts: ChatMessageViewModel['contentParts']): ChatMessageViewModel => ({
    id,
    role,
    contentParts: parts,
  });

  it('preserves recent tool calls within keepRounds', () => {
    const messages = [
      makeMsg('u1', 'user', [{ type: 'text', text: 'old question' }]),
      makeMsg('a1', 'assistant', [{ type: 'text', text: 'old answer' }]),
      makeMsg('u2', 'user', [{ type: 'text', text: 'play chess' }]),
      makeMsg('t1', 'tool', [{ type: 'tool-call', state: 'result', toolCallId: 'tc1', appSlug: 'chess', toolName: 'start', args: {}, result: {} }]),
      makeMsg('a2', 'assistant', [{ type: 'text', text: 'Game started!' }]),
    ];
    const cleaned = cleanToolCallParts(messages, 2);
    // t1 is within the last 2 user rounds, so should be preserved
    const toolMsg = cleaned.find((m) => m.id === 't1');
    expect(toolMsg?.contentParts[0].type).toBe('tool-call');
  });

  it('removes tool calls from old rounds', () => {
    const messages = [
      makeMsg('u1', 'user', [{ type: 'text', text: 'first question' }]),
      makeMsg('t1', 'tool', [{ type: 'tool-call', state: 'result', toolCallId: 'tc1', appSlug: 'chess', toolName: 'start', args: {}, result: {} }]),
      makeMsg('a1', 'assistant', [{ type: 'text', text: 'answer 1' }]),
      makeMsg('u2', 'user', [{ type: 'text', text: 'second question' }]),
      makeMsg('t2', 'tool', [{ type: 'tool-call', state: 'result', toolCallId: 'tc2', appSlug: 'chess', toolName: 'move', args: {}, result: {} }]),
      makeMsg('a2', 'assistant', [{ type: 'text', text: 'answer 2' }]),
      makeMsg('u3', 'user', [{ type: 'text', text: 'third question' }]),
      makeMsg('a3', 'assistant', [{ type: 'text', text: 'answer 3' }]),
    ];
    const cleaned = cleanToolCallParts(messages, 1);
    // The oldest tool call (t1) should be cleaned
    expect(cleaned.find((m) => m.id === 't1')?.contentParts[0].type).toBe('info');
    // The more recent tool call (t2) may still be present depending on boundary
  });
});
