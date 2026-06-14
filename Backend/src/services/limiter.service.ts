import {
  fixedWindow,
  slidingWindow,
  resolveConfig,
  LIMIT_CONFIGS,
  type LimiterResult,
} from '../engine/rateLimiter.engine';
import { RequestLogRepository } from '../repositories/requestLog.repository';
import logger from '../config/logger';
import { getLimiterMetadata } from '../modules/analytics/config/limiterRegistry';
import { normalizeEndpoint } from '../modules/analytics/utils/normalizeEndpoint';

export type CheckLimitInput = {
  userId:        string;
  userName:      string;
  avatarUrl:     string;
  endpoint:      string;
  action:        string;
  method:        string;
  ip:            string;
  service:       string;
};

export type CheckLimitOutput = {
  allowed:        boolean;
  reason:         string | null;
  limit:          number;
  remaining:      number;
  resetIn:        number;
  algorithm:      string;
  limiterName:    string;
  responseTimeMs: number;
};

const LimiterService = {


  async checkLimit(input: CheckLimitInput): Promise<CheckLimitOutput> {
    const start = Date.now();
    const endpoint = normalizeEndpoint(input.endpoint);
    const metadata = getLimiterMetadata(endpoint);

    if (endpoint === '/payment/webhook') {
      const responseMs = Date.now() - start;

      RequestLogRepository.createSilently({
        userId: input.userId,
        userName: input.userName,
        avatarUrl: input.avatarUrl,
        endpoint,
        action: input.action,
        method: input.method,
        ip: input.ip,
        allowed: true,
        reason: null,
        limit: 0,
        remaining: 0,
        resetIn: 0,
        service: input.service,
        algorithm: 'none',
        limiterName: metadata.limiterName,
        limiterLimit: 0,
        limiterWindowMs: metadata.windowMs,
        responseTimeMs: responseMs,
        windowKey: '',
        timestamp: new Date(),
      });

      return {
        allowed: true,
        reason: null,
        limit: 0,
        remaining: 0,
        resetIn: 0,
        algorithm: 'none',
        limiterName: metadata.limiterName,
        responseTimeMs: responseMs,
      };
    }

    // ── Step 1: Global traffic check ─────────────────────────────────────────
    const globalCfg    = LIMIT_CONFIGS['global'];
    const globalResult = await fixedWindow('__global__', 'global', globalCfg);

    if (!globalResult.allowed) {
      const responseMs = Date.now() - start;

      RequestLogRepository.createSilently({
        userId:         input.userId,
        userName:       input.userName,
        avatarUrl:      input.avatarUrl,
        endpoint,
        action:         input.action,
        method:         input.method,
        ip:             input.ip,
        allowed:        false,
        reason:         'global_limit_exceeded',
        limit:          globalResult.limit,
        remaining:      0,
        resetIn:        globalResult.resetIn,
        service:        input.service,
        algorithm:      'fixed-window',
        limiterName:    'globalLimiter',
        limiterLimit:   globalResult.limit,
        limiterWindowMs: globalCfg.windowMs,
        responseTimeMs: responseMs,
        windowKey:      globalResult.windowKey,
        timestamp:      new Date(),
      });

      logger.warn(
        `[LimiterService] Global limit hit — userId=${input.userId} endpoint=${input.endpoint}`
      );

      return {
        allowed:        false,
        reason:         'global_limit_exceeded',
        limit:          globalResult.limit,
        remaining:      0,
        resetIn:        globalResult.resetIn,
        algorithm:      'fixed-window',
        limiterName:    'globalLimiter',
        responseTimeMs: responseMs,
      };
    }

    // ── Step 2: Per-user per-endpoint check ──────────────────────────────────
    const result = await LimiterService._runEndpointCheck(input.userId, endpoint);
    const responseMs = Date.now() - start;

    // NOTE: MongoDB logging is intentionally NOT done here.
    // Quby's reqtrolRateLimiter middleware (TrackerService.track) logs every
    // request after the response is sent. Doing it again here would create a
    // duplicate document per request with a different fingerprint (different ms),
    // causing every endpoint to show 2x the actual hit count.


    logger.info(
      `[LimiterService] userId=${input.userId} endpoint=${input.endpoint} ` +
      `allowed=${result.allowed} algo=${result.algorithm} latency=${responseMs}ms`
    );

    return {
      allowed:        result.allowed,
      reason:         result.allowed ? null : 'rate_limit_exceeded',
      limit:          result.limit,
      remaining:      result.remaining,
      resetIn:        result.resetIn,
      algorithm:      result.algorithm,
      limiterName:    metadata.limiterName,
      responseTimeMs: responseMs,
    };
  },

  /** Choose and run the correct algorithm for this endpoint */
  async _runEndpointCheck(userId: string, endpoint: string): Promise<LimiterResult> {
    const { algorithm, resolvedEndpoint, ...cfg } = resolveConfig(endpoint);

    if (algorithm === 'sliding-window') {
      return slidingWindow(userId, resolvedEndpoint, cfg);
    }
    return fixedWindow(userId, resolvedEndpoint, cfg);
  },
};

export default LimiterService;
