import { type NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, extractAuth, requireOperatorRole } from '../../../../../server/middleware/auth.middleware';
import { appService } from '../../../../../server/services/app.service';

/** List apps awaiting operator approval (teacher/admin only). */
export async function GET(request: NextRequest) {
  try {
    const { role } = extractAuth(request);
    requireOperatorRole(role);

    const apps = await appService.listPendingApps();
    return NextResponse.json({ apps });
  } catch (error) {
    return authErrorResponse(error);
  }
}
