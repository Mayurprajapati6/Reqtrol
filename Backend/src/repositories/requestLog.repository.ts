import { Document } from 'mongoose';
import RequestLog, { IRequestLog } from '../models/RequestLog.model';
import logger from '../config/logger';
import { getRedis } from '../config/redis';
import {
  type AnalyticsQuery,
  type AnalyticsSource,
  matchFor,
  percentage,
  perSecond,
  mongoISTDateParts,
} from '../utils/analytics';
import { getLimiterMetadata } from '../modules/analytics/config/limiterRegistry';
import {
  normalizeAction,
  normalizeEndpoint,
  normalizeSourceValue,
} from '../modules/analytics/utils/normalizeEndpoint';
import {
  createAnalyticsId,
  createRequestFingerprint,
  shouldTrackOnce,
  timestampBucket,
} from '../modules/analytics/utils/dedupe';

export type CreateLogInput = {
  requestId?:     string;
  analyticsId?:   string;
  fingerprint?:   string;
  trackedAt?:     Date;
  userId:         string;
  userName?:      string;
  avatarUrl?:     string;
  endpoint:       string;
  action:         string;
  method:         string;
  ip:             string;
  userAgent?:     string;
  allowed:        boolean;
  reason:         string | null;
  limit:          number;
  remaining:      number;
  resetIn:        number;
  service:        string;
  source?:        string;
  algorithm:      string;
  limiterName?:   string;
  limiterLimit?:  number;
  limiterWindowMs?: number;
  responseTimeMs: number;
  statusCode?:    number;
  windowKey:      string;
  timestamp:      Date;
};

export type OverviewRow = {
  totalRequests: number; allowedCount: number; blockedCount: number;
  blockRate: number; avgResponseMs: number;
};

export type TimelinePoint = {
  minute: string; allowed: number; blocked: number; total: number;
};

export type SourceTimelinePoint = {
  time: string; quby: number; simulator: number; total: number;
};

export type EndpointRow = {
  endpoint: string; total: number; allowed: number; blocked: number;
  blockRate: number; avgResponseMs: number; riskScore: number; requestVelocity: number;
  severity: 'critical' | 'warning' | 'healthy';
  trendData: number[]; spikeDetected: boolean;
};

export type EndpointHeatmapRow = {
  endpoint: string;
  hour: number;
  count: number;
};

export type UserRow = {
  userId: string; userName: string; avatarUrl: string; source: string; favoriteEndpoint: string;
  total: number; allowed: number; blocked: number;
  blockRate: number; lastSeen: string; riskScore: number;
  requestVelocity: number; severity: 'critical' | 'warning' | 'healthy';
  trendData: number[]; suspiciousEvents: number;
};

export type BlockedEventRow = {
  _id: string; userId: string; endpoint: string; reason: string;
  ip: string; resetIn: number; timestamp: string;
};

export type LiveEventRow = {
  _id: string; userId: string; userName: string; avatarUrl: string;
  endpoint: string; allowed: boolean;
  reason: string | null; ip: string; responseTimeMs: number;
  timestamp: string; method: string; source: string; limiterName: string;
  limit: number; remaining: number; resetIn: number;
};

