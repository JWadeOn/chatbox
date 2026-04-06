/** UUID v4 pattern for tool invocation ids relayed to the server. */
export const INVOCATION_ID_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const IFRAME_LOAD_TIMEOUT_MS = 30_000;

/** Internal first-party apps live under `/apps/*` on the platform origin. */
export function isInternalAppIframe(iframeUrl: string): boolean {
  return iframeUrl.startsWith('/');
}

export function iframeSandboxAttribute(isInternal: boolean): string {
  return isInternal
    ? 'allow-scripts allow-forms allow-popups allow-same-origin'
    : 'allow-scripts allow-forms allow-popups';
}

export function isValidToolInvocationId(invocationId: string): boolean {
  return INVOCATION_ID_UUID_RE.test(invocationId);
}
