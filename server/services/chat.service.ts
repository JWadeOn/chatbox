import OpenAI from 'openai';
import { logEvent } from '../lib/logger';
import { conversationService } from './conversation.service';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool_result';
  content: string;
};

export type StreamCallbacks = {
  onStart: (messageId: string) => void;
  onChunk: (messageId: string, content: string) => void;
  onEnd: (messageId: string, fullContent: string) => void;
  onError: (error: string) => void;
};

export class ChatService {
  async handleMessage(
    conversationId: string,
    userId: string,
    content: string,
    callbacks: StreamCallbacks,
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[]
  ) {
    // Persist user message
    const userMsg = await conversationService.addMessage(conversationId, 'user', content);

    // Load conversation history
    const conversation = await conversationService.get(conversationId, userId);
    if (!conversation) {
      callbacks.onError('Conversation not found');
      return;
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system' as const,
        content: 'You are a helpful educational assistant on the TutorMeAI platform.',
      },
      ...conversation.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    logEvent({
      event: 'chat_message_received',
      conversationId,
      userId,
    });

    try {
      const stream = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        stream: true,
        ...(tools && tools.length > 0 ? { tools } : {}),
      });

      const messageId = userMsg.id;
      callbacks.onStart(messageId);

      let fullContent = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta?.content) {
          fullContent += delta.content;
          callbacks.onChunk(messageId, delta.content);
        }

        // Handle tool calls (will be expanded in T09)
        if (delta?.tool_calls) {
          // Tool call handling delegated to ToolRouter in T09
          logEvent({
            event: 'tool_call_detected',
            conversationId,
          });
        }
      }

      // Persist assistant message
      await conversationService.addMessage(conversationId, 'assistant', fullContent);
      callbacks.onEnd(messageId, fullContent);

      logEvent({
        event: 'chat_response_complete',
        conversationId,
        userId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      callbacks.onError(message);
      logEvent({
        event: 'chat_error',
        conversationId,
        userId,
      });
    }
  }
}

export const chatService = new ChatService();
