export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRpm: number;

  constructor(maxRpm: number) {
    this.maxRpm = maxRpm;
  }

  check(key: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const windowMs = 60_000;
    const cutoff = now - windowMs;

    let timestamps = this.requests.get(key) || [];
    timestamps = timestamps.filter((t) => t > cutoff);

    if (timestamps.length >= this.maxRpm) {
      const oldest = timestamps[0]!;
      const retryAfterMs = oldest + windowMs - now;
      return { allowed: false, retryAfterMs };
    }

    timestamps.push(now);
    this.requests.set(key, timestamps);
    return { allowed: true };
  }

  reset(key?: string): void {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
}
