import { type NextRequest, NextResponse } from 'next/server';
import { AppError, appService } from '../../../../../server/services/app.service';

export async function POST(request: NextRequest) {
  try {
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

    return NextResponse.json({ app }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
