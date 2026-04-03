import { type NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, extractAuth } from '../../../../server/middleware/auth.middleware';
import { toolRouter } from '../../../../server/services/tool-router.service';

/**
 * POST /api/app-complete
 *
 * Receives app_complete signals from the client (relayed from iframe postMessage)
 * and persists the completion state to the database.
 *
 * This closes the gap where iframe → client app_complete was handled locally
 * but never reached the server to update app_sessions and resolve intents.
 */
export async function POST(request: NextRequest) {
  try {
    extractAuth(request);

    const { sessionId, summary, data } = await request.json();

    if (!sessionId || typeof summary !== 'string') {
      return NextResponse.json({ error: 'Missing sessionId or summary' }, { status: 400 });
    }

    await toolRouter.handleAppComplete(sessionId, {
      app: data?.appSlug || 'unknown',
      human_summary: summary,
      key_results: data || {},
    });

    return NextResponse.json({ processed: true });
  } catch (error) {
    console.error('[app-complete] Error:', error);
    return authErrorResponse(error);
  }
}
