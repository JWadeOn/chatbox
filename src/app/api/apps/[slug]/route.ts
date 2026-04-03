import { type NextRequest, NextResponse } from 'next/server';
import { appService } from '../../../../../server/services/app.service';

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
