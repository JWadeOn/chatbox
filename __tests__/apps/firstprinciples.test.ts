import { describe, expect, it } from 'vitest';
import { FirstPrinciplesToolHandler } from '../../server/apps/firstprinciples';

describe('FirstPrinciplesToolHandler', () => {
  describe('analyze', () => {
    it('returns structured analysis with all sections', async () => {
      const handler = new FirstPrinciplesToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'analyze', {
        question: 'Why is the sky blue?',
      });
      expect(result.question).toBe('Why is the sky blue?');
      expect(result.assumptions).toBeDefined();
      expect(result.principles).toBeDefined();
      expect(result.reasoning_steps).toBeDefined();
      expect(result.conclusion).toBeDefined();
    });

    it('assumptions is a non-empty array', async () => {
      const handler = new FirstPrinciplesToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'analyze', {
        question: 'How do plants grow?',
      });
      expect(Array.isArray(result.assumptions)).toBe(true);
      expect((result.assumptions as string[]).length).toBeGreaterThan(0);
    });

    it('principles is a non-empty array', async () => {
      const handler = new FirstPrinciplesToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'analyze', {
        question: 'What causes gravity?',
      });
      expect(Array.isArray(result.principles)).toBe(true);
      expect((result.principles as string[]).length).toBeGreaterThan(0);
    });

    it('reasoning_steps is a non-empty array', async () => {
      const handler = new FirstPrinciplesToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'analyze', {
        question: 'Why do we need sleep?',
      });
      expect(Array.isArray(result.reasoning_steps)).toBe(true);
      expect((result.reasoning_steps as string[]).length).toBeGreaterThan(0);
    });

    it('includes the original question in the result', async () => {
      const handler = new FirstPrinciplesToolHandler();
      const q = 'How does electricity work?';
      const result = await handler.handleToolInvoke('session-1', 'analyze', { question: q });
      expect(result.question).toBe(q);
      expect(result.conclusion as string).toContain(q);
    });

    it('returns error when question is missing', async () => {
      const handler = new FirstPrinciplesToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'analyze', {});
      expect(result.error).toBe('Missing required parameter: question');
    });
  });

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const handler = new FirstPrinciplesToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'summarize', {});
      expect(result.error).toBe('Unknown tool: summarize');
    });
  });
});
