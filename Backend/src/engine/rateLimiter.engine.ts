/**
 * Rate Limiter Engine
 *
 * Pure Redis algorithms. No MongoDB. No business logic.
 * Called only by LimiterService.
 *
 * Two algorithms:
 *   fixedWindow   → O(1) memory, simple, small boundary-burst risk
 *   slidingWindow → O(n) memory, accurate, no boundary-burst
 */

import { getRedis } from '../config/redis';
import { limiterRegistry } from '../modules/analytics/config/limiterRegistry';
import { normalizeEndpoint } from '../modules/analytics/utils/normalizeEndpoint';

// ─── Types ────────────────────────────────────────────────────────────────────
export type LimiterResult = {
  allowed:   boolean;
  count:     number;
  limit:     number;
  remaining: number;
  resetIn:   number;     // seconds until window resets
  windowKey: string;     // Redis key used
  algorithm: string;
};

export type LimitConfig = {
  max:       number;
  windowMs:  number;
  algorithm?: 'fixed-window' | 'sliding-window';
};

// ─── Limit config table (mirrors Quby's rateLimiter.middleware.ts) ────────────
// ── Quby-connected endpoints (reqtrolMiddleware added to these routes) ───────
// Payment:  src/module/payment/payment.routes.ts    → /order, /verify
// Booking:  src/module/customer/booking/booking.routes.ts → POST /
// Auth:     src/module/auth/auth.routes.ts          → /login, /register, /reset-password
export const LIMIT_CONFIGS: Record<string, LimitConfig> = {
  // ── Auth routes ────────────────────────────────────────────────────────────
  '/auth/login':               { max: limiterRegistry['/auth/login'].limit,           windowMs: limiterRegistry['/auth/login'].windowMs,           algorithm: 'fixed-window'   },
  '/auth/register':            { max: limiterRegistry['/auth/register'].limit,        windowMs: limiterRegistry['/auth/register'].windowMs,        algorithm: 'fixed-window'   },
  '/auth/reset-password':      { max: limiterRegistry['/auth/reset-password'].limit,  windowMs: limiterRegistry['/auth/reset-password'].windowMs,  algorithm: 'fixed-window'   },
  '/auth/forgot-password':     { max: limiterRegistry['/auth/forgot-password'].limit, windowMs: limiterRegistry['/auth/forgot-password'].windowMs, algorithm: 'fixed-window'   },
  // ── Payment routes ─────────────────────────────────────────────────────────
  '/payment/order':            { max: limiterRegistry['/payment/order'].limit,        windowMs: limiterRegistry['/payment/order'].windowMs,        algorithm: 'sliding-window' },
  '/payment/verify':           { max: limiterRegistry['/payment/verify'].limit,       windowMs: limiterRegistry['/payment/verify'].windowMs,       algorithm: 'sliding-window' },
  '/payment/webhook':          { max: limiterRegistry['/payment/webhook'].limit,      windowMs: limiterRegistry['/payment/webhook'].windowMs,      algorithm: 'fixed-window'   },
  // ── Booking routes ─────────────────────────────────────────────────────────
  '/booking/create':           { max: limiterRegistry['/booking/create'].limit,       windowMs: limiterRegistry['/booking/create'].windowMs,       algorithm: 'sliding-window' },
  // ── Global fallback ────────────────────────────────────────────────────────
  'global':                    { max: limiterRegistry['/global'].limit,               windowMs: limiterRegistry['/global'].windowMs,               algorithm: 'fixed-window'  },
  'default':                   { max: limiterRegistry['/unknown'].limit,              windowMs: limiterRegistry['/unknown'].windowMs,              algorithm: 'fixed-window'  },
};

// Human-readable limiter name from resolved endpoint
export function limiterName(endpoint: string): string {
  return limiterRegistry[normalizeEndpoint(endpoint)].limiterName;
}

// ─── Config resolver ──────────────────────────────────────────────────────────
export function resolveConfig(endpoint: string): LimitConfig & { resolvedEndpoint: string } {
  const canonicalEndpoint = normalizeEndpoint(endpoint);
  if (canonicalEndpoint !== '/unknown' && LIMIT_CONFIGS[canonicalEndpoint]) {
    return { ...LIMIT_CONFIGS[canonicalEndpoint], resolvedEndpoint: canonicalEndpoint };
  }
  for (const key of Object.keys(LIMIT_CONFIGS)) {
    if (key !== 'global' && key !== 'default' && endpoint.startsWith(key)) {
      return { ...LIMIT_CONFIGS[key], resolvedEndpoint: key };
    }
  }
  return { ...LIMIT_CONFIGS['default'], resolvedEndpoint: 'default' };
}

