import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { apps } from '../lib/schema';

export type DiscoveredTool = {
  appId: string;
  appSlug: string;
  toolName: string;
  namespacedName: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type OpenAIFunctionDef = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const TOOL_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

export class ToolService {
  private cachedTools: DiscoveredTool[] | null = null;
  private cacheExpiry = 0;

  async discoverTools(): Promise<DiscoveredTool[]> {
    if (this.cachedTools && Date.now() < this.cacheExpiry) {
      return this.cachedTools;
    }

    const activeApps = await db.select().from(apps).where(eq(apps.status, 'active'));

    const tools: DiscoveredTool[] = [];

    for (const app of activeApps) {
      const schemas = (app.toolSchemas ?? []) as ToolSchema[];
      for (const schema of schemas) {
        tools.push({
          appId: app.id,
          appSlug: app.slug,
          toolName: schema.name,
          namespacedName: `${app.slug}__${schema.name}`,
          description: schema.description,
          parameters: schema.parameters,
        });
      }
    }

    this.cachedTools = tools;
    this.cacheExpiry = Date.now() + TOOL_CACHE_TTL_MS;
    return tools;
  }

  /** Invalidate the tool cache (call after app registration/update). */
  invalidateCache(): void {
    this.cachedTools = null;
    this.cacheExpiry = 0;
  }

  formatForLLM(tools: DiscoveredTool[]): OpenAIFunctionDef[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.namespacedName,
        description: tool.description,
        parameters: this.normalizeParameters(tool.parameters),
      },
    }));
  }

  /** Ensure parameters conform to JSON Schema with type: "object" */
  private normalizeParameters(params: Record<string, unknown>): Record<string, unknown> {
    // Empty params
    if (!params || Object.keys(params).length === 0) {
      return { type: 'object', properties: {} };
    }

    // Already valid JSON Schema with type: "object" and properties
    if (params.type === 'object' && params.properties) {
      // Strip any `required: true` from individual properties (invalid JSON Schema)
      const props = params.properties as Record<string, Record<string, unknown>>;
      const cleanProps: Record<string, Record<string, unknown>> = {};
      const requiredFields: string[] = (params.required as string[]) || [];

      for (const [key, val] of Object.entries(props)) {
        const { required: _req, ...rest } = val;
        cleanProps[key] = rest;
        if (_req === true && !requiredFields.includes(key)) {
          requiredFields.push(key);
        }
      }

      return {
        type: 'object',
        properties: cleanProps,
        ...(requiredFields.length > 0 ? { required: requiredFields } : {}),
      };
    }

    // Flat properties without wrapper — wrap them and extract required
    const cleanProps: Record<string, Record<string, unknown>> = {};
    const requiredFields: string[] = [];

    for (const [key, val] of Object.entries(params)) {
      if (typeof val === 'object' && val !== null) {
        const propVal = val as Record<string, unknown>;
        const { required: _req, ...rest } = propVal;
        cleanProps[key] = rest;
        if (_req === true) {
          requiredFields.push(key);
        }
      } else {
        cleanProps[key] = { type: 'string' };
      }
    }

    return {
      type: 'object',
      properties: cleanProps,
      ...(requiredFields.length > 0 ? { required: requiredFields } : {}),
    };
  }
}

export const toolService = new ToolService();
