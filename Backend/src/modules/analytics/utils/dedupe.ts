import { createHash, randomUUID } from 'crypto';
import type { CanonicalEndpoint } from '../types/analytics.types';

const BUCKET_MS = 1;
const TTL_MS = 5_000;
const MAX_ENTRIES = 10_000;
const seen = new Map<string, number>();
let lastBucket = 0;

export function timestampBucket(date?: Date): number {
  if (date) return Math.floor(date.getTime() / BUCKET_MS);

  const bucket = Math.floor(Date.now() / BUCKET_MS);
  lastBucket = bucket <= lastBucket ? lastBucket + 1 : bucket;
  return lastBucket;
}

/**
 * Returns a per-request stable bucket stored on the Express req object.
 * This ensures that reqtrolRateLimiter applied multiple times to the same
 * HTTP request (app-level + route-level) always produces the same fingerprint
 * so shouldTrackOnce() deduplicates the extras correctly.
 */
export function getRequestBucket(req: { _reqtrolBucket?: number }): number {
  if (!req._reqtrolBucket) req._reqtrolBucket = timestampBucket(new Date());
  return req._reqtrolBucket;
}

export function createRequestFingerprint(
  method: string,
  endpoint: CanonicalEndpoint,
  userId: string,
  bucket = timestampBucket(),
): string {
  return `${method.toUpperCase()}:${endpoint}:${userId}:${bucket}`;
}

export function createAnalyticsId(fingerprint: string): string {
  return createHash('sha256').update(fingerprint).digest('hex').slice(0, 32);
}

export function fallbackAnalyticsId(): string {
  return randomUUID();
}

export function shouldTrackOnce(fingerprint: string, now = Date.now()): boolean {
  for (const [key, expiresAt] of seen) {
    if (expiresAt <= now || seen.size > MAX_ENTRIES) seen.delete(key);
  }

  if (seen.has(fingerprint)) return false;
  seen.set(fingerprint, now + TTL_MS);
  return true;
}
