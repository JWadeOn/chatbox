import { type NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { authErrorResponse, extractAuth } from '../../../../server/middleware/auth.middleware';
import { conversationService } from '../../../../server/services/conversation.service';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export async function POST(request: NextRequest) {
  try {
    const { userId } = extractAuth(request);
    const { conversationId, content } = await request.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'Missing conversationId or content' }, { status: 400 });
    }

    // Persist user message
    await conversationService.addMessage(conversationId, 'user', content);

    // Load conversation history
    const conversation = await conversationService.get(conversationId, userId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: 'You are a helpful educational assistant on the TutorMeAI platform.' },
      ...conversation.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    // Stream response
    const stream = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullContent = '';
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
            }
          }
          // Persist assistant message
          await conversationService.addMessage(conversationId, 'assistant', fullContent);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
