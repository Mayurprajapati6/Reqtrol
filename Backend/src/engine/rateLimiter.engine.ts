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
  const windowKey  = `rt:fw:global:${endpoint}`;
  const secKey     = `rt:sec:${endpoint}`;
  const now        = Date.now();

  // Clock-aligned window boundary (top of minute for 1-minute windows)
  const windowStartMs = Math.floor(now / (windowSec * 1000)) * (windowSec * 1000);
  const windowEndMs   = windowStartMs + (windowSec * 1000);
  const resetIn       = Math.max(1, Math.ceil((windowEndMs - now) / 1000));

  const pipeline = redis.pipeline();
  pipeline.incr(windowKey);
  pipeline.ttl(windowKey);
  // Track per-second hit for rolling req/sec calculation (12s TTL)
  pipeline.zadd(secKey, now, `${now}-${Math.random().toString(36).slice(2)}`);
  pipeline.expire(secKey, 12);
  const results = await pipeline.exec();

  const count = (results?.[0]?.[1] as number) ?? 1;
  const ttl   = (results?.[1]?.[1] as number) ?? -1;

  // Set expiry aligned to clock boundary on first request or stale key
  if (count === 1 || ttl === -1 || ttl === -2) {
    await redis.expire(windowKey, resetIn);
  }

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
export async function slidingWindow(
  userId: string,
  endpoint: string,
  cfg: LimitConfig
): Promise<LimiterResult> {
  const redis       = getRedis();
  const now         = Date.now();
  const windowStart = now - cfg.windowMs;
  const windowKey   = `rt:sw:global:${endpoint}`;
  const windowSec   = Math.floor(cfg.windowMs / 1000);

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(windowKey, '-inf', windowStart); // evict old entries
  pipeline.zcard(windowKey);                                  // count in window
  pipeline.zadd(windowKey, now, `${now}-${Math.random()}`);  // add this request
  pipeline.expire(windowKey, windowSec * 2);                 // keep key alive
  const results = await pipeline.exec();

  const countBeforeAdd = (results?.[1]?.[1] as number) ?? 0;
  const allowed        = countBeforeAdd < cfg.max;

  // If over limit, remove the entry we just added
  if (!allowed) {
    await redis.zpopmax(windowKey);
  }

  // Calculate resetIn from oldest surviving entry
  const oldest = await redis.zrange(windowKey, 0, 0, 'WITHSCORES');
  let resetIn  = windowSec;
  if (oldest.length >= 2) {
    const oldestScore = Number(oldest[1]);
    resetIn = Math.max(0, Math.ceil((oldestScore + cfg.windowMs - now) / 1000));
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
  const keys  = await redis.keys('rt:*');
  if (keys.length === 0) return 0;
  await redis.del(...keys);
  return keys.length;
}
