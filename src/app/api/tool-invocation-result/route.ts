import { type NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, extractAuth } from '../../../../server/middleware/auth.middleware';
import { toolRouter } from '../../../../server/services/tool-router.service';

const INVOCATION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Relays iframe JSON-RPC tool results to the server so `tool_logs` and circuit breaker state stay authoritative.
 */
export async function POST(request: NextRequest) {
  try {
    extractAuth(request);
    const body = await request.json();
    const invocationId = body.invocationId as string;
    const { result } = body;

    if (!invocationId || !INVOCATION_ID_RE.test(invocationId)) {
      return NextResponse.json({ error: 'Invalid or missing invocationId' }, { status: 400 });
    }

    await toolRouter.handleResult(invocationId, result);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
