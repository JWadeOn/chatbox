/**
 * Managed Postgres over the public internet (Render, Railway proxy, etc.) expects TLS.
 * Local Postgres typically does not.
 */

function managedPostgresNeedsTls(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('sslmode=disable') || process.env.DATABASE_SSL === 'false') return false;
  if (process.env.DATABASE_SSL === 'true') return true;
  if (lower.includes('sslmode=require') || lower.includes('sslmode=verify-full')) return true;
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return false;
  if (lower.includes('.render.com') || lower.includes('.rlwy.net')) return true;
  try {
    const host = new URL(url.replace(/^postgresql:/i, 'http:')).hostname;
    if (host.startsWith('dpg-')) return true;
  } catch {
    // ignore
  }
  return false;
}

export function poolSslFromUrl(url: string | undefined): { rejectUnauthorized: boolean } | undefined {
  if (!url || !managedPostgresNeedsTls(url)) return undefined;
  const lower = url.toLowerCase();
  // Railway public proxy TLS chain is not rooted in a public CA Node trusts by default.
  if (lower.includes('.rlwy.net')) {
    return { rejectUnauthorized: false };
  }
  return { rejectUnauthorized: true };
}

/** Drizzle Kit reads `url` only; append sslmode so `pg` negotiates TLS like production. */
export function ensurePgSslQueryString(url: string): string {
  if (!url || !managedPostgresNeedsTls(url)) return url;
  const lower = url.toLowerCase();
  if (lower.includes('sslmode=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}sslmode=require`;
}
