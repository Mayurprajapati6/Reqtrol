import { RequestLogRepository, BlockedRepository, LimiterRepository } from '../repositories/requestLog.repository';
import { getRedis } from '../config/redis';
import logger from '../config/logger';
import type { AnalyticsQuery, AnalyticsSource } from '../utils/analytics';
import { protectedLimiterMetadata } from '../modules/analytics/config/limiterRegistry';
import { normalizeEndpoint } from '../modules/analytics/utils/normalizeEndpoint';
import AnalyticsAggregatorService from '../modules/analytics/services/analyticsAggregator.service';

export interface LimitConfig {
  endpoint:    string;
  limiterName: string;
  max:         number;
  windowMs:    number;
  windowLabel: string;
  algorithm:   string;
}

const LIMITS_CONFIG: LimitConfig[] = [
  ...protectedLimiterMetadata.map((meta) => ({
    endpoint: meta.endpoint,
    limiterName: meta.limiterName,
    max: meta.limit,
    windowMs: meta.windowMs,
    windowLabel: meta.windowLabel,
    algorithm: meta.algorithm,
  })),
];

async function getRedisInfo(): Promise<{
  usedMemoryMb: number; totalKeys: number; connectedClients: number;
  opsPerSec: number; hitRatePct: number; evictedKeys: number;
  rejectedConnections: number; version: string; uptime: string;
  connected: boolean;
}> {
  const DEFAULTS = { usedMemoryMb: 0, totalKeys: 0, connectedClients: 0, opsPerSec: 0, hitRatePct: 0, evictedKeys: 0, rejectedConnections: 0, version: 'unknown', uptime: '—', connected: false };
  try {
    const redis = getRedis();
    // Fast connectivity check with 2 s timeout — avoids redis.info() hangs on Render cold start
    const pong = await Promise.race([
      redis.ping(),
      new Promise<null>((_, rej) => setTimeout(() => rej(new Error('Redis ping timeout')), 2000)),
    ]);
    if (pong !== 'PONG') return DEFAULTS;
    const info: string = await redis.info();
    const get = (key: string): string => {
      const match = info.match(new RegExp(`^${key}:(.+)$`, 'm'));
      return match ? match[1].trim() : '0';
    };
    const usedMemoryBytes = parseInt(get('used_memory'), 10);
    const usedMemoryMb    = Math.round((usedMemoryBytes / 1_048_576) * 100) / 100;
    const uptimeSeconds   = parseInt(get('uptime_in_seconds'), 10);
    const days    = Math.floor(uptimeSeconds / 86400);
    const hours   = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const keyspaceHits   = parseInt(get('keyspace_hits'), 10);
    const keyspaceMisses = parseInt(get('keyspace_misses'), 10);
    const totalKeyOps    = keyspaceHits + keyspaceMisses;
    const hitRatePct     = totalKeyOps > 0 ? Math.round((keyspaceHits / totalKeyOps) * 10000) / 100 : 0;
    let totalKeys = 0;
    const dbMatches = info.matchAll(/^db\d+:keys=(\d+)/gm);
    for (const m of dbMatches) totalKeys += parseInt(m[1], 10);
    return {
      usedMemoryMb, totalKeys, hitRatePct, connected: true,
      connectedClients:    parseInt(get('connected_clients'), 10),
      opsPerSec:           parseInt(get('instantaneous_ops_per_sec'), 10),
      evictedKeys:         parseInt(get('evicted_keys'), 10),
      rejectedConnections: parseInt(get('rejected_connections'), 10),
      version:             get('redis_version'),
      uptime:              `${days}d ${hours}h ${minutes}m`,
    };
  } catch (err) {
    logger.error(`[AnalyticsService] Redis info error: ${(err as Error).message}`);
    return DEFAULTS;
  }
}

async function getLimiterKeyStats(): Promise<Array<{ name: string; keys: number }>> {
  try {
    const redis = getRedis();
    const now = Date.now();
    
    // Use single pipeline to batch all EXISTS checks - reduces round trips dramatically
    const pipeline = redis.pipeline();
    
    LIMITS_CONFIG.forEach((cfg) => {
      const algo   = (cfg.algorithm ?? '').toLowerCase();
      const windowMs = cfg.windowMs;
      const bucketStart = Math.floor(now / windowMs) * windowMs;
      
      if (algo.includes('sliding')) {
        pipeline.exists(`rt:sw:global:${cfg.endpoint}`, `rt:sec:${cfg.endpoint}`);
      } else {
        // For fixed window, include clock boundary in key
        pipeline.exists(`rt:fw:global:${cfg.endpoint}:${bucketStart}`, `rt:sec:${cfg.endpoint}`);
      }
    });
    
    const results = await pipeline.exec();
    
    return LIMITS_CONFIG.map((cfg, i) => ({
      name: cfg.limiterName,
      keys: (results?.[i]?.[1] as number) ?? 0,
    }));
  } catch {
    return LIMITS_CONFIG.map(c => ({ name: c.limiterName, keys: 0 }));
  }
}

