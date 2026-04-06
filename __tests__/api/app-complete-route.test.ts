import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST as postAppComplete } from '../../src/app/api/app-complete/route';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('POST /api/app-complete', () => {
  const token = jwt.sign({ userId: 'complete-user', role: 'student' }, JWT_SECRET);

  it('returns 401 without auth', async () => {
    const req = new NextRequest('http://localhost/api/app-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: '550e8400-e29b-41d4-a716-446655440000', summary: 'Done' }),
    });
    const res = await postAppComplete(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when summary is missing', async () => {
    const req = new NextRequest('http://localhost/api/app-complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId: '550e8400-e29b-41d4-a716-446655440000' }),
    });
    const res = await postAppComplete(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when sessionId is missing', async () => {
    const req = new NextRequest('http://localhost/api/app-complete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ summary: 'Only summary' }),
    });
    const res = await postAppComplete(req);
    expect(res.status).toBe(400);
  });
});
