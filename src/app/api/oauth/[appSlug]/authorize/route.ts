import { type NextRequest, NextResponse } from 'next/server';
import { authService } from '../../../../../../server/services/auth.service';
import { OAuthError, oauthService } from '../../../../../../server/services/oauth.service';

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

    const conversationId = request.nextUrl.searchParams.get('conversationId') ?? '';
    const redirectBaseUrl = process.env.OAUTH_REDIRECT_BASE_URL || request.nextUrl.origin;

    const { url } = oauthService.generateAuthUrl(appSlug, userId, conversationId, redirectBaseUrl);

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof OAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
