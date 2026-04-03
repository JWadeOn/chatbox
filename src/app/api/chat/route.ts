import { type NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChessToolHandler } from '../../../../server/apps/chess';
import { SpotifyToolHandler } from '../../../../server/apps/spotify';
import { WeatherToolHandler } from '../../../../server/apps/weather';
import { authErrorResponse, extractAuth } from '../../../../server/middleware/auth.middleware';
import { completionService } from '../../../../server/services/completion.service';
import { conversationService } from '../../../../server/services/conversation.service';
import { toolService } from '../../../../server/services/tool.service';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// App tool handlers (keyed by app slug)
const chessHandler = new ChessToolHandler();
const weatherHandler = new WeatherToolHandler();
const spotifyHandler = new SpotifyToolHandler();

async function handleToolCall(
  namespacedName: string,
  args: Record<string, unknown>,
  sessionId: string,
  userId: string,
  conversationId: string
): Promise<{ result: unknown; appSlug: string; toolName: string }> {
  const [appSlug, toolName] = namespacedName.split('__');

  let result: unknown;
  switch (appSlug) {
    case 'chess':
      result = await chessHandler.handleToolInvoke(sessionId, toolName, args);
      break;
    case 'weather':
      result = await weatherHandler.handleToolInvoke(toolName, args);
      break;
    case 'spotify':
      result = await spotifyHandler.handleToolInvoke(toolName, { ...args, conversationId }, userId);
      break;
    default:
      result = { error: `No handler for app: ${appSlug}` };
  }

  return { result, appSlug, toolName };
}

/**
 * Get active app state for mid-app assistance.
 * When a user asks a question during an active app session,
 * this injects the current app state into LLM context.
 * Checks all known session keys since the session ID varies per request.
 */
function getActiveAppContext(conversationId: string): string {
  // Chess: scan for any active game whose session key starts with the conversation
  // The chess handler stores games keyed by sessionId = "session-{conversationId}-{timestamp}"
  const games = chessHandler as unknown as { games: Map<string, unknown> };
  if (games.games) {
    for (const [key] of games.games) {
      if (key.startsWith(`session-${conversationId}-`)) {
        const state = chessHandler.getActiveGameState(key);
        if (state) {
          return `\n\n## Active App Context\nThere is an active chess game. Current state:\n- FEN: ${state.fen}\n- Turn: ${state.turn}\n- Move history: ${state.history?.join(', ') || 'none'}\n- Material: ${state.material}\nUse this context to help the user if they ask about the game.`;
        }
      }
    }
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = extractAuth(request);
    const { conversationId, content } = await request.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'Missing conversationId or content' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured. Add it to .env.local and restart.' },
        { status: 503 }
      );
    }

    // Persist user message
    await conversationService.addMessage(conversationId, 'user', content);

    // Load conversation history
    const conversation = await conversationService.get(conversationId, userId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Discover registered tools
    const discoveredTools = await toolService.discoverTools();
    const llmTools = toolService.formatForLLM(discoveredTools);

    // Build context retention: inject completed app session summaries
    const appSummaryContext = await completionService.buildContextWithSummaries(conversationId);

    // Build mid-app assistance: inject active app state
    const activeAppContext = getActiveAppContext(conversationId);

    const systemPrompt = `You are a helpful educational assistant on the TutorMeAI platform.

## Available Tools
You have access to tools from registered apps. Use them when the user's request clearly matches a tool's purpose.

## Rules
- Only invoke tools when the user's request clearly matches a tool's purpose.
- If a request is ambiguous between multiple tools, ask for clarification.
- Never invoke tools for unrelated queries.
- After a tool returns results, summarize them naturally for the user.
- For chess: use the chess__start_game tool to begin, chess__make_move to play moves, chess__get_board_state to analyze.
- For weather: use weather__get_weather with a location parameter.
- For spotify: first check auth with spotify__get_auth_status, then use spotify__create_playlist with name, mood, and optional track_count.
- If a Spotify action requires authentication, tell the user they need to connect their Spotify account first and provide the auth URL from the tool result.${appSummaryContext ? `\n\n${appSummaryContext}` : ''}${activeAppContext}`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversation.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    const encoder = new TextEncoder();
    const sessionId = `session-${conversationId}-${Date.now()}`;

    const readable = new ReadableStream({
      async start(controller) {
        try {
          let response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages,
            stream: false,
            ...(llmTools.length > 0 ? { tools: llmTools } : {}),
          });

          let retries = 0;
          const MAX_RETRIES = 2;

          // Tool call loop — handle function calls until the LLM gives a text response
          while (response.choices[0]?.message?.tool_calls && retries < MAX_RETRIES) {
            const toolCalls = response.choices[0].message.tool_calls;

            // Add assistant message with tool calls to context
            messages.push(response.choices[0].message);

            // Process each tool call
            for (const tc of toolCalls) {
              if (tc.type !== 'function') continue;
              const args = JSON.parse(tc.function.arguments || '{}');
              const { result, appSlug, toolName } = await handleToolCall(
                tc.function.name,
                args,
                sessionId,
                userId,
                conversationId
              );

              // Send tool invocation event to client
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', appSlug, toolName, args, result })}\n\n`)
              );

              // Send app_render for apps that have a UI component
              if (appSlug === 'chess' && toolName === 'start_game') {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'app_render',
                      appSlug: 'chess',
                      iframeUrl: '/apps/chess',
                      sessionId,
                    })}\n\n`
                  )
                );
              } else if (appSlug === 'spotify' && toolName === 'create_playlist') {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'app_render',
                      appSlug: 'spotify',
                      iframeUrl: '/apps/spotify',
                      sessionId,
                    })}\n\n`
                  )
                );
              }

              // Add tool result to context
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(result),
              });
            }

            // Get next LLM response with tool results
            response = await openai.chat.completions.create({
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
              messages,
              stream: false,
              ...(llmTools.length > 0 ? { tools: llmTools } : {}),
            });

            retries++;
          }

          // Send the final text response
          const finalContent = response.choices[0]?.message?.content || '';
          if (finalContent) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: finalContent })}\n\n`));
            await conversationService.addMessage(conversationId, 'assistant', finalContent);
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error';
          console.error('[chat] Error:', msg);
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
    console.error('[chat] Error:', error);
    return authErrorResponse(error);
  }
}
