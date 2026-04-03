import { type NextRequest, NextResponse } from 'next/server';
import { authService } from '../../../../../../server/services/auth.service';
import { oauthService } from '../../../../../../server/services/oauth.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ appSlug: string }> }) {
  try {
    const { appSlug } = await params;

    // Extract auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { userId } = authService.verifyToken(token);

    const status = await oauthService.getTokenStatus(userId, appSlug);

    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
