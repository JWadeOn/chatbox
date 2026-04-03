import { type NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, extractAuth } from '../../../../server/middleware/auth.middleware';
import { toolService } from '../../../../server/services/tool.service';

export async function GET(request: NextRequest) {
  try {
    extractAuth(request);
    const tools = await toolService.discoverTools();
    return NextResponse.json({ tools });
  } catch (error) {
    return authErrorResponse(error);
  }
}