export type HistoricalRequestPage = {
  rows: LiveEventRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

async function invalidateAnalyticsSnapshots(): Promise<void> {
  try {
    const redis = getRedis();
    const keys = await redis.keys('analytics:snapshot:*');
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Snapshot cache invalidation is best-effort; MongoDB remains the source of truth.
  }
}

export type HeatmapCell = {
  day: number; hour: number; count: number;
};

function calcRiskScore(blockRate: number, velocity: number): number {
  // riskScore = weighted combination, capped at 100
  const blockComponent = blockRate * 0.7;          // 70% weight on block rate
  const velocityFactor = Math.min(velocity / 10, 30); // 30% weight on velocity
  return Math.min(100, Math.round(blockComponent + velocityFactor));
}

function calcSeverity(riskScore: number): 'critical' | 'warning' | 'healthy' {
  if (riskScore >= 60) return 'critical';
  if (riskScore >= 25) return 'warning';
  return 'healthy';
}

const endpointExpression: Record<string, unknown> = {
  $switch: {
    branches: [
      { case: { $in: ['$endpoint', ['/', '/booking', '/booking/', '/booking/create']] }, then: '/booking/create' },
      { case: { $in: ['$endpoint', ['/order', '/payment/order']] }, then: '/payment/order' },
      { case: { $in: ['$endpoint', ['/verify', '/payment/verify']] }, then: '/payment/verify' },
      { case: { $in: ['$endpoint', ['/login', '/auth/login']] }, then: '/auth/login' },
      { case: { $in: ['$endpoint', ['/register', '/auth/register']] }, then: '/auth/register' },
      { case: { $in: ['$endpoint', ['/reset-password', '/auth/reset-password']] }, then: '/auth/reset-password' },
      { case: { $in: ['$endpoint', ['/forgot-password', '/auth/forgot-password']] }, then: '/auth/forgot-password' },
      { case: { $in: ['$endpoint', ['/webhook', '/payment/webhook']] }, then: '/payment/webhook' },
    ],
    default: '$endpoint',
  },
};

export const RequestLogRepository = {

  async create(input: CreateLogInput): Promise<IRequestLog> {
    const endpoint = normalizeEndpoint(input.endpoint);
    const source = normalizeSourceValue(input.source, input.service);
    const metadata = getLimiterMetadata(endpoint);
    const limiterName = input.limiterName?.trim() || metadata.limiterName;
    const action = normalizeAction(endpoint, input.action);
    const limit = input.limit > 0 ? input.limit : metadata.limit;
    const remaining = input.remaining > 0 || !input.allowed ? input.remaining : limit;
    const requestId = input.requestId?.trim() ?? '';
    const trackedAt = input.trackedAt ?? new Date();
    const fingerprint = input.fingerprint?.trim()
      || createRequestFingerprint(input.method, endpoint, input.userId, timestampBucket(trackedAt));
    const analyticsId = input.analyticsId?.trim() || createAnalyticsId(fingerprint);

    if (!shouldTrackOnce(fingerprint)) {
      const existing = await RequestLog.findOne({ fingerprint }).exec();
      if (existing) return existing;
    }

    const event = {
      analyticsId,
      requestId,
      fingerprint,
      trackedAt,
      userId:         input.userId,
      userName:       input.userName        ?? '',
      avatarUrl:      input.avatarUrl       ?? '',
      endpoint,
      action,
      method:         input.method,
      ip:             input.ip,
      userAgent:      input.userAgent       ?? 'unknown',
      allowed:        input.allowed,
      reason:         input.reason,
      limit,
      remaining,
      resetIn:        input.resetIn,
      service:        input.service,
      source,
      algorithm:      input.algorithm,
      limiterName,
      limiterLimit:   input.limiterLimit ?? metadata.limit,
      limiterWindowMs: input.limiterWindowMs ?? metadata.windowMs,
      responseTimeMs: input.responseTimeMs,
      statusCode:     input.statusCode     ?? (input.allowed ? 200 : 429),
      windowKey:      input.windowKey,
      timestamp:      input.timestamp,
    };

    if (requestId) {
      const existing = await RequestLog.findOne({ $or: [{ requestId }, { analyticsId }, { fingerprint }] }).exec();
      if (existing) return existing;
    }

    try {
      const created = await RequestLog.create(event);
      void invalidateAnalyticsSnapshots();
      return created;
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code?: number }).code === 11000
      ) {
        const existing = await RequestLog.findOne({ $or: [{ requestId }, { analyticsId }, { fingerprint }] }).exec();
        if (existing) return existing;
      }
      throw err;
    }
  },

  createSilently(input: CreateLogInput): void {
    this.create(input).catch((err: Error) =>
      logger.error(`[RequestLogRepo] Silent create failed: ${err.message}`)
    );
  },

  async getOverview(query: AnalyticsQuery): Promise<OverviewRow & {
    throughput: number; threatScore: number; errorRate: number; uptime: number;
  }> {
    const match = matchFor(query);

    const [result] = await RequestLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total:   { $sum: 1 },
          allowed: { $sum: { $cond: ['$allowed', 1, 0] } },
          blocked: { $sum: { $cond: ['$allowed', 0, 1] } },
          avgMs:   { $avg: '$responseTimeMs' },
        },
      },
    ]);

    if (!result) {
      return { totalRequests: 0, allowedCount: 0, blockedCount: 0, blockRate: 0, avgResponseMs: 0,
        throughput: 0, threatScore: 0, errorRate: 0, uptime: Math.round((process.uptime() / 3600) * 100) / 100 };
    }

    const blockRate = percentage(result.blocked, result.total);
    const throughput = query.scope === 'window' ? perSecond(result.total, query.windowMinutes) : 0;
    // threatScore: blockRate * log(total+1) normalized to 100
    const threatScore = Math.min(100, Math.round(blockRate * Math.log10(result.total + 1) * 3));
    // errorRate = same as blockRate (blocked = errors from client perspective)
    const errorRate = blockRate;

    return {
      totalRequests: result.total,
      allowedCount:  result.allowed,
      blockedCount:  result.blocked,
      blockRate,
      avgResponseMs: Math.round((result.avgMs ?? 0) * 10) / 10,
      throughput,
      threatScore,
      errorRate,
      uptime: Math.round((process.uptime() / 3600) * 100) / 100, // hours of uptime
    };
  },

  async getTimeline(query: AnalyticsQuery): Promise<TimelinePoint[]> {
    const match = matchFor(query);
    const rows = await RequestLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: mongoISTDateParts(),
          allowed: { $sum: { $cond: ['$allowed', 1, 0] } },
          blocked: { $sum: { $cond: ['$allowed', 0, 1] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.minute': 1 } },
    ]);
    return rows.map((r) => {
      const { hour, minute } = r._id;
      return {
        minute: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        allowed: r.allowed, blocked: r.blocked, total: r.allowed + r.blocked,
      };
    });
  },

  async getSourceTimeline(windowDays: number, source: AnalyticsSource = 'all'): Promise<SourceTimelinePoint[]> {
    const match = matchFor({ scope: 'window', windowMinutes: windowDays * 24 * 60, source });
    const rows = await RequestLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Kolkata' } },
            label: { $dateToString: { format: '%d %b', date: '$timestamp', timezone: 'Asia/Kolkata' } },
          },
          quby: { $sum: { $cond: [{ $eq: ['$source', 'quby'] }, 1, 0] } },
          simulator: { $sum: { $cond: [{ $eq: ['$source', 'simulator'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    return rows.map((r) => ({
      time: r._id.label,
      quby: r.quby,
      simulator: r.simulator,
      total: r.quby + r.simulator,
    }));
  },

  async getHeatmap(windowDays = 7, source: AnalyticsSource = 'all'): Promise<HeatmapCell[]> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const match = { ...matchFor({ scope: 'window', windowMinutes: windowDays * 24 * 60, source }), timestamp: { $gte: since } };
    const rows = await RequestLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: { day: { $dayOfWeek: { date: '$timestamp', timezone: 'Asia/Kolkata' } }, hour: { $hour: { date: '$timestamp', timezone: 'Asia/Kolkata' } } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.day': 1, '_id.hour': 1 } },
    ]);
    return rows.map(r => ({ day: r._id.day - 1, hour: r._id.hour, count: r.count }));
  },

  async getEndpoints(query: AnalyticsQuery): Promise<EndpointRow[]> {
    const match = matchFor(query);
    const windowMinutes = query.windowMinutes ?? 24 * 60;
    const since = query.scope === 'window' && query.windowMinutes
      ? new Date(Date.now() - query.windowMinutes * 60 * 1000)
      : new Date(0);
    const rows = await RequestLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: endpointExpression,
          total:   { $sum: 1 },
          allowed: { $sum: { $cond: ['$allowed', 1, 0] } },
          blocked: { $sum: { $cond: ['$allowed', 0, 1] } },
          avgMs:   { $avg: '$responseTimeMs' },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 20 },
    ]);

    // Get per-5min trend for each endpoint (last 6 buckets = 30min)
    const trendRows = await RequestLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            endpoint: endpointExpression,
            bucket: {
              $floor: {
                $divide: [{ $subtract: ['$timestamp', since] }, 5 * 60 * 1000]
              }
            }
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.endpoint': 1, '_id.bucket': 1 } },
    ]);

    const trendMap: Record<string, number[]> = {};
    for (const row of trendRows) {
      const ep = normalizeEndpoint(row._id.endpoint);
      if (!trendMap[ep]) trendMap[ep] = Array(6).fill(0);
      const idx = Math.min(row._id.bucket, 5);
      trendMap[ep][idx] = row.count;
    }

    return rows.map((r) => {
      const endpoint = normalizeEndpoint(r._id);
      const blockRate = percentage(r.blocked, r.total);
      const velocity = Math.round((r.total / windowMinutes) * 10) / 10;
      const riskScore = calcRiskScore(blockRate, velocity);
      const trend = trendMap[endpoint] ?? Array(6).fill(0);
      const prevBucket = trend[4] ?? 0;
      const currBucket = trend[5] ?? 0;
      const spikeDetected = prevBucket > 0 && currBucket > prevBucket * 1.5;
      return {
        endpoint,
        total:           r.total,
        allowed:         r.allowed,
        blocked:         r.blocked,
        blockRate,
        avgResponseMs:   Math.round((r.avgMs ?? 0) * 10) / 10,
        riskScore,
        requestVelocity: velocity,
        severity:        calcSeverity(riskScore),
        trendData:       trend,
        spikeDetected,
      };
    });
  },

  async getEndpointHeatmap(source: AnalyticsSource = 'all'): Promise<EndpointHeatmapRow[]> {
    const rows = await RequestLog.aggregate([
      { $match: matchFor({ scope: 'global', source }) },
      {
        $group: {
          _id: {
            endpoint: endpointExpression,
            hour: { $hour: { date: '$timestamp', timezone: 'Asia/Kolkata' } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.endpoint': 1, '_id.hour': 1 } },
    ]);
    return rows.map(r => ({
      endpoint: normalizeEndpoint(r._id.endpoint),
      hour: r._id.hour,
      count: r.count,
    }));
  },

  async getUsers(query: AnalyticsQuery, limit: number): Promise<UserRow[]> {
    const match = matchFor(query);
    const windowMinutes = query.windowMinutes ?? 24 * 60;
    const since = query.scope === 'window' && query.windowMinutes
      ? new Date(Date.now() - query.windowMinutes * 60 * 1000)
      : new Date(0);
    const rows = await RequestLog.aggregate([
      { $match: match },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id:      '$userId',
          userName: { $first: '$userName' },
          avatarUrl:{ $first: '$avatarUrl' },
          source:   { $first: '$source' },
          endpoints:{ $push: endpointExpression },
          total:    { $sum: 1 },
          allowed:  { $sum: { $cond: ['$allowed', 1, 0] } },
          blocked:  { $sum: { $cond: ['$allowed', 0, 1] } },
          lastSeen: { $max: '$timestamp' },
        },
      },
      { $sort: { total: -1 } },
      { $limit: limit },
    ]);

    const trendRows = await RequestLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            userId: '$userId',
            bucket: { $floor: { $divide: [{ $subtract: ['$timestamp', since] }, 5 * 60 * 1000] } }
          },
          count: { $sum: 1 },
        },
      },
    ]);
    const trendMap: Record<string, number[]> = {};
    for (const row of trendRows) {
      const uid = row._id.userId;
      if (!trendMap[uid]) trendMap[uid] = Array(6).fill(0);
      const idx = Math.min(row._id.bucket, 5);
      trendMap[uid][idx] = row.count;
    }

    return rows.map((r) => {
      const blockRate = percentage(r.blocked, r.total);
      const velocity = Math.round((r.total / windowMinutes) * 10) / 10;
      const riskScore = calcRiskScore(blockRate, velocity);
      const endpointFreq: Record<string, number> = {};
      for (const endpoint of r.endpoints ?? []) {
        const canonical = normalizeEndpoint(endpoint);
        endpointFreq[canonical] = (endpointFreq[canonical] ?? 0) + 1;
      }
      const favoriteEndpoint = Object.entries(endpointFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
      return {
        userId:          r._id,
        userName:        r.userName ?? '',
        avatarUrl:       r.avatarUrl ?? '',
        source:          r.source ?? 'quby',
        favoriteEndpoint,
        total:           r.total,
        allowed:         r.allowed,
        blocked:         r.blocked,
        blockRate,
        lastSeen:        (r.lastSeen as Date).toISOString(),
        riskScore,
        requestVelocity: velocity,
        severity:        calcSeverity(riskScore),
        trendData:       trendMap[r._id] ?? Array(6).fill(0),
        suspiciousEvents: r.blocked,
      };
    });
  },

  async getRecentBlocked(limit: number, source: AnalyticsSource = 'all'): Promise<BlockedEventRow[]> {
    const docs = await RequestLog.find({ allowed: false, ...matchFor({ scope: 'global', source }) })
      .sort({ timestamp: -1 }).limit(limit).lean();
    return docs.map((d) => ({
      _id: String(d._id), userId: d.userId, userName: d.userName ?? '', avatarUrl: d.avatarUrl ?? '', endpoint: normalizeEndpoint(d.endpoint),
      reason: d.reason ?? 'rate_limit_exceeded', ip: d.ip,
      resetIn: d.resetIn, timestamp: d.timestamp.toISOString(),
    }));
  },

  async getLiveFeed(limit: number, source: AnalyticsSource = 'all'): Promise<LiveEventRow[]> {
    const docs = await RequestLog.find(matchFor({ scope: 'global', source }))
      .sort({ timestamp: -1 }).limit(limit).lean();
    return docs.map((d) => ({
      _id: String(d._id), userId: d.userId, userName: d.userName ?? '', avatarUrl: d.avatarUrl ?? '', endpoint: normalizeEndpoint(d.endpoint),
      allowed: d.allowed, reason: d.reason, ip: d.ip,
      responseTimeMs: d.responseTimeMs,
      timestamp: d.timestamp.toISOString(),
      method: d.method ?? 'POST',
      source: d.source ?? d.service ?? 'quby',
      limiterName: d.limiterName || getLimiterMetadata(normalizeEndpoint(d.endpoint)).limiterName,
      limit: d.limit ?? 0,
      remaining: d.remaining ?? 0,
      resetIn: d.resetIn ?? 0,
    }));
  },

  async getRequestsForDay(date: string, page: number, limit: number, source: AnalyticsSource = 'all'): Promise<HistoricalRequestPage> {
    const start = new Date(`${date}T00:00:00+05:30`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const match = {
      ...matchFor({ scope: 'global', source }),
      timestamp: { $gte: start, $lt: end },
    };
    const skip = (page - 1) * limit;
    const [total, docs] = await Promise.all([
      RequestLog.countDocuments(match),
      RequestLog.find(match).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    ]);
    return {
      rows: docs.map((d) => ({
        _id: String(d._id), userId: d.userId, userName: d.userName ?? '', avatarUrl: d.avatarUrl ?? '', endpoint: normalizeEndpoint(d.endpoint),
        allowed: d.allowed, reason: d.reason, ip: d.ip,
        responseTimeMs: d.responseTimeMs,
        timestamp: d.timestamp.toISOString(),
        method: d.method ?? 'POST',
        source: normalizeSourceValue(d.source, d.service),
        limiterName: d.limiterName || getLimiterMetadata(normalizeEndpoint(d.endpoint)).limiterName,
        limit: d.limit ?? 0,
        remaining: d.remaining ?? 0,
        resetIn: d.resetIn ?? 0,
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },

  async getActiveUserCount(query: AnalyticsQuery): Promise<number> {
    const ids = await RequestLog.distinct('userId', matchFor(query));
    return ids.length;
  },

  async getAnonTrafficPct(query: AnalyticsQuery): Promise<number> {
    const [result] = await RequestLog.aggregate([
      { $match: matchFor(query) },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          anon: { $sum: { $cond: [{ $eq: ['$userId', 'anon'] }, 1, 0] } },
        },
      },
    ]);
    if (!result || result.total === 0) return 0;
    return percentage(result.anon, result.total);
  },
};

// ─── IST offset = UTC+5:30 = 330 minutes ─────────────────────────────────────
export type BlockedTimelinePoint = {
  time: string;   // IST HH:MM
  blocked: number;
  dominantEndpoint: string;
};

export type EndpointHeatmapCell = {
  endpoint: string;
  hour: number;   // IST hour 0-23
  blocked: number;
};

export type BlockedStats = {
  totalBlocked: number;
  criticalEndpoints: number;
  uniqueAttackers: number;
  avgRetryWindow: number;
  highestAttackRoute: string;
  highestAttackRouteCount: number;
  totalSpikes: number;
  maxBlockedPerMin: number;
  affectedEndpoints: number;
  anonBlocked: number;
  anonBlockedPct: number;
};

export type RichBlockedEvent = {
  _id: string; userId: string; endpoint: string; reason: string;
  ip: string; resetIn: number; timestamp: string;
  limiterName: string;
  severity: 'critical' | 'warning' | 'medium';
  threatScore: number; attackPattern: string;
  trendData: number[];
};

function calcAttackPattern(blockRate: number, resetIn: number, reason: string): string {
  if (resetIn <= 10 && blockRate > 80) return 'Burst Flood';
  if (reason.includes('global')) return 'Distributed Abuse';
  if (resetIn > 60) return 'Retry Spam';
  if (blockRate > 50) return 'Rapid Retry';
  if (resetIn > 120) return 'Credential Stuffing';
  return 'Burst Attempt';
}

function calcBlockedSeverity(resetIn: number, blockRate: number): 'critical' | 'warning' | 'medium' {
  if (resetIn <= 30 || blockRate > 70) return 'critical';
  if (resetIn <= 60 || blockRate > 40) return 'warning';
  return 'medium';
}

export const BlockedRepository = {

  /** Blocked events grouped by minute with IST time */
  async getBlockedTimeline(query: AnalyticsQuery): Promise<BlockedTimelinePoint[]> {
    const match = { ...matchFor(query), allowed: false };
    const rows = await RequestLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: mongoISTDateParts(),
          blocked:  { $sum: 1 },
          // Get the most common endpoint in this minute
          endpoints: { $push: endpointExpression },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.minute': 1 } },
    ]);

    return rows.map(r => {
      const { hour, minute } = r._id;
      const time = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
      // Find dominant endpoint
      const freq: Record<string, number> = {};
      for (const ep of r.endpoints) {
        const endpoint = normalizeEndpoint(ep);
        freq[endpoint] = (freq[endpoint] ?? 0) + 1;
      }
      const dominantEndpoint = Object.entries(freq).sort((a,b) => b[1]-a[1])[0]?.[0] ?? '';
      return { time, blocked: r.blocked, dominantEndpoint };
    });
  },

  /** Heatmap: blocked count by endpoint × IST hour */
  async getEndpointAbuseHeatmap(windowHours = 6, source: AnalyticsSource = 'all'): Promise<EndpointHeatmapCell[]> {
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const match = { ...matchFor({ scope: 'window', windowMinutes: windowHours * 60, source }), allowed: false, timestamp: { $gte: since } };
    const rows = await RequestLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            endpoint: endpointExpression,
            hour: { $hour: { date: '$timestamp', timezone: 'Asia/Kolkata' } },
          },
          blocked: { $sum: 1 },
        },
      },
      { $sort: { '_id.endpoint': 1, '_id.hour': 1 } },
    ]);
    return rows.map(r => ({
      endpoint: normalizeEndpoint(r._id.endpoint),
      hour: r._id.hour,
      blocked: r.blocked,
    }));
  },

  /** Aggregate stats for blocked log summary cards */
  async getBlockedStats(query: AnalyticsQuery): Promise<BlockedStats> {
    const match = matchFor(query);
    const blockedMatch = { ...match, allowed: false };

    const [main] = await RequestLog.aggregate([
      { $match: blockedMatch },
      {
        $group: {
          _id: null,
          totalBlocked:    { $sum: 1 },
          avgResetIn:      { $avg: '$resetIn' },
          uniqueIPs:       { $addToSet: '$ip' },
          uniqueUsers:     { $addToSet: '$userId' },
          anonBlocked:     { $sum: { $cond: [{ $eq: ['$userId', 'anon'] }, 1, 0] } },
        },
      },
    ]);

    if (!main) {
      return { totalBlocked:0, criticalEndpoints:0, uniqueAttackers:0, avgRetryWindow:0,
        highestAttackRoute:'—', highestAttackRouteCount:0, totalSpikes:0,
        maxBlockedPerMin:0, affectedEndpoints:0, anonBlocked:0, anonBlockedPct:0 };
    }

    // Per-endpoint blocked counts
    const epCounts = await RequestLog.aggregate([
      { $match: blockedMatch },
      { $group: { _id: endpointExpression, count: { $sum: 1 }, totalReqs: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // All requests per endpoint to compute blockRate
    const allEpCounts = await RequestLog.aggregate([
      { $match: match },
      { $group: { _id: endpointExpression, total: { $sum: 1 } } },
    ]);
    const allMap: Record<string,number> = {};
    for (const r of allEpCounts) allMap[normalizeEndpoint(r._id)] = r.total;

    const criticalEndpoints = epCounts.filter(ep => {
      const endpoint = normalizeEndpoint(ep._id);
      const total = allMap[endpoint] ?? ep.count;
      const blockRate = percentage(ep.count, total);
      return blockRate >= 60;
    }).length;

    // Max blocked in any 1-minute bucket
    const minuteBuckets = await RequestLog.aggregate([
      { $match: blockedMatch },
      {
        $group: {
          _id: {
            hour:   { $hour:   { date: '$timestamp', timezone: 'Asia/Kolkata' } },
            minute: { $minute: { date: '$timestamp', timezone: 'Asia/Kolkata' } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
    const maxBlockedPerMin = minuteBuckets[0]?.count ?? 0;
    const totalSpikes = minuteBuckets.filter(b => b.count > (maxBlockedPerMin * 0.5)).length;

    const highestEp = epCounts[0];
    const anonBlockedPct = main.totalBlocked > 0
      ? Math.round((main.anonBlocked / main.totalBlocked) * 1000) / 10
      : 0;

    return {
      totalBlocked:          main.totalBlocked,
      criticalEndpoints,
      uniqueAttackers:       main.uniqueIPs?.length ?? 0,
      avgRetryWindow:        Math.round(main.avgResetIn ?? 0),
      highestAttackRoute:    highestEp?._id ?? '—',
      highestAttackRouteCount: highestEp?.count ?? 0,
      totalSpikes,
      maxBlockedPerMin,
      affectedEndpoints:     epCounts.length,
      anonBlocked:           main.anonBlocked,
      anonBlockedPct,
    };
  },

  /** Get blocked events with computed severity, threatScore, attackPattern */
  async getRichBlocked(limit: number, source: AnalyticsSource = 'all'): Promise<RichBlockedEvent[]> {
    const docs = await RequestLog.find({ allowed: false, ...matchFor({ scope: 'global', source }) })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // For each event compute blockRate from recent history
    return docs.map(d => {
      // Approximate threat score from resetIn and reason
      const resetScore = Math.min(40, Math.round((1 / Math.max(d.resetIn, 1)) * 400));
      const threatScore = Math.min(100, Math.round(resetScore + (d.reason?.includes('global') ? 40 : 20)));
      const attackPattern = calcAttackPattern(
        threatScore, d.resetIn, d.reason ?? ''
      );
      const severity = calcBlockedSeverity(d.resetIn, threatScore);
      return {
        _id:           String(d._id),
        userId:        d.userId,
        endpoint:      normalizeEndpoint(d.endpoint),
        reason:        d.reason ?? 'rate_limit_exceeded',
        ip:            d.ip,
        resetIn:       d.resetIn,
        timestamp:     d.timestamp.toISOString(),
        limiterName:    d.limiterName || getLimiterMetadata(normalizeEndpoint(d.endpoint)).limiterName,
        severity,
        threatScore,
        attackPattern,
        trendData:     [],
      };
    });
  },
};
// ─── Limiter-level aggregation ────────────────────────────────────────────────

export type LimiterAggRow = {
  limiterName:  string;
  endpoint?:     string;
  totalHits:    number;
  blockedHits:  number;
  blockRate:    number;
  avgRemainingPct: number;
  currentHits?: number;
  limit?: number;
  remaining?: number;
  resetSeconds?: number;
  windowMs?: number;
};

export type LimiterConfigInput = {
  endpoint: string;
  limiterName: string;
  max: number;
  windowMs: number;
};

export const LimiterRepository = {
  async getLimiterAggregation(query: AnalyticsQuery): Promise<LimiterAggRow[]> {
    const rows = await RequestLog.aggregate([
      { $match: { ...matchFor(query), limiterName: { $ne: '' } } },
      {
        $group: {
          _id:           '$limiterName',
          totalHits:     { $sum: 1 },
          blockedHits:   { $sum: { $cond: ['$allowed', 0, 1] } },
          totalLimit:    { $avg: '$limit' },
          totalRemaining:{ $avg: '$remaining' },
        },
      },
      { $sort: { totalHits: -1 } },
    ]);
    return rows.map(r => {
      const blockRate = r.totalHits > 0
        ? Math.round((r.blockedHits / r.totalHits) * 1000) / 10
        : 0;
      const avgRemainingPct = percentage(r.totalRemaining, r.totalLimit);
      return {
        limiterName:     r._id,
        totalHits:       r.totalHits,
        blockedHits:     r.blockedHits,
        blockRate,
        avgRemainingPct,
      };
    });
  },

  async getConfiguredLimiterAggregation(configs: LimiterConfigInput[], source: AnalyticsSource = 'all'): Promise<LimiterAggRow[]> {
    const now = Date.now();
    return Promise.all(configs.map(async (cfg) => {
      // Clock-aligned bucket start — same boundary used by the fixed/sliding window
      // engine and the Minute Timeline chart. Resets exactly at :00 of each minute.
      const bucketStart = Math.floor(now / cfg.windowMs) * cfg.windowMs;
      const since = new Date(bucketStart);
      const match = {
        ...matchFor({ scope: 'global', source }),
        limiterName: cfg.limiterName,
        timestamp: { $gte: since },
      };
      const [stats] = await RequestLog.aggregate([
        { $match: match },
        { $match: { $expr: { $eq: [endpointExpression, cfg.endpoint] } } },
        {
          $group: {
            _id: null,
            totalHits: { $sum: 1 },
            blockedHits: { $sum: { $cond: ['$allowed', 0, 1] } },
          },
        },
      ]);
      const [latest] = await RequestLog.aggregate([
        { $match: {
        ...matchFor({ scope: 'global', source }),
        limiterName: cfg.limiterName,
        } },
        { $match: { $expr: { $eq: [endpointExpression, cfg.endpoint] } } },
        { $sort: { timestamp: -1 } },
        { $limit: 1 },
      ]);

      const currentHits = stats?.totalHits ?? 0;
      const blockedHits = stats?.blockedHits ?? 0;
      const latestTimestamp = latest?.timestamp instanceof Date ? latest.timestamp : undefined;
      const latestResetAt = latestTimestamp ? latestTimestamp.getTime() + ((latest.resetIn ?? 0) * 1000) : 0;
      const resetSeconds = latestResetAt > now ? Math.ceil((latestResetAt - now) / 1000) : 0;

      return {
        limiterName: cfg.limiterName,
        endpoint: cfg.endpoint,
        totalHits: currentHits,
        blockedHits,
        blockRate: percentage(blockedHits, currentHits),
        avgRemainingPct: percentage(Math.max(0, cfg.max - currentHits), cfg.max),
        currentHits,
        limit: cfg.max,
        remaining: Math.max(0, cfg.max - currentHits),
        resetSeconds,
        windowMs: cfg.windowMs,
      };
    }));
  },
};
