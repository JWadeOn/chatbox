import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { POST as postToolInvocationResult } from '../../src/app/api/tool-invocation-result/route';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

describe('POST /api/tool-invocation-result', () => {
  const token = jwt.sign({ userId: 'relay-user', role: 'student' }, JWT_SECRET);

  it('returns 401 without auth', async () => {
    const req = new NextRequest('http://localhost/api/tool-invocation-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invocationId: '550e8400-e29b-41d4-a716-446655440000',
        result: {},
      }),
    });
    const res = await postToolInvocationResult(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid invocationId', async () => {
    const req = new NextRequest('http://localhost/api/tool-invocation-result', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ invocationId: 'not-a-valid-uuid', result: { ok: true } }),
    });
    const res = await postToolInvocationResult(req);
    expect(res.status).toBe(400);
  });
});
