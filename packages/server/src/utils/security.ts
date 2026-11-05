export class SimpleRateLimiter {
  private requests = new Map<string, number[]>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      this.requests.set(key, validTimestamps);
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter(t => now - t < this.windowMs);
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, valid);
      }
    }
  }

  reset(): void {
    this.requests.clear();
  }
}

/**
 * Sanitizes user display name: removes HTML tags, trims, enforces 1-16 chars.
 */
export function sanitizePlayerName(name: string): string {
  if (!name) return 'Player';
  const stripped = name.replace(/[<>'"&/\\;`]/g, '').trim();
  const truncated = stripped.slice(0, 16).trim();
  return truncated.length > 0 ? truncated : 'Player';
}
