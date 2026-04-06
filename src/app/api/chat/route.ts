import { type NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ChessToolHandler } from '../../../../server/apps/chess';
import { FirstPrinciplesToolHandler } from '../../../../server/apps/firstprinciples';
import { FlashcardsToolHandler } from '../../../../server/apps/flashcards';
import { KhanToolHandler } from '../../../../server/apps/khan';
import { StudyPlannerToolHandler } from '../../../../server/apps/studyplanner';
import { logEvent } from '../../../../server/lib/logger';
import { toolRateLimiter } from '../../../../server/lib/rate-limiter';
import { authErrorResponse, extractAuth } from '../../../../server/middleware/auth.middleware';
import { buildActiveAppContextForConversation } from '../../../../server/services/active-app-context.service';
import { completionService } from '../../../../server/services/completion.service';
import { conversationService } from '../../../../server/services/conversation.service';
import { toolService } from '../../../../server/services/tool.service';
import { toolRouter } from '../../../../server/services/tool-router.service';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// App tool handlers (keyed by app slug)
const chessHandler = new ChessToolHandler();
const khanHandler = new KhanToolHandler();
const flashcardsHandler = new FlashcardsToolHandler();
const firstPrinciplesHandler = new FirstPrinciplesToolHandler();
const studyPlannerHandler = new StudyPlannerToolHandler();

// App iframe URLs for app_render events
const APP_IFRAME_URLS: Record<string, string> = {
  chess: '/apps/chess',
  khan: '/apps/khan',
  flashcards: '/apps/flashcards',
  firstprinciples: '/apps/firstprinciples',
  studyplanner: '/apps/studyplanner',
};

// Which tool calls should trigger an app_render
const APP_RENDER_TRIGGERS: Record<string, string[]> = {
  chess: ['start_game'],
  khan: ['open_topic'],
  flashcards: ['load_deck', 'create_deck'],
  firstprinciples: ['analyze'],
  studyplanner: ['open_planner', 'create_study_session', 'list_upcoming_sessions'],
};

const TOOL_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 60_000;

