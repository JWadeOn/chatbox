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
        parameters: tool.parameters,
      },
    }));
  }
}

export const toolService = new ToolService();