async function getLiveLimiterWindows(configs: LimitConfig[]): Promise<Map<string, {
  currentHits: number;
  resetAt:     number;
  bucketStart: number;
  bucketEnd:   number;
  reqMin:      number;
  reqSec:      number;
}>> {
  type WindowEntry = { currentHits: number; resetAt: number; bucketStart: number; bucketEnd: number; reqMin: number; reqSec: number };
  const windows = new Map<string, WindowEntry>();
  const now = Date.now();

  // Pre-populate with safe defaults so callers always get an entry per endpoint
  for (const cfg of configs) {
    const windowMs    = cfg.windowMs;
    const bucketStart = Math.floor(now / windowMs) * windowMs;
    const bucketEnd   = bucketStart + windowMs;
    windows.set(cfg.endpoint, { currentHits: 0, resetAt: bucketEnd, bucketStart, bucketEnd, reqMin: 0, reqSec: 0 });
  }

  try {
    const redis = getRedis();

    // ── Read all endpoint counters in a single pipeline (no redis.keys scan) ──
    // Fixed-window  key: rt:fw:global:{endpoint}:{bucketStart}  → GET (includes clock boundary)
    // Sliding-window key: rt:sw:global:{endpoint} → ZCOUNT [bucketStart, now]
    // Per-second key:    rt:sec:{endpoint}         → ZCOUNT [now-10000, now]
    const pipeline = redis.pipeline();

    for (const cfg of configs) {
      const windowMs    = cfg.windowMs;
      const bucketStart = Math.floor(now / windowMs) * windowMs;
      const algo        = (cfg.algorithm ?? '').toLowerCase();

      if (algo.includes('fixed') || algo === 'fw') {
        // Include clock boundary in key to match fixedWindow function
        pipeline.get(`rt:fw:global:${cfg.endpoint}:${bucketStart}`);         // index: 2i
      } else {
        pipeline.zcount(`rt:sw:global:${cfg.endpoint}`, bucketStart, now); // index: 2i
      }
      pipeline.zcount(`rt:sec:${cfg.endpoint}`, now - 10_000, now);        // index: 2i+1
    }

    const results = await pipeline.exec();

    configs.forEach((cfg, i) => {
      const windowMs    = cfg.windowMs;
      const bucketStart = Math.floor(now / windowMs) * windowMs;
      const bucketEnd   = bucketStart + windowMs;
      const current     = windows.get(cfg.endpoint);
      if (!current) return;

      const countRaw  = results?.[i * 2]?.[1];
      const secRaw    = results?.[i * 2 + 1]?.[1];
      const count     = Math.max(0, Number(countRaw ?? 0));
      const secCount  = Math.max(0, Number(secRaw ?? 0));

      current.currentHits = count;
      current.reqMin      = count;
      current.reqSec      = Math.round((secCount / 10) * 10) / 10;
      current.resetAt     = bucketEnd;
      current.bucketStart = bucketStart;
      current.bucketEnd   = bucketEnd;
      windows.set(cfg.endpoint, current);
    });

  } catch (err) {
    logger.error(`[AnalyticsService] Live limiter window read error: ${(err as Error).message}`);
  }

  return windows;
}

