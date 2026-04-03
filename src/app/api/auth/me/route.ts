import { type NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, extractAuth } from '../../../../../server/middleware/auth.middleware';
import { authService } from '../../../../../server/services/auth.service';

export async function GET(request: NextRequest) {
  try {
    const { userId } = extractAuth(request);
    const user = await authService.getUser(userId);
    return NextResponse.json({ user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
