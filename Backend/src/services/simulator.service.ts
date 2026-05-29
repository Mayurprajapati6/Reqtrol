
import { fixedWindow, slidingWindow, resolveConfig } from '../engine/rateLimiter.engine';
import { RequestLogRepository } from '../repositories/requestLog.repository';
import logger from '../config/logger';
import { getLimiterMetadata } from '../modules/analytics/config/limiterRegistry';
import { normalizeEndpoint } from '../modules/analytics/utils/normalizeEndpoint';
import { createAnalyticsId, createRequestFingerprint, timestampBucket } from '../modules/analytics/utils/dedupe';

export type SimulateInput = {
  userId:   string;
  endpoint: string;
  count:    number;   // 1–100
  delayMs:  number;   // 0–5000
};

export type SimulateItem = {
  seq:       number;
  allowed:   boolean;
  remaining: number;
  reason:    string | null;
  latencyMs: number;
};

export type SimulateOutput = {
  total:        number;
  allowed:      number;
  blocked:      number;
  blockRate:    number;
  avgLatencyMs: number;
  endpoint:     string;
  userId:       string;
  algorithm:    string;
  limiterName:  string;
  limit:        number;
  results:      SimulateItem[];
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const SimulatorService = {

  async run(input: SimulateInput): Promise<SimulateOutput> {
    const { userId, count, delayMs } = input;
    const endpoint = normalizeEndpoint(input.endpoint);
    const metadata = getLimiterMetadata(endpoint);

    const results: SimulateItem[] = [];
    let allowedCount  = 0;
    let blockedCount  = 0;
    let totalLatencyMs = 0;
    let lastAlgorithm = 'fixed-window';
    const runStartedAt = Date.now();

    for (let seq = 1; seq <= count; seq++) {
      const start = Date.now();

      // ── Run the algorithm (same engine LimiterService uses) ───────────────
      const { algorithm, resolvedEndpoint, ...cfg } = resolveConfig(endpoint);
      const decision = endpoint === '/payment/webhook'
        ? { allowed: true, count: seq, limit: 0, remaining: 0, resetIn: 0, windowKey: '', algorithm: 'none' }
        : algorithm === 'sliding-window'
          ? await slidingWindow(userId, resolvedEndpoint, cfg)
          : await fixedWindow(userId, resolvedEndpoint, cfg);

      const latencyMs = Date.now() - start;
      lastAlgorithm   = decision.algorithm;
      totalLatencyMs += latencyMs;

      if (decision.allowed) allowedCount++;
      else                   blockedCount++;

      results.push({
        seq,
        allowed:   decision.allowed,
        remaining: decision.remaining,
        reason:    decision.allowed ? null : 'rate_limit_exceeded',
        latencyMs,
      });

      // ── Persist each simulated request to MongoDB via repository ──────────
      const eventTime = new Date(runStartedAt + seq);
      const fingerprint = createRequestFingerprint('SIM', endpoint, userId, timestampBucket(eventTime));
      const analyticsId = createAnalyticsId(fingerprint);

      RequestLogRepository.createSilently({
        requestId:       `sim:${runStartedAt}:${seq}`,
        analyticsId,
        fingerprint,
        trackedAt:       eventTime,
        userId,
        userName:       '',
        avatarUrl:      '',
        endpoint,
        action:         'simulate',
        method:         'SIM',
        ip:             '127.0.0.1',
        allowed:        decision.allowed,
        reason:         decision.allowed ? null : 'rate_limit_exceeded',
        limit:          decision.limit,
        remaining:      decision.remaining,
        resetIn:        decision.resetIn,
        service:        'simulator',
        source:         'simulator',
        algorithm:      decision.algorithm,
        limiterName:    metadata.limiterName,
        limiterLimit:   metadata.limit,
        limiterWindowMs: metadata.windowMs,
        responseTimeMs: latencyMs,
        statusCode:     decision.allowed ? 200 : 429,
        windowKey:      decision.windowKey,
        timestamp:      eventTime,
      });

      if (seq < count && delayMs > 0) {
        await sleep(delayMs);
      }
    }

    const output: SimulateOutput = {
      total:        count,
      allowed:      allowedCount,
      blocked:      blockedCount,
      blockRate:    Math.round((blockedCount / count) * 1000) / 10,
      avgLatencyMs: Math.round(totalLatencyMs / count),
      endpoint,
      userId,
      algorithm:    lastAlgorithm,
      limiterName:  metadata.limiterName,
      limit:        metadata.limit,
      results,
    };

    logger.info(
      `[SimulatorService] userId=${userId} endpoint=${endpoint} ` +
      `total=${count} allowed=${allowedCount} blocked=${blockedCount}`
    );

    return output;
  },
};

export default SimulatorService;
