import { describe, expect, it } from 'vitest';
import { KhanToolHandler } from '../../server/apps/khan';

describe('KhanToolHandler', () => {
  describe('open_topic', () => {
    it('opens a topic and returns status', async () => {
      const handler = new KhanToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'open_topic', { topic: 'Photosynthesis' });
      expect(result.topic).toBe('Photosynthesis');
      expect(result.status).toBe('opened');
      expect(result.message).toContain('Photosynthesis');
    });

    it('returns error when topic is missing', async () => {
      const handler = new KhanToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'open_topic', {});
      expect(result.error).toBe('Missing required parameter: topic');
    });

    it('moves old topic to topicsReviewed when switching', async () => {
      const handler = new KhanToolHandler();
      await handler.handleToolInvoke('session-1', 'open_topic', { topic: 'Fractions' });
      await handler.handleToolInvoke('session-1', 'open_topic', { topic: 'Algebra' });

      const session = handler.getSession('session-1');
      expect(session?.currentTopic).toBe('Algebra');
      expect(session?.topicsReviewed).toContain('Fractions');
    });
  });

  describe('explain_concept', () => {
    it('explains a concept within the current topic', async () => {
      const handler = new KhanToolHandler();
      await handler.handleToolInvoke('session-1', 'open_topic', { topic: 'Biology' });
      const result = await handler.handleToolInvoke('session-1', 'explain_concept', { concept: 'Mitosis' });
      expect(result.topic).toBe('Biology');
      expect(result.concept).toBe('Mitosis');
      expect(result.explanation).toContain('Mitosis');
    });

    it('returns error with no active session', async () => {
      const handler = new KhanToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'explain_concept', { concept: 'Mitosis' });
      expect(result.error).toContain('No active topic');
    });

    it('returns error when concept is missing', async () => {
      const handler = new KhanToolHandler();
      await handler.handleToolInvoke('session-1', 'open_topic', { topic: 'Biology' });
      const result = await handler.handleToolInvoke('session-1', 'explain_concept', {});
      expect(result.error).toBe('Missing required parameter: concept');
    });
  });

  describe('quiz', () => {
    it('returns a quiz question with options', async () => {
      const handler = new KhanToolHandler();
      await handler.handleToolInvoke('session-1', 'open_topic', { topic: 'Chemistry' });
      const result = await handler.handleToolInvoke('session-1', 'quiz', {});
      expect(result.topic).toBe('Chemistry');
      expect(result.question).toBeDefined();
      expect(result.options).toHaveLength(4);
      expect(result.correctIndex).toBe(0);
    });

    it('increments questionsAsked', async () => {
      const handler = new KhanToolHandler();
      await handler.handleToolInvoke('session-1', 'open_topic', { topic: 'Math' });
      await handler.handleToolInvoke('session-1', 'quiz', {});
      await handler.handleToolInvoke('session-1', 'quiz', {});

      const session = handler.getSession('session-1');
      expect(session?.questionsAsked).toBe(2);
    });

    it('returns error with no active session', async () => {
      const handler = new KhanToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'quiz', {});
      expect(result.error).toContain('No active topic');
    });
  });

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const handler = new KhanToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'nonexistent', {});
      expect(result.error).toBe('Unknown tool: nonexistent');
    });
  });

  describe('session isolation', () => {
    it('maintains independent state per sessionId', async () => {
      const handler = new KhanToolHandler();
      await handler.handleToolInvoke('session-a', 'open_topic', { topic: 'Physics' });
      await handler.handleToolInvoke('session-b', 'open_topic', { topic: 'History' });

      const a = handler.getSession('session-a');
      const b = handler.getSession('session-b');
      expect(a?.currentTopic).toBe('Physics');
      expect(b?.currentTopic).toBe('History');
    });
  });
});
