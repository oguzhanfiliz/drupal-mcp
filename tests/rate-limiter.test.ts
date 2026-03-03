import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../src/security/rate-limiter.js';

describe('RateLimiter', () => {
  it('should allow requests within limit', () => {
    const limiter = new RateLimiter(5);
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('test').allowed).toBe(true);
    }
  });

  it('should deny requests exceeding limit', () => {
    const limiter = new RateLimiter(3);
    limiter.check('test');
    limiter.check('test');
    limiter.check('test');
    const result = limiter.check('test');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('should track different keys separately', () => {
    const limiter = new RateLimiter(1);
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('b').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('b').allowed).toBe(false);
  });

  it('should reset properly', () => {
    const limiter = new RateLimiter(1);
    limiter.check('test');
    expect(limiter.check('test').allowed).toBe(false);
    limiter.reset('test');
    expect(limiter.check('test').allowed).toBe(true);
  });
});
