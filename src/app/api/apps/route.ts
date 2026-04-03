import { NextResponse } from 'next/server';
import { appService } from '../../../../server/services/app.service';

export async function GET() {
  try {
    const apps = await appService.listApps();
    return NextResponse.json({ apps });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
