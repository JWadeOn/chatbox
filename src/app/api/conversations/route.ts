import { type NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, extractAuth } from '../../../../server/middleware/auth.middleware';
import { conversationService } from '../../../../server/services/conversation.service';

export async function GET(request: NextRequest) {
  try {
    const { userId } = extractAuth(request);
    const list = await conversationService.list(userId);
    return NextResponse.json({ conversations: list });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = extractAuth(request);
    const body = await request.json();
    const conversation = await conversationService.create(userId, body.title);
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
