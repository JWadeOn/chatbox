export class CircuitBreaker {
  private failures = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private openedAt = 0;

  private readonly failureThreshold: number;
  private readonly openDurationMs: number;

  constructor(failureThreshold = 3, openDurationMs = 30_000) {
    this.failureThreshold = failureThreshold;
    this.openDurationMs = openDurationMs;
  }

  isOpen(): boolean {
    if (this.state === 'closed') return false;

    if (this.state === 'open') {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.openDurationMs) {
        this.state = 'half-open';
        return false;
      }
      return true;
    }

    // half-open: allow a single request through
    return false;
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.openedAt = Date.now();
    }
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.openedAt = 0;
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
}
