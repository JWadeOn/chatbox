import { and, eq } from 'drizzle-orm';
import {
  APP_APPROVAL_APPROVED,
  APP_APPROVAL_DISABLED,
  APP_APPROVAL_PENDING,
  type AppApprovalStatus,
  isAppApprovalStatus,
} from '../lib/app-approval';
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
  approvalStatus: AppApprovalStatus;
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
    if (!VALID_AUTH_TYPES.includes(params.authType)) {
      throw new AppError('authType must be one of: none, api_key, oauth2', 400);
    }

    for (const tool of params.toolSchemas) {
      if (!tool.name || tool.name.trim() === '') {
        throw new AppError('Each tool schema must have a name', 400);
      }
      if (!tool.description || tool.description.trim() === '') {
        throw new AppError('Each tool schema must have a description', 400);
      }
    }

    const existing = await db.select().from(apps).where(eq(apps.slug, params.slug)).limit(1);
    if (existing.length > 0) {
      throw new AppError('slug already exists', 400);
    }

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
        status: 'inactive',
        approvalStatus: APP_APPROVAL_PENDING,
      })
      .returning();

    return this.toAppResponse(app);
  }

  /** Student-facing and LLM tool discovery: approved apps only. */
  async listApps(): Promise<AppResponse[]> {
    const rows = await db.select().from(apps).where(eq(apps.approvalStatus, APP_APPROVAL_APPROVED));
    return rows.map((row) => this.toAppResponse(row));
  }

  /** Operators review queue. */
  async listPendingApps(): Promise<AppResponse[]> {
    const rows = await db.select().from(apps).where(eq(apps.approvalStatus, APP_APPROVAL_PENDING));
    return rows.map((row) => this.toAppResponse(row));
  }

  /** Public GET by slug — only if approved for student use. */
  async getAppBySlug(slug: string): Promise<AppResponse | null> {
    const [app] = await db
      .select()
      .from(apps)
      .where(and(eq(apps.slug, slug), eq(apps.approvalStatus, APP_APPROVAL_APPROVED)))
      .limit(1);
    if (!app) {
      return null;
    }
    return this.toAppResponse(app);
  }

  /** Operator/admin lookup regardless of approval (e.g. review UI). */
  async getAppBySlugAny(slug: string): Promise<AppResponse | null> {
    const [app] = await db.select().from(apps).where(eq(apps.slug, slug)).limit(1);
    if (!app) {
      return null;
    }
    return this.toAppResponse(app);
  }

  async setApprovalStatus(slug: string, next: AppApprovalStatus): Promise<AppResponse> {
    const existing = await this.getAppBySlugAny(slug);
    if (!existing) {
      throw new AppError('App not found', 404);
    }

    const statusLegacy = next === APP_APPROVAL_APPROVED ? 'active' : 'inactive';

    const [updated] = await db
      .update(apps)
      .set({
        approvalStatus: next,
        status: statusLegacy,
        updatedAt: new Date(),
      })
      .where(eq(apps.slug, slug))
      .returning();

    return this.toAppResponse(updated);
  }

  private toAppResponse(app: typeof apps.$inferSelect): AppResponse {
    const approval = app.approvalStatus;
    const approvalStatus: AppApprovalStatus = isAppApprovalStatus(approval) ? approval : APP_APPROVAL_PENDING;

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
      approvalStatus,
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
