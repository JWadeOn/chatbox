import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_APPROVAL_APPROVED, APP_APPROVAL_DISABLED } from '../../server/lib/app-approval';
import { db } from '../../server/lib/db';
import { apps, users } from '../../server/lib/schema';
import { appService } from '../../server/services/app.service';
import { GET as getAppBySlug, PATCH as patchAppBySlug } from '../../src/app/api/apps/[slug]/route';
import { POST as registerApp } from '../../src/app/api/apps/register/route';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('App governance API', () => {
  let adminUserId: string;
  let studentUserId: string;
  let adminToken: string;
  let studentToken: string;
  const pendingSlug = `gov-pending-${Date.now()}`;
  const disabledSlug = `gov-disabled-${Date.now()}`;

  beforeAll(async () => {
    const [admin] = await db
      .insert(users)
      .values({
        email: `gov-admin-${Date.now()}@test.local`,
        passwordHash: 'x',
        displayName: 'Gov Admin',
        role: 'admin',
      })
      .returning();
    adminUserId = admin.id;
    adminToken = jwt.sign({ userId: admin.id, role: 'admin' }, JWT_SECRET);

    const [student] = await db
      .insert(users)
      .values({
        email: `gov-student-${Date.now()}@test.local`,
        passwordHash: 'x',
        displayName: 'Gov Student',
        role: 'student',
      })
      .returning();
    studentUserId = student.id;
    studentToken = jwt.sign({ userId: student.id, role: 'student' }, JWT_SECRET);

    await appService.register({
      slug: pendingSlug,
      name: 'Pending Gov App',
      description: 'Awaiting approval',
      authType: 'none',
      iframeUrl: 'https://example.com/pending',
      toolSchemas: [{ name: 'ping', description: 'ping', parameters: { type: 'object', properties: {} } }],
    });

    await appService.register({
      slug: disabledSlug,
      name: 'Disabled Gov App',
      description: 'Was approved then disabled',
      authType: 'none',
      iframeUrl: 'https://example.com/disabled',
      toolSchemas: [{ name: 'pong', description: 'pong', parameters: { type: 'object', properties: {} } }],
    });
    await appService.setApprovalStatus(disabledSlug, APP_APPROVAL_APPROVED);
    await appService.setApprovalStatus(disabledSlug, APP_APPROVAL_DISABLED);
  });

  afterAll(async () => {
    await db.delete(apps).where(eq(apps.slug, pendingSlug));
    await db.delete(apps).where(eq(apps.slug, disabledSlug));
    await db.delete(users).where(eq(users.id, adminUserId));
    await db.delete(users).where(eq(users.id, studentUserId));
  });

  it('POST /api/apps/register returns 401 without auth', async () => {
    const req = new NextRequest('http://localhost/api/apps/register', {
      method: 'POST',
      body: JSON.stringify({
        slug: `x-${Date.now()}`,
        name: 'X',
        description: 'Y',
        authType: 'none',
        iframeUrl: 'https://a.com',
        toolSchemas: [],
      }),
    });
    const res = await registerApp(req);
    expect(res.status).toBe(401);
  });

  it('PATCH /api/apps/[slug] returns 403 for student', async () => {
    const req = new NextRequest(`http://localhost/api/apps/${pendingSlug}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalStatus: 'approved' }),
    });
    const res = await patchAppBySlug(req, { params: Promise.resolve({ slug: pendingSlug }) });
    expect(res.status).toBe(403);
  });

  it('POST /api/apps/register returns 403 for student', async () => {
    const req = new NextRequest('http://localhost/api/apps/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: `student-reg-${Date.now()}`,
        name: 'X',
        description: 'Y',
        authType: 'none',
        iframeUrl: 'https://a.com',
        toolSchemas: [],
      }),
    });
    const res = await registerApp(req);
    expect(res.status).toBe(403);
  });

  it('GET /api/apps/[slug] returns 404 for disabled app', async () => {
    const res = await getAppBySlug(new NextRequest(`http://localhost/api/apps/${disabledSlug}`), {
      params: Promise.resolve({ slug: disabledSlug }),
    });
    expect(res.status).toBe(404);
  });

  it('GET /api/apps/[slug] returns 404 for pending (non-approved) app', async () => {
    const res = await getAppBySlug(new NextRequest(`http://localhost/api/apps/${pendingSlug}`), {
      params: Promise.resolve({ slug: pendingSlug }),
    });
    expect(res.status).toBe(404);
  });

  it('GET /api/apps/[slug] returns 200 after operator PATCH approves', async () => {
    const patchReq = new NextRequest(`http://localhost/api/apps/${pendingSlug}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalStatus: 'approved' }),
    });
    const patchRes = await patchAppBySlug(patchReq, { params: Promise.resolve({ slug: pendingSlug }) });
    expect(patchRes.status).toBe(200);

    const res = await getAppBySlug(new NextRequest(`http://localhost/api/apps/${pendingSlug}`), {
      params: Promise.resolve({ slug: pendingSlug }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.app?.slug).toBe(pendingSlug);
    expect(body.app?.approvalStatus).toBe('approved');
  });
});
