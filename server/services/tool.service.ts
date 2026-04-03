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

export class ToolService {
  async discoverTools(): Promise<DiscoveredTool[]> {
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

    return tools;
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
    // Already valid JSON Schema
    if (params.type === 'object') return params;

    // Empty params
    if (!params || Object.keys(params).length === 0) {
      return { type: 'object', properties: {} };
    }

    // Flat properties without wrapper — wrap them
    return { type: 'object', properties: params };
  }
}

export const toolService = new ToolService();
