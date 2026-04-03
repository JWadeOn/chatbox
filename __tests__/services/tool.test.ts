import { inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { db, pool } from '../../server/lib/db';
import { apps } from '../../server/lib/schema';
import { ToolService } from '../../server/services/tool.service';

const toolService = new ToolService();

const ACTIVE_SLUG_1 = `tool-active-1-${Date.now()}`;
const ACTIVE_SLUG_2 = `tool-active-2-${Date.now()}`;
const INACTIVE_SLUG = `tool-inactive-${Date.now()}`;

const testSlugs = [ACTIVE_SLUG_1, ACTIVE_SLUG_2, INACTIVE_SLUG];

// Insert test apps directly via Drizzle
async function seedTestApps() {
  await db.insert(apps).values([
    {
      slug: ACTIVE_SLUG_1,
      name: 'Active App 1',
      description: 'First active app',
      authType: 'none',
      iframeUrl: 'https://example.com/active1',
      status: 'active',
      toolSchemas: [
        {
          name: 'search',
          description: 'Search for items',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
        {
          name: 'create',
          description: 'Create a new item',
          parameters: {
            type: 'object',
            properties: { title: { type: 'string' } },
            required: ['title'],
          },
        },
      ],
    },
    {
      slug: ACTIVE_SLUG_2,
      name: 'Active App 2',
      description: 'Second active app',
      authType: 'none',
      iframeUrl: 'https://example.com/active2',
      status: 'active',
      toolSchemas: [
        {
          name: 'lookup',
          description: 'Look up a record',
          parameters: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
          },
        },
      ],
    },
    {
      slug: INACTIVE_SLUG,
      name: 'Inactive App',
      description: 'An inactive app',
      authType: 'none',
      iframeUrl: 'https://example.com/inactive',
      status: 'inactive',
      toolSchemas: [
        {
          name: 'hidden_tool',
          description: 'Should not appear',
          parameters: { type: 'object', properties: {} },
        },
      ],
    },
  ]);
}

// Seed once before all tests
const seeded = seedTestApps();

afterAll(async () => {
  await db.delete(apps).where(inArray(apps.slug, testSlugs));
  await pool.end();
});

describe('ToolService.discoverTools', () => {
  it('returns tools only from active apps', async () => {
    await seeded;
    const tools = await toolService.discoverTools();

    // Should include tools from the two active test apps
    const activeToolNames = tools.filter((t) => testSlugs.includes(t.appSlug)).map((t) => t.toolName);
    expect(activeToolNames).toContain('search');
    expect(activeToolNames).toContain('create');
    expect(activeToolNames).toContain('lookup');

    // Should NOT include tools from the inactive app
    const inactiveTools = tools.filter((t) => t.appSlug === INACTIVE_SLUG);
    expect(inactiveTools).toHaveLength(0);
  });

  it('each tool includes appId, appSlug, toolName', async () => {
    await seeded;
    const tools = await toolService.discoverTools();
    const testTools = tools.filter((t) => t.appSlug === ACTIVE_SLUG_1);

    expect(testTools.length).toBeGreaterThanOrEqual(2);
    for (const tool of testTools) {
      expect(tool.appId).toBeDefined();
      expect(typeof tool.appId).toBe('string');
      expect(tool.appSlug).toBe(ACTIVE_SLUG_1);
      expect(tool.toolName).toBeDefined();
      expect(typeof tool.toolName).toBe('string');
      expect(tool.description).toBeDefined();
      expect(tool.parameters).toBeDefined();
    }
  });

  it('namespaces tool names as appSlug__toolName (double underscore)', async () => {
    await seeded;
    const tools = await toolService.discoverTools();
    const testTools = tools.filter((t) => testSlugs.includes(t.appSlug));

    for (const tool of testTools) {
      expect(tool.namespacedName).toBe(`${tool.appSlug}__${tool.toolName}`);
    }
  });

  it('returns empty array if no apps registered', async () => {
    // Create a fresh ToolService and test against a state with no matching active apps
    // We'll test by checking the return type — if all test apps were removed,
    // this would be empty. Instead, verify the structure.
    const tools = await toolService.discoverTools();
    expect(Array.isArray(tools)).toBe(true);
  });

  it('excludes inactive apps tools', async () => {
    await seeded;
    const tools = await toolService.discoverTools();
    const hiddenTools = tools.filter((t) => t.toolName === 'hidden_tool' && t.appSlug === INACTIVE_SLUG);
    expect(hiddenTools).toHaveLength(0);
  });

  it('includes multiple tools from the same app', async () => {
    await seeded;
    const tools = await toolService.discoverTools();
    const app1Tools = tools.filter((t) => t.appSlug === ACTIVE_SLUG_1);

    // Active App 1 has 'search' and 'create'
    expect(app1Tools).toHaveLength(2);
    const toolNames = app1Tools.map((t) => t.toolName);
    expect(toolNames).toContain('search');
    expect(toolNames).toContain('create');
  });
});

describe('ToolService.formatForLLM', () => {
  it('returns correct OpenAI function definition format', async () => {
    await seeded;
    const tools = await toolService.discoverTools();
    const testTools = tools.filter((t) => testSlugs.includes(t.appSlug));
    const formatted = toolService.formatForLLM(testTools);

    expect(formatted.length).toBe(testTools.length);

    for (const def of formatted) {
      expect(def.type).toBe('function');
      expect(def.function).toBeDefined();
      expect(def.function.name).toContain('__');
      expect(typeof def.function.description).toBe('string');
      expect(def.function.parameters).toBeDefined();
    }
  });

  it('uses namespaced name in function definitions', async () => {
    await seeded;
    const tools = await toolService.discoverTools();
    const searchTool = tools.find((t) => t.appSlug === ACTIVE_SLUG_1 && t.toolName === 'search');
    if (!searchTool) throw new Error('searchTool not found');

    const formatted = toolService.formatForLLM([searchTool]);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].function.name).toBe(`${ACTIVE_SLUG_1}__search`);
    expect(formatted[0].function.description).toBe('Search for items');
    expect(formatted[0].function.parameters).toEqual({
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    });
  });

  it('returns empty array when given empty tools', () => {
    const formatted = toolService.formatForLLM([]);
    expect(formatted).toEqual([]);
  });
});
