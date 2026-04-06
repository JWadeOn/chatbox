import { type NextRequest, NextResponse } from 'next/server';
import { type AppApprovalStatus, isAppApprovalStatus } from '../../../../../server/lib/app-approval';
import { authErrorResponse, extractAuth, requireOperatorRole } from '../../../../../server/middleware/auth.middleware';
import { AppError, appService } from '../../../../../server/services/app.service';
import { toolService } from '../../../../../server/services/tool.service';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const app = await appService.getAppBySlug(slug);

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 });
    }

    return NextResponse.json({ app });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Set approval status (teacher/admin). Invalidates tool cache when status changes. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { role } = extractAuth(request);
    requireOperatorRole(role);

    const { slug } = await params;
    const body = await request.json();
    const next = body.approvalStatus as string;

    if (!isAppApprovalStatus(next) || next === 'pending') {
      return NextResponse.json(
        { error: 'approvalStatus must be "approved" or "disabled" (use registration for pending)' },
        { status: 400 }
      );
    }

    const app = await appService.setApprovalStatus(slug, next as AppApprovalStatus);
    toolService.invalidateCache();
    return NextResponse.json({ app });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return authErrorResponse(error);
  }
}
