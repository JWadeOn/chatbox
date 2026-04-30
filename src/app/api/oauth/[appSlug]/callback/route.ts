import { type NextRequest, NextResponse } from 'next/server';
import { OAuthError, oauthService } from '../../../../../../server/services/oauth.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ appSlug: string }> }) {
  try {
    const { appSlug } = await params;

    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state parameter' }, { status: 400 });
    }

    const result = await oauthService.handleCallback(appSlug, code, state);

    // Use the redirect base URL from the OAuth state, which reflects the public-facing origin.
    // request.nextUrl.origin resolves to the internal proxy address (localhost:3000) on Railway.
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    const publicOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin;
    const baseUrl = result.redirectBaseUrl || publicOrigin;

    console.info('[oauth/callback] appSlug=%s origin=%s publicOrigin=%s baseUrl=%s', appSlug, request.nextUrl.origin, publicOrigin, baseUrl);
    return NextResponse.redirect(`${baseUrl}/conversations/${result.conversationId}?oauth=success`);
  } catch (error) {
    if (error instanceof OAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'OAuth callback failed' }, { status: 500 });
  }
}