// ─── Algorithm 1: Fixed Window ────────────────────────────────────────────────
// Key: rt:fw:global:{endpoint}
// Uses Redis INCR + EXPIRE — atomic, O(1) memory per key
// Global rate limiting: all users share the same window per endpoint
export async function fixedWindow(
  userId: string,
  endpoint: string,
  cfg: LimitConfig
): Promise<LimiterResult> {
  const redis      = getRedis();
  const windowSec  = Math.floor(cfg.windowMs / 1000);
  const now        = Date.now();

  // Clock-aligned window boundary (top of minute for 1-minute windows)
  const windowStartMs = Math.floor(now / (windowSec * 1000)) * (windowSec * 1000);
  const windowEndMs   = windowStartMs + (windowSec * 1000);
  
  // Use UTC seconds calculation to avoid timezone issues
  const currentSecond = Math.floor((now / 1000) % 60);
  const resetIn       = Math.max(1, 60 - currentSecond);

  // Include clock boundary in key to ensure automatic reset at minute boundary
  const windowKey  = `rt:fw:global:${endpoint}:${windowStartMs}`;
  const secKey     = `rt:sec:${endpoint}`;

  // CRITICAL FIX: Only set TTL on first request (when count=1), not on every request
  // Otherwise, TTL keeps getting reset and key never expires
  const count = await redis.incr(windowKey);
  
  if (count === 1) {
    // First request in this window - set the TTL
    await redis.expire(windowKey, windowSec);
  }
  
  // Track per-second hit for rolling req/sec calculation (12s TTL)
  await redis.zadd(secKey, now, `${now}-${Math.random().toString(36).slice(2)}`);
  await redis.expire(secKey, 12);

  const allowed = count <= cfg.max;

  return {
    allowed,
    count,
    limit:     cfg.max,
    remaining: Math.max(0, cfg.max - count),
    resetIn,
    windowKey,
    algorithm: 'fixed-window',
  };
}

// ─── Algorithm 2: Sliding Window ──────────────────────────────────────────────
// Key: rt:sw:global:{endpoint}
// Uses Redis Sorted Set — score = timestamp, no boundary-burst problem
// Slightly more memory: O(n) entries per endpoint
// Global rate limiting: all users share the same window per endpoint
// CLOCK-ALIGNED: Reset time calculated from clock boundary for UX consistency
export async function slidingWindow(
  userId: string,
  endpoint: string,
  cfg: LimitConfig
): Promise<LimiterResult> {
  const redis       = getRedis();
  const now         = Date.now();
  const windowSec   = Math.floor(cfg.windowMs / 1000);

  // CRITICAL FIX: Use clock-aligned buckets like fixed window
  // This ensures automatic reset at minute boundaries
  const bucketStart = Math.floor(now / cfg.windowMs) * cfg.windowMs;
  const bucketEnd   = bucketStart + cfg.windowMs;
  const windowKey   = `rt:sw:global:${endpoint}:${bucketStart}`;  // Include timestamp in key
  const secKey      = `rt:sec:${endpoint}`;

  // Calculate resetIn from clock boundary
  const currentSecond = Math.floor((now / 1000) % 60);
  const resetIn       = Math.max(1, 60 - currentSecond);

  // Debug log for verification
  console.log(`[DEBUG] SlidingWindow ${endpoint}: now=${now}, bucket=${bucketStart}, currentSecond=${currentSecond}, resetIn=${resetIn}s`);

  const pipeline = redis.pipeline();
  // Count current entries in THIS bucket only (entries added in current minute)
  pipeline.zcount(windowKey, bucketStart, now);
  // Add this request with timestamp score
  pipeline.zadd(windowKey, now, `${now}-${Math.random()}`);
  // Set TTL to expire at end of minute
  pipeline.expire(windowKey, windowSec + 10);  // +10s buffer for safety
  // Track per-second hit for rolling req/sec calculation (12s TTL)
  pipeline.zadd(secKey, now, `${now}-${Math.random().toString(36).slice(2)}`);
  pipeline.expire(secKey, 12);
  const results = await pipeline.exec();

  const countBeforeAdd = (results?.[0]?.[1] as number) ?? 0;
  const allowed        = countBeforeAdd < cfg.max;

  // If over limit, remove the entry we just added
  if (!allowed) {
    await redis.zpopmax(windowKey);
  }

  return {
    allowed,
    count:     countBeforeAdd + 1,
    limit:     cfg.max,
    remaining: allowed ? Math.max(0, cfg.max - countBeforeAdd - 1) : 0,
    resetIn,
    windowKey,
    algorithm: 'sliding-window',
  };
}

// ─── Flush all Reqtrol Redis keys ──────────────────────────────────────────
export async function flushAllKeys(): Promise<number> {
  const redis = getRedis();
  // Scan for all rate limiter keys (fixed window with clock boundaries included)
  const keys  = await redis.keys('rt:*');
  if (keys.length === 0) return 0;
  // Delete in batches to avoid blocking Redis
  const batchSize = 100;
  let deleted = 0;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    await redis.del(...batch);
    deleted += batch.length;
  }
  return deleted;
}
