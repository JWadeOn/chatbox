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

    // Redirect back to the conversation on the same host that handled the callback.
    const baseUrl = request.nextUrl.origin;
    return NextResponse.redirect(`${baseUrl}/conversations/${result.conversationId}?oauth=success`);
  } catch (error) {
    if (error instanceof OAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'OAuth callback failed' }, { status: 500 });
  }
}
