/**
 * Pure routing rules for the custom HTTP server: when Next handles the request vs Chatbox static SPA.
 * @see server/index.ts
 */

export function isHealthCheckPath(pathname: string): boolean {
  return pathname === '/health';
}

/**
 * When true, the request must be passed to Next's handler (API, app pages, RSC, etc.).
 */
export function shouldDelegateToNext(pathname: string, chatboxAvailable: boolean): boolean {
  if (!chatboxAvailable) {
    return true;
  }
  return pathname.startsWith('/api/') || pathname.startsWith('/apps/') || pathname.startsWith('/_next/');
}
