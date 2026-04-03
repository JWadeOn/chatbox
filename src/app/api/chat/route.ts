import { type NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChessToolHandler } from '../../../../server/apps/chess';
import { SpotifyToolHandler } from '../../../../server/apps/spotify';
import { WeatherToolHandler } from '../../../../server/apps/weather';
import { authErrorResponse, extractAuth } from '../../../../server/middleware/auth.middleware';
import { completionService } from '../../../../server/services/completion.service';
import { conversationService } from '../../../../server/services/conversation.service';
import { toolService } from '../../../../server/services/tool.service';
import { toolRouter } from '../../../../server/services/tool-router.service';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// App tool handlers (keyed by app slug)
const chessHandler = new ChessToolHandler();
const weatherHandler = new WeatherToolHandler();
const spotifyHandler = new SpotifyToolHandler();

// App iframe URLs for app_render events
const APP_IFRAME_URLS: Record<string, string> = {
  chess: '/apps/chess',
  spotify: '/apps/spotify',
};

// Which tool calls should trigger an app_render
const APP_RENDER_TRIGGERS: Record<string, string[]> = {
  chess: ['start_game'],
  spotify: ['create_playlist'],
};

/** Execute the actual tool handler (app-specific logic). */
async function executeToolHandler(
  appSlug: string,
  toolName: string,
  args: Record<string, unknown>,
  sessionId: string,
  userId: string,
  conversationId: string
): Promise<unknown> {
  switch (appSlug) {
    case 'chess':
      return chessHandler.handleToolInvoke(sessionId, toolName, args);
    case 'weather':
      return weatherHandler.handleToolInvoke(toolName, args);
    case 'spotify':
      return spotifyHandler.handleToolInvoke(toolName, { ...args, conversationId }, userId);
    default:
      return { error: `No handler for app: ${appSlug}` };
  }
}

/**
 * Get active app state for mid-app assistance.
 * Scans chess handler for active games keyed by the conversation.
 */
function getActiveAppContext(conversationId: string): string {
  const games = chessHandler as unknown as { games: Map<string, unknown> };
  if (games.games) {
    for (const [key] of games.games) {
      if (key.includes(conversationId)) {
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

            // Process each tool call through the tool router
            for (const tc of toolCalls) {
              if (tc.type !== 'function') continue;

              const [appSlug, toolName] = tc.function.name.split('__');
              const args = JSON.parse(tc.function.arguments || '{}');

              // 1. Route through toolRouter for session management, logging, circuit breaker
              const routeResult = await toolRouter.invoke({
                conversationId,
                appSlug,
                toolName,
                toolParams: args,
                userId,
              });

              if (!routeResult.success) {
                // Circuit breaker open or tool not found
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'tool_call', appSlug, toolName, args, result: { error: routeResult.error } })}\n\n`
                  )
                );
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify({ error: routeResult.error }),
                });
                continue;
              }

              const invocationId = routeResult.invocationId;
              const sessionId = routeResult.sessionId ?? '';

              // 2. Execute the actual tool handler
              const result = await executeToolHandler(appSlug, toolName, args, sessionId, userId, conversationId);

              // 3. Record the result in the tool router (logging, circuit breaker)
              if (invocationId) {
                await toolRouter.handleResult(invocationId, result);
              }

              // Send tool invocation event to client
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', appSlug, toolName, args, result })}\n\n`)
              );

              // Send app_render for apps that have a UI component
              const triggers = APP_RENDER_TRIGGERS[appSlug];
              if (triggers?.includes(toolName) && APP_IFRAME_URLS[appSlug]) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'app_render',
                      appSlug,
                      iframeUrl: APP_IFRAME_URLS[appSlug],
                      sessionId,
                    })}\n\n`
                  )
                );
              }

              // Add tool result to context
              messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
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
