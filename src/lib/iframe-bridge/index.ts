/**
 * Shared iframe bridge contracts used by the Next (secondary) shell and the Chatbox (canonical) shell.
 * Chatbox resolves `@chatbridge/iframe-bridge` via electron-vite alias to this folder.
 */
export {
  IFRAME_LOAD_TIMEOUT_MS,
  INVOCATION_ID_UUID_RE,
  iframeSandboxAttribute,
  isInternalAppIframe,
  isValidToolInvocationId,
} from './constants';
export { buildIframeSrcWithSession } from './iframe-url';
export { getListenerExpectedOrigin, getPostMessageTargetForToolInvoke } from './postmessage-targets';
