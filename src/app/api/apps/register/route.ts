import { type NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, extractAuth, requireOperatorRole } from '../../../../../server/middleware/auth.middleware';
import { AppError, appService } from '../../../../../server/services/app.service';
import { toolService } from '../../../../../server/services/tool.service';

export async function POST(request: NextRequest) {
  try {
    const { role } = extractAuth(request);
    requireOperatorRole(role);

    const body = await request.json();
    const { slug, name, description, authType, iframeUrl, toolSchemas, oauthConfig } = body;

    if (!slug || !name || !description || !authType || !iframeUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const app = await appService.register({
      slug,
      name,
      description,
      authType,
      iframeUrl,
      toolSchemas: toolSchemas ?? [],
      oauthConfig,
    });

    // Invalidate tool cache so new tools are discovered immediately
    toolService.invalidateCache();

    return NextResponse.json({ app }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return authErrorResponse(error);
  }
}
