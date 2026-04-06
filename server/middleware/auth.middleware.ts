import { type NextRequest, NextResponse } from 'next/server';
import { AuthError, authService } from '../services/auth.service';

export type AuthenticatedRequest = {
  userId: string;
  role: string;
};

export function extractAuth(request: NextRequest): AuthenticatedRequest {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid authorization header', 401);
  }

  const token = header.slice(7);
  return authService.verifyToken(token);
}

export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

const OPERATOR_ROLES = new Set(['admin', 'teacher']);

/** Teachers and admins may register apps and change approval status. */
export function requireOperatorRole(role: string): void {
  if (!OPERATOR_ROLES.has(role)) {
    throw new AuthError('Forbidden: teacher or admin role required', 403);
  }
}
