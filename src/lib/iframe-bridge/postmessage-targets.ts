/**
 * Expected `MessageEvent.origin` for the wrapper around `createPostMessageListener`.
 * Internal apps share the platform origin; sandboxed third-party frames report the string `"null"`.
 */
export function getListenerExpectedOrigin(isInternalApp: boolean, windowOrigin: string): string {
  return isInternalApp ? windowOrigin : 'null';
}

/**
 * `postMessage` targetOrigin when sending tool_invoke into the iframe.
 * Internal: platform origin. External opaque sandbox: `*` (matches security model in Next AppRenderer).
 */
export function getPostMessageTargetForToolInvoke(iframeUrl: string, windowOrigin: string): string {
  if (iframeUrl.startsWith('/')) {
    return windowOrigin;
  }
  return '*';
}