const AnalyticsService = {

  async getOverview(query: AnalyticsQuery) {
    const base        = await AnalyticsAggregatorService.getOverview(query);
    const activeUsers = await RequestLogRepository.getActiveUserCount(query);
    const anonPct     = await RequestLogRepository.getAnonTrafficPct(query);
    return { ...base, activeUsers, anonPct };
  },

  async getTimeline(query: AnalyticsQuery) {
    return AnalyticsAggregatorService.getTimeline(query);
  },

  async getSourceTimeline(windowDays: number, source: AnalyticsSource = 'all') {
    return RequestLogRepository.getSourceTimeline(windowDays, source);
  },

  async getHeatmap(windowDays: number, source: AnalyticsSource = 'all') {
    return RequestLogRepository.getHeatmap(windowDays, source);
  },

  async getEndpointHeatmap(source: AnalyticsSource = 'all') {
    return RequestLogRepository.getEndpointHeatmap(source);
  },

  async getEndpoints(query: AnalyticsQuery) {
    const rows = await AnalyticsAggregatorService.getEndpointCharts(query);
    const windowMinutes = query.windowMinutes ?? 24 * 60;
    return rows.map((row) => {
      const blockRate = row.requests > 0 ? Math.round((row.blocked / row.requests) * 1000) / 10 : 0;
      const velocity = Math.round((row.requests / windowMinutes) * 10) / 10;
      const riskScore = Math.min(100, Math.round((blockRate * 0.7) + Math.min(velocity / 10, 30)));
      return {
        id: row.id,
        endpoint: row.endpoint,
        label: row.label,
        requests: row.requests,
        total: row.requests,
        allowed: row.allowed,
        blocked: row.blocked,
        blockRate,
        avgResponseMs: row.latency,
        latency: row.latency,
        p95Latency: row.p95Latency,
        limiterName: row.limiterName,
        saturation: row.saturation,
        health: row.health,
        riskScore,
        requestVelocity: velocity,
        severity: row.health === 'critical' ? 'critical' as const : row.health === 'healthy' ? 'healthy' as const : 'warning' as const,
        trendData: [],
        spikeDetected: false,
      };
    });
  },

  async getUsers(query: AnalyticsQuery, limit: number) {
    return AnalyticsAggregatorService.getUsers(query, limit);
  },

  async getLimiters(query: AnalyticsQuery) {
    const rows = await LimiterRepository.getConfiguredLimiterAggregation(
      LIMITS_CONFIG.map((cfg) => ({
        endpoint: cfg.endpoint,
        limiterName: cfg.limiterName,
        max: cfg.max,
        windowMs: cfg.windowMs,
      })),
      query.source,
    );
    const liveWindows = await getLiveLimiterWindows(LIMITS_CONFIG);

    return rows.map((row) => {
      const live = row.endpoint ? liveWindows.get(row.endpoint) : undefined;
      // BUG FIX: live is always pre-populated with currentHits=0, so `live?.currentHits ?? x`
      // NEVER falls back to x because 0 is not null/undefined. Use explicit > 0 guard so that
      // MongoDB's rolling-window count acts as the true fallback when Redis has no data.
      const liveHits   = live?.currentHits ?? 0;
      const mongoHits  = row.currentHits   ?? 0;
      const currentHits = liveHits > 0 ? liveHits : mongoHits;
      const liveReqMin  = live?.reqMin ?? 0;
      const reqMin      = liveReqMin > 0 ? liveReqMin : mongoHits; // use mongo rolling count when Redis is 0
      const limit = row.limit ?? 0;
      const remaining = Math.max(0, limit - currentHits);
      return {
        limiterName: row.limiterName,
        endpoint: row.endpoint,
        totalHits: row.totalHits,
        blockedHits: row.blockedHits,
        blockRate: row.blockRate,
        avgRemainingPct: limit > 0 ? Math.round((remaining / limit) * 1000) / 10 : 0,
        currentHits,
        limit,
        remaining,
        resetAt:     live?.resetAt     ?? 0,
        bucketStart: live?.bucketStart ?? 0,
        bucketEnd:   live?.bucketEnd   ?? 0,
        reqMin,
        reqSec:      live?.reqSec      ?? 0,
        windowMs: row.windowMs,
        saturation: limit > 0 ? Math.min(100, Math.round((currentHits / limit) * 1000) / 10) : 0,
        health: limit > 0 && currentHits / limit >= 0.9 ? 'critical' : limit > 0 && currentHits / limit >= 0.7 ? 'warning' : 'healthy',
      };
    });
  },

  async getUserSummary(query: AnalyticsQuery) {
    const users        = await RequestLogRepository.getUsers(query, 100);
    const activeCount  = await RequestLogRepository.getActiveUserCount(query);
    const anonPct      = await RequestLogRepository.getAnonTrafficPct(query);
    const suspiciousUsers = users.filter(u => u.severity !== 'healthy').length;
    const avgBlockRate = users.length > 0
      ? Math.round((users.reduce((s, u) => s + u.blockRate, 0) / users.length) * 10) / 10 : 0;
    const highestRisk = users.sort((a, b) => b.riskScore - a.riskScore)[0] ?? null;
    return { users, anonPct, activeCount, suspiciousUsers, avgBlockRate, highestRisk };
  },

  async getRecentBlocked(limit: number, source: AnalyticsSource = 'all') {
    return RequestLogRepository.getRecentBlocked(limit, source);
  },

  async getLiveFeed(limit: number, source: AnalyticsSource = 'all') {
    return RequestLogRepository.getLiveFeed(limit, source);
  },

  async getHistoricalRequests(date: string, page: number, limit: number, source: AnalyticsSource = 'all') {
    return RequestLogRepository.getRequestsForDay(date, page, limit, source);
  },

  getLimitsConfig(): LimitConfig[] {
    return LIMITS_CONFIG;
  },

  async getSnapshot(source: AnalyticsSource = 'all') {
    return AnalyticsAggregatorService.getSnapshot(source);
  },

  async getRedisHealth() {
    try {
    const info            = await getRedisInfo();
    const limiterKeys     = await getLimiterKeyStats();
    const totalLimiterKeys = limiterKeys.reduce((s, l) => s + l.keys, 0);
    const colors: Record<string, string> = {
      loginLimiter: '#3b82f6', registerLimiter: '#10b981', bookingLimiter: '#f59e0b',
      paymentOrderLimiter: '#06b6d4', paymentVerifyLimiter: '#0891b2',
      passwordResetLimiter: '#64748b', apiLimiter: '#8b5cf6', strictLimiter: '#ef4444',
      reviewLimiter: '#a855f7', scanLimiter: '#22d3ee',
    };
    const limiterStorage = limiterKeys.map(l => ({
      name:  l.name,
      color: colors[l.name] ?? '#64748b',
      keys:  l.keys,
      pct:   totalLimiterKeys > 0 ? Math.round((l.keys / totalLimiterKeys) * 100) : 0,
    }));
    const maxMem  = 512;
    const freeMem = Math.max(0, Math.round((maxMem - info.usedMemoryMb) * 100) / 100);
    return {
      overallHealth:       info.connected ? 'Healthy' as const : 'Degraded' as const,
      redisVersion:        info.version,
      uptime:              info.uptime,
      connectedClients:    info.connectedClients,
      usedCpuPct:          0,
      hitRatePct:          info.hitRatePct,
      evictedKeys:         info.evictedKeys,
      rejectedConnections: info.rejectedConnections,
      usedMemoryMb:        info.usedMemoryMb,
      freeMemoryMb:        freeMem,
      maxMemoryMb:         maxMem,
      totalKeys:           info.totalKeys,
      expiringKeys:        totalLimiterKeys,
      persistentKeys:      Math.max(0, info.totalKeys - totalLimiterKeys),
      avgTtlSec:           60,
      commandThroughput:   info.opsPerSec,
      requestWritesSec:    Math.round(info.opsPerSec * 0.66),
      activeLimiterKeys:   totalLimiterKeys,
      limiterStorage,
      services: {
        server:      info.connected ? 'Healthy' as const : 'Error' as const,
        memory:      info.usedMemoryMb > 450 ? 'Degraded' as const : 'Healthy' as const,
        persistence: 'Healthy' as const,
        replication: 'Healthy' as const,
        latency:     'Optimal' as const,
      },
    };
    } catch (err) {
      logger.error(`[AnalyticsService] getRedisHealth error: ${(err as Error).message}`);
      // Always return a valid shape so the dashboard never shows 'unknown'
      return {
        overallHealth: 'Error' as const,
        redisVersion: 'unknown', uptime: '—', connectedClients: 0, usedCpuPct: 0,
        hitRatePct: 0, evictedKeys: 0, rejectedConnections: 0, usedMemoryMb: 0,
        freeMemoryMb: 512, maxMemoryMb: 512, totalKeys: 0, expiringKeys: 0,
        persistentKeys: 0, avgTtlSec: 0, commandThroughput: 0, requestWritesSec: 0,
        activeLimiterKeys: 0, limiterStorage: [],
        services: { server: 'Error' as const, memory: 'Healthy' as const, persistence: 'Healthy' as const, replication: 'Healthy' as const, latency: 'Optimal' as const },
      };
    }
  },
};

export default AnalyticsService;

export const BlockedAnalyticsService = {
  async getBlockedTimeline(query: AnalyticsQuery) {
    return BlockedRepository.getBlockedTimeline(query);
  },
  async getEndpointAbuseHeatmap(windowHours: number, source: AnalyticsSource = 'all') {
    return BlockedRepository.getEndpointAbuseHeatmap(windowHours, source);
  },
  async getBlockedStats(query: AnalyticsQuery) {
    return BlockedRepository.getBlockedStats(query);
  },
  async getRichBlocked(limit: number, source: AnalyticsSource = 'all') {
    return BlockedRepository.getRichBlocked(limit, source);
  },
};

export const analyticsService = AnalyticsService;