/** Execute the actual tool handler with a 15s timeout. */
async function executeToolHandler(
  appSlug: string,
  toolName: string,
  args: Record<string, unknown>,
  sessionId: string,
  userId: string,
  _conversationId: string
): Promise<unknown> {
  const handler = (() => {
    switch (appSlug) {
      case 'chess':
        return chessHandler.handleToolInvoke(sessionId, toolName, args);
      case 'khan':
        return khanHandler.handleToolInvoke(sessionId, toolName, args);
      case 'flashcards':
        return flashcardsHandler.handleToolInvoke(sessionId, toolName, args, userId);
      case 'firstprinciples':
        return firstPrinciplesHandler.handleToolInvoke(sessionId, toolName, args);
      case 'studyplanner':
        return studyPlannerHandler.handleToolInvoke(sessionId, toolName, args, userId, _conversationId);
      default:
        return Promise.resolve({ error: `No handler for app: ${appSlug}` });
    }
  })();

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Tool ${appSlug}__${toolName} timed out after ${TOOL_TIMEOUT_MS / 1000}s`)),
      TOOL_TIMEOUT_MS
    )
  );

  return Promise.race([handler, timeout]);
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
    const activeAppContext = await buildActiveAppContextForConversation(conversationId, {
      chess: chessHandler,
      khan: khanHandler,
      flashcards: flashcardsHandler,
      firstprinciples: firstPrinciplesHandler,
      studyplanner: studyPlannerHandler,
    });

    const systemPrompt = `You are an educational assistant on the TutorMeAI platform, helping K-12 students learn through interactive tools and conversation.

## Your Role
You help students learn by combining conversation with hands-on learning tools. When a student can benefit from an interactive experience, guide them to the right tool. When they finish, help them reflect on what they learned.

## Available Learning Tools

### Chess (Strategic Thinking)
A chess experience with three modes. **When a student asks to play chess, you MUST ask which mode they want first — do not call start_game until they choose.** Present the options briefly:
1. **Tutoring** — a local board where I coach you through moves (good for learning)
2. **vs Computer** — play Stockfish on Lichess, levels 1-8
3. **vs Human** — get a shareable link to challenge a friend

Then call chess__start_game with the chosen mode:
- Tutoring: use mode='tutoring'. Then use chess__make_move to play and chess__get_board_state to analyze. **The board is rendered visually in an iframe — NEVER draw ASCII/text boards in your responses.** Just coach the student on tactics.
- vs Computer: use mode='vs_computer' with optional level (1-8, default 3). The student plays on Lichess in a new tab — share the game link.
- vs Human: use mode='vs_human'. Share the challenge link so their friend can join.

For Lichess modes, use chess__get_board_state to check game status when asked, and chess__get_game_link to reshare the link.

### Khan Academy Companion (Topic Exploration)
A topic companion for exploring any subject. Use khan__open_topic with a topic name to open a lesson view. Use khan__explain_concept with a concept to get a student-friendly explanation. Use khan__quiz to generate a quiz question on the current topic. Guide the student through topics, encourage curiosity, and help them test their understanding.

### First Principles Tutor (Critical Thinking)
A critical thinking tool that breaks down questions into first principles. Use firstprinciples__analyze with a question or problem to decompose it into assumptions, foundational principles, and step-by-step reasoning. Help students see the structure behind complex questions and develop analytical thinking skills.

### Study Planner (Google Calendar OAuth)
An external authenticated app for planning study time in Google Calendar. Use studyplanner__open_planner first; if auth is required, ask the student to connect Google. Use studyplanner__create_study_session to schedule blocks and studyplanner__list_upcoming_sessions to review upcoming sessions.

## Rules
- Only invoke tools when the student's request clearly matches a tool's purpose.
- If a request is ambiguous between multiple tools, ask for clarification.
- Never invoke tools for unrelated queries — respond conversationally instead.
- After a tool returns results, connect them back to what the student is learning.
- Frame interactions as learning opportunities, not just feature demonstrations.${appSummaryContext ? `\n\n${appSummaryContext}` : ''}${activeAppContext}`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversation.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    ];

    const encoder = new TextEncoder();

    // 60s request-level timeout — prevents indefinite connection holding
    const requestTimeout = setTimeout(() => {
      // Signal handled in the stream's catch block
    }, REQUEST_TIMEOUT_MS);
    const requestDeadline = Date.now() + REQUEST_TIMEOUT_MS;

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
          while (response.choices[0]?.message?.tool_calls && retries < MAX_RETRIES && Date.now() < requestDeadline) {
            const toolCalls = response.choices[0].message.tool_calls;

            // Add assistant message with tool calls to context
            messages.push(response.choices[0].message);

            // Process each tool call through the tool router
            for (const tc of toolCalls) {
              if (tc.type !== 'function') continue;

              const [appSlug, toolName] = tc.function.name.split('__');
              const args = JSON.parse(tc.function.arguments || '{}');

              // 0. Rate limit check (10 tool invocations/min/user)
              const rateCheck = toolRateLimiter.check(userId);
              if (!rateCheck.allowed) {
                const retryAfter = Math.ceil(rateCheck.retryAfterMs / 1000);
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'tool_call', appSlug, toolName, args, result: { error: `Rate limit exceeded. Try again in ${retryAfter}s.` } })}\n\n`
                  )
                );
                messages.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  content: JSON.stringify({ error: `Rate limit exceeded. Try again in ${retryAfter} seconds.` }),
                });
                continue;
              }
              toolRateLimiter.record(userId);

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

              // 2. Execute the actual tool handler (with 15s timeout)
              logEvent(
                {
                  event: 'tool_invocation_dispatched',
                  invocationId: invocationId ?? undefined,
                  sessionId,
                  conversationId,
                },
                { appSlug, toolName }
              );
              let result: unknown;
              try {
                result = await executeToolHandler(appSlug, toolName, args, sessionId, userId, conversationId);
              } catch (toolErr) {
                const errMsg = toolErr instanceof Error ? toolErr.message : 'Tool execution failed';
                result = { error: errMsg };
                logEvent(
                  { event: 'tool_invocation_failed', invocationId: invocationId ?? undefined, conversationId },
                  { appSlug, toolName, error: errMsg }
                );
                if (invocationId) {
                  await toolRouter.handleTimeout(invocationId);
                }
              }

              // 3. Record the result in the tool router (logging, circuit breaker)
              if (invocationId && !(result as Record<string, unknown>)?.error) {
                await toolRouter.handleResult(invocationId, result);
              }

              // Send tool invocation event to client
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', appSlug, toolName, args, result })}\n\n`)
              );

              // Send app_render for apps that have a UI component (includes tool relay for iframe)
              const triggers = APP_RENDER_TRIGGERS[appSlug];
              if (invocationId && triggers?.includes(toolName) && APP_IFRAME_URLS[appSlug]) {
                // Append tool result as URL-encoded query params so the iframe can read them on mount
                const resultObj = result as Record<string, unknown>;
                const extraParams = new URLSearchParams();
                for (const [key, value] of Object.entries(resultObj || {})) {
                  if (value !== undefined && value !== null && typeof value !== 'object') {
                    extraParams.set(key, String(value));
                  }
                }
                const baseUrl = APP_IFRAME_URLS[appSlug];
                const iframeUrlWithResult = extraParams.toString() ? `${baseUrl}?${extraParams.toString()}` : baseUrl;

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'app_render',
                      appSlug,
                      iframeUrl: iframeUrlWithResult,
                      sessionId,
                      invocationId,
                      toolName,
                      toolArgs: args,
                      toolResult: result,
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
          clearTimeout(requestTimeout);
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
