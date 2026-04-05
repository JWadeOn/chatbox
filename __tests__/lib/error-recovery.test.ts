import { describe, expect, it } from 'vitest';
import { CircuitBreaker } from '../../server/lib/circuit-breaker';
import {
  buildCircuitOpenPrompt,
  buildIframeErrorPrompt,
  buildRecoveryPrompt,
  buildTimeoutPrompt,
  TIMEOUTS,
} from '../../server/lib/error-recovery';

describe('TIMEOUTS', () => {
  it('has correct timeout values', () => {
    expect(TIMEOUTS.IFRAME_LOAD).toBe(10_000);
    expect(TIMEOUTS.TOOL_INVOCATION).toBe(15_000);
    expect(TIMEOUTS.OAUTH_REDIRECT).toBe(60_000);
    expect(TIMEOUTS.WS_HEARTBEAT).toBe(30_000);
    expect(TIMEOUTS.APP_INACTIVITY).toBe(60_000);
  });
});

describe('recovery prompts', () => {
  it('buildRecoveryPrompt includes tool, app, and error', () => {
    const prompt = buildRecoveryPrompt('make_move', 'Chess', 'Connection refused');
    expect(prompt).toContain('make_move');
    expect(prompt).toContain('Chess');
    expect(prompt).toContain('Connection refused');
    expect(prompt).toContain('retry');
  });

  it('buildTimeoutPrompt includes tool and app name', () => {
    const prompt = buildTimeoutPrompt('open_topic', 'Khan Academy Companion');
    expect(prompt).toContain('open_topic');
    expect(prompt).toContain('Khan Academy Companion');
    expect(prompt).toContain('timed out');
    expect(prompt).toContain('15');
  });

  it('buildCircuitOpenPrompt includes app name', () => {
    const prompt = buildCircuitOpenPrompt('Chess');
    expect(prompt).toContain('Chess');
    expect(prompt).toContain('temporarily unavailable');
  });

  it('buildIframeErrorPrompt includes app name and timeout', () => {
    const prompt = buildIframeErrorPrompt('Chess');
    expect(prompt).toContain('Chess');
    expect(prompt).toContain('failed to load');
    expect(prompt).toContain('10');
  });
});

describe('CircuitBreaker integration', () => {
  it('starts closed', () => {
    const cb = new CircuitBreaker();
    expect(cb.isOpen()).toBe(false);
  });

  it('opens after 3 consecutive failures', () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false);
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);
  });

  it('resets on success', () => {
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(false);
  });

  it('transitions to half-open after 30s', async () => {
    const cb = new CircuitBreaker(3, 50); // 50ms for testing
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.isOpen()).toBe(true);

    await new Promise((r) => setTimeout(r, 60));
    expect(cb.isOpen()).toBe(false); // half-open allows one attempt
  });

  it('closes on success after half-open', async () => {
    const cb = new CircuitBreaker(3, 50);
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();

    await new Promise((r) => setTimeout(r, 60));
    cb.recordSuccess();
    expect(cb.isOpen()).toBe(false);
  });
});
