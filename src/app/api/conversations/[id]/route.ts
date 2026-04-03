import { type NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, extractAuth } from '../../../../../server/middleware/auth.middleware';
import { conversationService } from '../../../../../server/services/conversation.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = extractAuth(request);
    const { id } = await params;
    const conversation = await conversationService.get(id, userId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json(conversation);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = extractAuth(request);
    const { id } = await params;
    const deleted = await conversationService.delete(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
