import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { apps } from '../lib/schema';
import { sanitizeToolSchema } from '../lib/schema-sanitizer';

type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  returns?: Record<string, unknown>;
};

export type AppResponse = {
  id: string;
  slug: string;
  name: string;
  description: string;
  authType: string;
  iframeUrl: string;
  oauthConfig: unknown;
  toolSchemas: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const VALID_AUTH_TYPES = ['none', 'api_key', 'oauth2'];

export class AppService {
  async register(params: {
    slug: string;
    name: string;
    description: string;
    authType: string;
    iframeUrl: string;
    toolSchemas: ToolSchema[];
    oauthConfig?: object;
  }): Promise<AppResponse> {
    // Validate authType
    if (!VALID_AUTH_TYPES.includes(params.authType)) {
      throw new AppError('authType must be one of: none, api_key, oauth2', 400);
    }

    // Validate tool schemas
    for (const tool of params.toolSchemas) {
      if (!tool.name || tool.name.trim() === '') {
        throw new AppError('Each tool schema must have a name', 400);
      }
      if (!tool.description || tool.description.trim() === '') {
        throw new AppError('Each tool schema must have a description', 400);
      }
    }

    // Check for duplicate slug
    const existing = await db.select().from(apps).where(eq(apps.slug, params.slug)).limit(1);
    if (existing.length > 0) {
      throw new AppError('slug already exists', 400);
    }

    // Sanitize tool schemas
    const sanitizedSchemas = params.toolSchemas.map(sanitizeToolSchema);

    const [app] = await db
      .insert(apps)
      .values({
        slug: params.slug,
        name: params.name,
        description: params.description,
        authType: params.authType,
        iframeUrl: params.iframeUrl,
        oauthConfig: params.oauthConfig ?? null,
        toolSchemas: sanitizedSchemas,
      })
      .returning();

    return this.toAppResponse(app);
  }

  async listApps(): Promise<AppResponse[]> {
    const rows = await db.select().from(apps).where(eq(apps.status, 'active'));
    return rows.map((row) => this.toAppResponse(row));
  }

  async getAppBySlug(slug: string): Promise<AppResponse | null> {
    const [app] = await db.select().from(apps).where(eq(apps.slug, slug)).limit(1);
    if (!app) {
      return null;
    }
    return this.toAppResponse(app);
  }

  private toAppResponse(app: typeof apps.$inferSelect): AppResponse {
    return {
      id: app.id,
      slug: app.slug,
      name: app.name,
      description: app.description,
      authType: app.authType,
      iframeUrl: app.iframeUrl,
      oauthConfig: app.oauthConfig,
      toolSchemas: app.toolSchemas,
      status: app.status,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    };
  }
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const appService = new AppService();
