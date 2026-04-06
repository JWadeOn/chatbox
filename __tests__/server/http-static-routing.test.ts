import { describe, expect, it } from 'vitest';
import { isHealthCheckPath, shouldDelegateToNext } from '../../server/lib/http-static-routing';

describe('http-static-routing', () => {
  describe('isHealthCheckPath', () => {
    it('matches /health only', () => {
      expect(isHealthCheckPath('/health')).toBe(true);
      expect(isHealthCheckPath('/health/')).toBe(false);
      expect(isHealthCheckPath('/api/health')).toBe(false);
    });
  });

  describe('shouldDelegateToNext', () => {
    it('delegates everything when Chatbox is not built', () => {
      expect(shouldDelegateToNext('/', false)).toBe(true);
      expect(shouldDelegateToNext('/chat/foo', false)).toBe(true);
      expect(shouldDelegateToNext('/api/x', false)).toBe(true);
    });

    it('delegates API, internal apps, and Next assets when Chatbox is available', () => {
      expect(shouldDelegateToNext('/api/auth/login', true)).toBe(true);
      expect(shouldDelegateToNext('/apps/chess', true)).toBe(true);
      expect(shouldDelegateToNext('/_next/static/chunk.js', true)).toBe(true);
    });

    it('does not delegate shell routes to Next when Chatbox is available', () => {
      expect(shouldDelegateToNext('/', true)).toBe(false);
      expect(shouldDelegateToNext('/session/abc', true)).toBe(false);
      expect(shouldDelegateToNext('/foo/bar', true)).toBe(false);
    });
  });
});
