import type { Response } from 'express';
import { getLimiterMetadata } from '../config/limiterRegistry';
import type { CanonicalEndpoint } from '../types/analytics.types';

export interface LimiterHeaderValues {
  limit: number;
  remaining: number;
  resetIn: number;
}

function numericHeader(res: Response, names: string[]): number | undefined {
  for (const name of names) {
    const value = res.getHeader(name);
    const raw = Array.isArray(value) ? value[0] : value;
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return undefined;
}

function combinedRateLimitHeader(res: Response, key: 'limit' | 'remaining' | 'reset'): number | undefined {
  const value = res.getHeader('RateLimit');
  const raw = Array.isArray(value) ? value.join(',') : String(value ?? '');
  const match = raw.match(new RegExp(`${key}=([0-9]+)`, 'i'));
  const parsed = Number(match?.[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function extractLimiterHeaders(res: Response, endpoint: CanonicalEndpoint): LimiterHeaderValues {
  const metadata = getLimiterMetadata(endpoint);
  const limit = numericHeader(res, ['RateLimit-Limit', 'X-RateLimit-Limit'])
    ?? combinedRateLimitHeader(res, 'limit')
    ?? metadata.limit;
  const remaining = numericHeader(res, ['RateLimit-Remaining', 'X-RateLimit-Remaining'])
    ?? combinedRateLimitHeader(res, 'remaining');
  const resetIn = numericHeader(res, ['RateLimit-Reset', 'X-RateLimit-Reset', 'Retry-After'])
    ?? combinedRateLimitHeader(res, 'reset')
    ?? 0;
  const safeLimit = limit > 0 ? limit : metadata.limit;

  return {
    limit: safeLimit,
    remaining: remaining === undefined ? safeLimit : Math.max(0, Math.min(remaining, safeLimit)),
    resetIn,
  };
}
