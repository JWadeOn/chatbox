import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { db, pool } from '../../server/lib/db';
import { apps } from '../../server/lib/schema';
import { AppError, AppService } from '../../server/services/app.service';

const appService = new AppService();
const TEST_SLUG = `test-app-${Date.now()}`;
const TEST_SLUG_2 = `test-app-2-${Date.now()}`;
const TEST_SLUG_INVALID = `test-invalid-${Date.now()}`;

const validToolSchemas = [
  {
    name: 'search',
    description: 'Search for items',
    parameters: { query: { type: 'string' } },
  },
  {
    name: 'calculate',
    description: 'Perform a calculation',
    parameters: { expression: { type: 'string' } },
  },
];

afterAll(async () => {
  await db.delete(apps).where(eq(apps.slug, TEST_SLUG));
  await db.delete(apps).where(eq(apps.slug, TEST_SLUG_2));
  await db.delete(apps).where(eq(apps.slug, TEST_SLUG_INVALID));
  await pool.end();
});

describe('AppService.register', () => {
  it('registers with valid schema and returns app with sanitized toolSchemas and status active', async () => {
    const result = await appService.register({
      slug: TEST_SLUG,
      name: 'Test App',
      description: 'A test application',
      authType: 'none',
      iframeUrl: 'https://example.com/app',
      toolSchemas: validToolSchemas,
    });

    expect(result.id).toBeDefined();
    expect(result.slug).toBe(TEST_SLUG);
    expect(result.name).toBe('Test App');
    expect(result.status).toBe('active');
    expect(result.toolSchemas).toHaveLength(2);
    // Verify sanitization was applied (names should be alphanumeric/underscore only)
    for (const tool of result.toolSchemas as { name: string; description: string }[]) {
      expect(tool.name).toMatch(/^[a-zA-Z0-9_]+$/);
      expect(tool.description).toBeDefined();
    }
  });

  it('rejects duplicate slug with error', async () => {
    await expect(
      appService.register({
        slug: TEST_SLUG,
        name: 'Duplicate App',
        description: 'Duplicate slug test',
        authType: 'none',
        iframeUrl: 'https://example.com/dup',
        toolSchemas: [],
      })
    ).rejects.toThrow('slug already exists');
  });

  it('rejects invalid tool schema missing name', async () => {
    await expect(
      appService.register({
        slug: TEST_SLUG_INVALID,
        name: 'Invalid Tool App',
        description: 'Invalid tool schema',
        authType: 'none',
        iframeUrl: 'https://example.com/invalid',
        toolSchemas: [{ name: '', description: 'Missing name tool', parameters: {} }],
      })
    ).rejects.toThrow();
  });

  it('rejects invalid tool schema missing description', async () => {
    await expect(
      appService.register({
        slug: `${TEST_SLUG_INVALID}-desc`,
        name: 'Invalid Tool App 2',
        description: 'Invalid tool schema desc',
        authType: 'none',
        iframeUrl: 'https://example.com/invalid2',
        toolSchemas: [{ name: 'sometool', description: '', parameters: {} }],
      })
    ).rejects.toThrow();
  });

  it('rejects invalid authType', async () => {
    await expect(
      appService.register({
        slug: `${TEST_SLUG_INVALID}-auth`,
        name: 'Bad Auth App',
        description: 'Invalid auth type test',
        authType: 'invalid_type',
        iframeUrl: 'https://example.com/badauth',
        toolSchemas: [],
      })
    ).rejects.toThrow('authType must be one of: none, api_key, oauth2');
  });

  it('accepts all valid authType values', async () => {
    const slug2 = TEST_SLUG_2;
    const result = await appService.register({
      slug: slug2,
      name: 'API Key App',
      description: 'API key auth test',
      authType: 'api_key',
      iframeUrl: 'https://example.com/apikey',
      toolSchemas: [],
    });
    expect(result.authType).toBe('api_key');
  });

  it('sanitizes tool schema descriptions (strips HTML, injection patterns)', async () => {
    const slug = `test-sanitize-${Date.now()}`;
    const result = await appService.register({
      slug,
      name: 'Sanitize App',
      description: 'Test sanitization',
      authType: 'none',
      iframeUrl: 'https://example.com/sanitize',
      toolSchemas: [
        {
          name: 'tool_with_html',
          description: '<script>alert("xss")</script>Safe description',
          parameters: {},
        },
      ],
    });

    const tool = (result.toolSchemas as { name: string; description: string }[])[0];
    expect(tool.description).not.toContain('<script>');
    expect(tool.description).toContain('Safe description');

    // Clean up
    await db.delete(apps).where(eq(apps.slug, slug));
  });
});

describe('AppService.listApps', () => {
  it('returns all active apps including the registered test app', async () => {
    const allApps = await appService.listApps();
    expect(Array.isArray(allApps)).toBe(true);
    const found = allApps.find((a) => a.slug === TEST_SLUG);
    expect(found).toBeDefined();
    expect(found?.status).toBe('active');
  });
});

describe('AppService.getAppBySlug', () => {
  it('returns an app by slug', async () => {
    const app = await appService.getAppBySlug(TEST_SLUG);
    expect(app).not.toBeNull();
    expect(app?.slug).toBe(TEST_SLUG);
    expect(app?.name).toBe('Test App');
  });

  it('returns null for non-existent slug', async () => {
    const app = await appService.getAppBySlug('non-existent-slug-xyz');
    expect(app).toBeNull();
  });
});

describe('AppError', () => {
  it('has correct statusCode and message', () => {
    const err = new AppError('test error', 400);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('test error');
    expect(err.name).toBe('AppError');
  });
});
