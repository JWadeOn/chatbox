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

    // Railway (and similar proxies) forward the public host/proto via headers.
    // request.nextUrl.origin reflects the internal listener (localhost:3000), not the public URL.
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    const publicOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin;

    const redirectBaseUrl = process.env.OAUTH_REDIRECT_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || publicOrigin;

    console.info('[oauth/authorize] appSlug=%s origin=%s publicOrigin=%s redirectBaseUrl=%s', appSlug, request.nextUrl.origin, publicOrigin, redirectBaseUrl);

    const { url } = oauthService.generateAuthUrl(appSlug, userId, conversationId, redirectBaseUrl);

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof OAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
