/**
 * Sliding-window rate limiter for tool invocations.
 * Enforces max invocations per user within a time window.
 *
 * In-memory for single-instance deployments.
 * Swap to Redis for horizontal scaling.
 */

interface WindowEntry {
  timestamps: number[];
}

const DEFAULT_MAX_INVOCATIONS = 10;
const DEFAULT_WINDOW_MS = 60_000; // 1 minute

export class RateLimiter {
  private windows = new Map<string, WindowEntry>();
  private readonly maxInvocations: number;
  private readonly windowMs: number;

  constructor(maxInvocations = DEFAULT_MAX_INVOCATIONS, windowMs = DEFAULT_WINDOW_MS) {
    this.maxInvocations = maxInvocations;
    this.windowMs = windowMs;
  }

  /**
   * Check if a user can make another tool invocation.
   * Returns { allowed: true } or { allowed: false, retryAfterMs }.
   */
  check(userId: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const now = Date.now();
    const entry = this.windows.get(userId);

    if (!entry) {
      return { allowed: true };
    }

    // Remove expired timestamps
    const cutoff = now - this.windowMs;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    if (entry.timestamps.length >= this.maxInvocations) {
      const oldestInWindow = entry.timestamps[0];
      const retryAfterMs = oldestInWindow + this.windowMs - now;
      return { allowed: false, retryAfterMs };
    }

    return { allowed: true };
  }

  /** Record a tool invocation for a user. Call after check() returns allowed. */
  record(userId: string): void {
    const now = Date.now();
    let entry = this.windows.get(userId);

    if (!entry) {
      entry = { timestamps: [] };
      this.windows.set(userId, entry);
    }

    entry.timestamps.push(now);
  }

  /** Clean up stale entries. Call periodically to prevent memory leaks. */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    for (const [userId, entry] of this.windows) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) {
        this.windows.delete(userId);
      }
    }
  }
}

/** Shared rate limiter instance for tool invocations (10/min/user). */
export const toolRateLimiter = new RateLimiter();

// Clean up stale entries every 5 minutes
setInterval(() => toolRateLimiter.cleanup(), 5 * 60_000).unref();
