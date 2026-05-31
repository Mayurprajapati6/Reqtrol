import type { NextFunction, Request, Response } from 'express';
import TrackerService from '../../../services/tracker.service';
import { getLimiterMetadata } from '../config/limiterRegistry';
import { createAnalyticsId, createRequestFingerprint, shouldTrackOnce, timestampBucket } from '../utils/dedupe';
import { extractLimiterHeaders } from '../utils/extractLimiterHeaders';
import { normalizeAction, normalizeEndpoint, normalizeSourceValue } from '../utils/normalizeEndpoint';

export interface ReqtrolRateLimiterOptions {
  userId?: (req: Request) => string;
  userName?: (req: Request) => string;
  avatarUrl?: (req: Request) => string;
  endpoint?: (req: Request) => string;
  action?: (req: Request) => string;
  source?: string;
  service?: string;
}

function valueFromRequest(req: Request, key: string): string | undefined {
  const value = req.body?.[key] ?? req.query?.[key] ?? req.params?.[key];
  return typeof value === 'string' ? value : undefined;
}

function inferUserId(req: Request): string {
  const authUser = (req as Request & { user?: { id?: string; userId?: string } }).user;
  return authUser?.id ?? authUser?.userId ?? valueFromRequest(req, 'userId') ?? 'anon';
}

export function reqtrolRateLimiter(options: ReqtrolRateLimiterOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const trackedAt = new Date();
    const rawEndpoint = options.endpoint?.(req) ?? req.originalUrl ?? req.baseUrl ?? '/unknown';
    const endpoint = normalizeEndpoint(rawEndpoint);
    const source = normalizeSourceValue(options.source, options.service ?? 'quby');
    const metadata = getLimiterMetadata(endpoint);
    const userId = options.userId?.(req) ?? inferUserId(req);
    const method = req.method.toUpperCase();
    const fingerprint = createRequestFingerprint(method, endpoint, userId, timestampBucket(trackedAt));
    const analyticsId = createAnalyticsId(fingerprint);
    let tracked = false;

    const trackOnce = async (): Promise<void> => {
      if (tracked || !shouldTrackOnce(fingerprint)) return;
      tracked = true;

      const allowed = res.statusCode < 400;
      const limiterHeaders = extractLimiterHeaders(res, endpoint);

      await TrackerService.track({
        analyticsId,
        fingerprint,
        trackedAt: trackedAt.toISOString(),
        requestId: analyticsId,
        userId,
        userName: options.userName?.(req) ?? valueFromRequest(req, 'userName') ?? '',
        avatarUrl: options.avatarUrl?.(req) ?? valueFromRequest(req, 'avatarUrl') ?? '',
        endpoint,
        action: normalizeAction(endpoint, options.action?.(req)),
        method,
        ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
        userAgent: req.get('user-agent') ?? 'unknown',
        allowed,
        reason: allowed ? null : 'rate_limit_exceeded',
        limit: limiterHeaders.limit,
        remaining: limiterHeaders.remaining,
        resetIn: limiterHeaders.resetIn,
        service: options.service ?? 'quby',
        source,
        algorithm: metadata.algorithm,
        limiterName: metadata.limiterName,
        limiterLimit: metadata.limit,
        limiterWindowMs: metadata.windowMs,
        responseTimeMs: Date.now() - trackedAt.getTime(),
        statusCode: res.statusCode,
      });
    };

    res.once('finish', () => {
      void trackOnce();
    });

    next();
  };
}

export default reqtrolRateLimiter;
