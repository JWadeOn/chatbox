export const TIMEOUTS = {
  IFRAME_LOAD: 10_000,
  TOOL_INVOCATION: 15_000,
  OAUTH_REDIRECT: 60_000,
  WS_HEARTBEAT: 30_000,
  APP_INACTIVITY: 60_000,
} as const;

export function buildRecoveryPrompt(toolName: string, appName: string, error: string): string {
  return `The tool "${toolName}" from app "${appName}" failed with: ${error}. Inform the user about the issue and offer alternatives (retry, skip, or use a different approach).`;
}

export function buildTimeoutPrompt(toolName: string, appName: string): string {
  return `The tool "${toolName}" from app "${appName}" timed out after ${TIMEOUTS.TOOL_INVOCATION / 1000} seconds. Inform the user and offer to try again.`;
}

export function buildCircuitOpenPrompt(appName: string): string {
  return `The app "${appName}" is temporarily unavailable due to repeated failures. Inform the user and suggest trying again later.`;
}

export function buildIframeErrorPrompt(appName: string): string {
  return `The app "${appName}" failed to load within ${TIMEOUTS.IFRAME_LOAD / 1000} seconds. Inform the user and offer to try again.`;
}
