/**
 * Build iframe `src` with session binding. Preserves existing query strings on `iframeUrl`.
 */
export function buildIframeSrcWithSession(iframeUrl: string, sessionId: string, windowOrigin: string): string {
  const absolute = iframeUrl.startsWith('/') ? `${windowOrigin}${iframeUrl}` : iframeUrl;
  const sep = absolute.includes('?') ? '&' : '?';
  return `${absolute}${sep}sessionId=${encodeURIComponent(sessionId)}`;
}
