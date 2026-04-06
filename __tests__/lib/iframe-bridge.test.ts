import { describe, expect, it } from 'vitest';
import {
  buildIframeSrcWithSession,
  getListenerExpectedOrigin,
  getPostMessageTargetForToolInvoke,
  iframeSandboxAttribute,
  isInternalAppIframe,
  isValidToolInvocationId,
} from '../../src/lib/iframe-bridge';

describe('iframe-bridge', () => {
  it('buildIframeSrcWithSession appends session and preserves query', () => {
    expect(buildIframeSrcWithSession('/apps/chess', 's1', 'http://localhost:3000')).toBe(
      'http://localhost:3000/apps/chess?sessionId=s1'
    );
    expect(buildIframeSrcWithSession('https://x.com/a?x=1', 's-2', 'http://localhost:3000')).toBe(
      'https://x.com/a?x=1&sessionId=s-2'
    );
  });

  it('getListenerExpectedOrigin distinguishes internal vs external', () => {
    expect(getListenerExpectedOrigin(true, 'http://a')).toBe('http://a');
    expect(getListenerExpectedOrigin(false, 'http://a')).toBe('null');
  });

  it('getPostMessageTargetForToolInvoke uses * for external URLs', () => {
    expect(getPostMessageTargetForToolInvoke('/apps/chess', 'http://localhost:3000')).toBe('http://localhost:3000');
    expect(getPostMessageTargetForToolInvoke('https://evil.example/app', 'http://localhost:3000')).toBe('*');
  });

  it('isInternalAppIframe and sandbox attribute', () => {
    expect(isInternalAppIframe('/apps/x')).toBe(true);
    expect(isInternalAppIframe('https://x')).toBe(false);
    expect(iframeSandboxAttribute(true)).toContain('allow-same-origin');
    expect(iframeSandboxAttribute(false)).not.toContain('allow-same-origin');
  });

  it('isValidToolInvocationId', () => {
    expect(isValidToolInvocationId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidToolInvocationId('not-uuid')).toBe(false);
  });
});
