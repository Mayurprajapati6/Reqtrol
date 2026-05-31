import RequestLog, { IRequestLog } from '../../../models/RequestLog.model';
import AnalyticsSnapshot from '../../../models/AnalyticsSnapshot.model';
import { getRedis } from '../../../config/redis';
import { getLimiterMetadata, protectedLimiterMetadata } from '../config/limiterRegistry';
import type {
  AnalyticsChartDto,
  AnalyticsSnapshotPayload,
  CanonicalEndpoint,
  LimiterAggregate,
} from '../types/analytics.types';
import { normalizeEndpoint, normalizeSourceValue } from '../utils/normalizeEndpoint';
import type { AnalyticsQuery, AnalyticsSource } from '../../../utils/analytics';
import { matchFor, percentage, perSecond, mongoISTDateParts } from '../../../utils/analytics';

type Health = AnalyticsChartDto['health'];

export interface OverviewAggregate {
  totalRequests: number;
  allowedCount: number;
  blockedCount: number;
  blockRate: number;
  avgResponseMs: number;
  throughput: number;
  threatScore: number;
  errorRate: number;
  uptime: number;
}

export interface TimelinePoint {
  minute: string;
  allowed: number;
  blocked: number;
  total: number;
}

export interface UserAggregate {
  userId: string;
  userName: string;
  avatarUrl: string;
  source: string;
  favoriteEndpoint: CanonicalEndpoint | '';
  total: number;
  allowed: number;
  blocked: number;
  blockRate: number;
  lastSeen: string;
  riskScore: number;
  requestVelocity: number;
  severity: 'critical' | 'warning' | 'healthy';
  trendData: number[];
  suspiciousEvents: number;
}

interface EndpointAccumulator {
  endpoint: CanonicalEndpoint;
  requests: number;
  allowed: number;
  blocked: number;
  latencyValues: number[];
  remainingValues: number[];
  latestRemaining: number;
  latestResetIn: number;
  latestTimestamp: Date | null;
}

interface UserAccumulator {
  userId: string;
  userName: string;
  avatarUrl: string;
  source: string;
  endpoints: CanonicalEndpoint[];
  total: number;
  allowed: number;
  blocked: number;
  lastSeen: Date;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((pct / 100) * sorted.length) - 1);
  return Math.round(sorted[index] * 10) / 10;
}

function health(blockRate: number, saturation: number, latency: number): Health {
  if (blockRate >= 35 || saturation >= 95 || latency >= 750) return 'critical';
  if (blockRate >= 20 || saturation >= 85 || latency >= 500) return 'degraded';
  if (blockRate >= 10 || saturation >= 70 || latency >= 250) return 'warning';
  return 'healthy';
}

function riskScore(blockRate: number, velocity: number): number {
  return Math.min(100, Math.round((blockRate * 0.7) + Math.min(velocity / 10, 30)));
}

function severity(score: number): 'critical' | 'warning' | 'healthy' {
  if (score >= 60) return 'critical';
  if (score >= 25) return 'warning';
  return 'healthy';
}

function stableEndpointSort(a: AnalyticsChartDto, b: AnalyticsChartDto): number {
  return b.requests - a.requests || b.blocked - a.blocked || a.endpoint.localeCompare(b.endpoint);
}

function stableLimiterSort(a: LimiterAggregate, b: LimiterAggregate): number {
  return b.requests - a.requests || b.blocked - a.blocked || a.endpoint.localeCompare(b.endpoint);
}

async function docsFor(query: AnalyticsQuery): Promise<IRequestLog[]> {
  return RequestLog.find(matchFor(query)).sort({ timestamp: -1 }).lean<IRequestLog[]>().exec();
}

async function readRedisSnapshot(key: string): Promise<AnalyticsSnapshotPayload | null> {
  try {
    const raw = await getRedis().get(key);
    return raw ? JSON.parse(raw) as AnalyticsSnapshotPayload : null;
  } catch {
    return null;
  }
}

async function writeSnapshot(key: string, source: AnalyticsSource | 'all', payload: AnalyticsSnapshotPayload): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(key, JSON.stringify(payload), 'EX', 300);
    await redis.config('SET', 'appendonly', 'yes').catch(() => undefined);
  } catch {
    // Mongo snapshot below is the durable fallback when Redis is unavailable or CONFIG is disabled.
  }

  await AnalyticsSnapshot.findOneAndUpdate(
    { key },
    { key, source, payload, createdAt: new Date() },
    { upsert: true, new: true },
  ).exec();
}

async function readMongoSnapshot(key: string): Promise<AnalyticsSnapshotPayload | null> {
  const snapshot = await AnalyticsSnapshot.findOne({ key }).sort({ createdAt: -1 }).lean().exec();
  return snapshot?.payload ?? null;
}

function snapshotKey(source: AnalyticsSource | 'all'): string {
  return `analytics:snapshot:${source}:global`;
}

const AnalyticsAggregatorService = {
  async getOverview(query: AnalyticsQuery): Promise<OverviewAggregate> {
    const docs = await docsFor(query);
    const total = docs.length;
    const allowed = docs.filter((doc) => doc.allowed).length;
    const blocked = total - allowed;
    const blockRate = percentage(blocked, total);
    return {
      totalRequests: total,
      allowedCount: allowed,
      blockedCount: blocked,
      blockRate,
      avgResponseMs: avg(docs.map((doc) => doc.responseTimeMs ?? 0)),
      throughput: query.scope === 'window' ? perSecond(total, query.windowMinutes) : 0,
      threatScore: Math.min(100, Math.round(blockRate * Math.log10(total + 1) * 3)),
      errorRate: blockRate,
      uptime: Math.round((process.uptime() / 3600) * 100) / 100,
    };
  },

  async getTimeline(query: AnalyticsQuery): Promise<TimelinePoint[]> {
    const rows = await RequestLog.aggregate([
      { $match: matchFor(query) },
      {
        $group: {
          _id: mongoISTDateParts(),
          allowed: { $sum: { $cond: ['$allowed', 1, 0] } },
          blocked: { $sum: { $cond: ['$allowed', 0, 1] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.minute': 1 } },
    ]);

    return rows.map((row) => ({
      minute: `${String(row._id.hour).padStart(2, '0')}:${String(row._id.minute).padStart(2, '0')}`,
      allowed: row.allowed,
      blocked: row.blocked,
      total: row.allowed + row.blocked,
    }));
  },

  async getEndpointCharts(query: AnalyticsQuery): Promise<AnalyticsChartDto[]> {
    const docs = await docsFor(query);
    const acc = new Map<CanonicalEndpoint, EndpointAccumulator>();

    for (const doc of docs) {
      const endpoint = normalizeEndpoint(doc.endpoint);
      const current = acc.get(endpoint) ?? {
        endpoint,
        requests: 0,
        allowed: 0,
        blocked: 0,
        latencyValues: [],
        remainingValues: [],
        latestRemaining: getLimiterMetadata(endpoint).limit,
        latestResetIn: 0,
        latestTimestamp: null,
      };

      current.requests += 1;
      current.allowed += doc.allowed ? 1 : 0;
      current.blocked += doc.allowed ? 0 : 1;
      current.latencyValues.push(doc.responseTimeMs ?? 0);
      current.remainingValues.push(doc.remaining ?? getLimiterMetadata(endpoint).limit);
      if (!current.latestTimestamp || doc.timestamp > current.latestTimestamp) {
        current.latestTimestamp = doc.timestamp;
        current.latestRemaining = doc.remaining ?? getLimiterMetadata(endpoint).limit;
        current.latestResetIn = doc.resetIn ?? 0;
      }
      acc.set(endpoint, current);
    }

    const totalRequests = [...acc.values()].reduce((sum, row) => sum + row.requests, 0);
    return [...acc.values()].map((row) => {
      const meta = getLimiterMetadata(row.endpoint);
      const blockRate = percentage(row.blocked, row.requests);
      const latency = avg(row.latencyValues);
      const used = Math.max(0, meta.limit - row.latestRemaining);
      const saturation = percentage(used, meta.limit);
      return {
        id: row.endpoint,
        endpoint: row.endpoint,
        label: row.endpoint,
        requests: row.requests,
        allowed: row.allowed,
        blocked: row.blocked,
        blockRate,
        latency,
        p95Latency: percentile(row.latencyValues, 95),
        limiterName: meta.limiterName,
        saturation,
        health: health(blockRate, saturation, latency),
        rank: 0,
        distribution: percentage(row.requests, totalRequests),
      };
    }).sort(stableEndpointSort).map((row, index) => ({ ...row, rank: index + 1 }));
  },

  async getLimiters(source: AnalyticsSource | 'all' = 'all'): Promise<LimiterAggregate[]> {
    const query: AnalyticsQuery = { scope: 'global', source };
    const endpoints = await this.getEndpointCharts(query);
    const byEndpoint = new Map(endpoints.map((endpoint) => [endpoint.endpoint, endpoint]));

    return protectedLimiterMetadata.map((meta) => {
      const endpoint = byEndpoint.get(meta.endpoint);
      const latest = endpoint?.saturation ?? 0;
      const requests = endpoint?.requests ?? 0;
      const blocked = endpoint?.blocked ?? 0;
      const allowed = endpoint?.allowed ?? 0;
      const remaining = Math.max(0, meta.limit - Math.round((latest / 100) * meta.limit));
      const blockRate = percentage(blocked, requests);
      const limiterHealth: LimiterAggregate['health'] = latest >= 92 || blockRate >= 50 ? 'critical' : latest >= 75 || blockRate >= 25 ? 'warning' : 'healthy';
      return {
        id: `${meta.limiterName}:${meta.endpoint}`,
        endpoint: meta.endpoint,
        limiterName: meta.limiterName,
        requests,
        allowed,
        blocked,
        blockRate,
        limit: meta.limit,
        remaining,
        limiterLimit: meta.limit,
        limiterWindowMs: meta.windowMs,
        saturation: latest,
        resetSeconds: 0,
        health: limiterHealth,
      };
    }).sort(stableLimiterSort);
  },

  async getUsers(query: AnalyticsQuery, limit: number): Promise<UserAggregate[]> {
    const docs = await docsFor(query);
    const users = new Map<string, UserAccumulator>();
    const windowMinutes = query.windowMinutes ?? 24 * 60;

    for (const doc of docs) {
      const current = users.get(doc.userId) ?? {
        userId: doc.userId,
        userName: doc.userName ?? '',
        avatarUrl: doc.avatarUrl ?? '',
        source: normalizeSourceValue(doc.source, doc.service),
        endpoints: [],
        total: 0,
        allowed: 0,
        blocked: 0,
        lastSeen: doc.timestamp,
      };

      current.total += 1;
      current.allowed += doc.allowed ? 1 : 0;
      current.blocked += doc.allowed ? 0 : 1;
      current.endpoints.push(normalizeEndpoint(doc.endpoint));
      if (doc.timestamp > current.lastSeen) current.lastSeen = doc.timestamp;
      users.set(doc.userId, current);
    }

    return [...users.values()].map((row) => {
      const endpointCounts = new Map<CanonicalEndpoint, number>();
      for (const endpoint of row.endpoints) {
        endpointCounts.set(endpoint, (endpointCounts.get(endpoint) ?? 0) + 1);
      }
      const favoriteEndpoint = [...endpointCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '';
      const blockRate = percentage(row.blocked, row.total);
      const velocity = Math.round((row.total / windowMinutes) * 10) / 10;
      const score = riskScore(blockRate, velocity);

      return {
        userId: row.userId,
        userName: row.userName,
        avatarUrl: row.avatarUrl,
        source: row.source,
        favoriteEndpoint,
        total: row.total,
        allowed: row.allowed,
        blocked: row.blocked,
        blockRate,
        lastSeen: row.lastSeen.toISOString(),
        riskScore: score,
        requestVelocity: velocity,
        severity: severity(score),
        trendData: [],
        suspiciousEvents: row.blocked,
      };
    }).sort((a, b) => b.total - a.total || b.blocked - a.blocked || a.userId.localeCompare(b.userId)).slice(0, limit);
  },

  async getSnapshot(source: AnalyticsSource | 'all' = 'all'): Promise<AnalyticsSnapshotPayload> {
    const key = snapshotKey(source);
    const cached = await readRedisSnapshot(key);
    if (cached) return cached;

    const endpoints = await this.getEndpointCharts({ scope: 'global', source });
    const limiters = await this.getLimiters(source);
    const payload: AnalyticsSnapshotPayload = {
      generatedAt: new Date().toISOString(),
      source,
      endpoints,
      limiters,
      activeEndpointCount: endpoints.length,
      busiestEndpoints: endpoints.slice(0, 10),
      endpointPressure: endpoints.slice(0, 10),
      requestDistribution: endpoints,
    };

    if (payload.endpoints.length === 0) {
      const durable = await readMongoSnapshot(key);
      if (durable) return durable;
    }

    await writeSnapshot(key, source, payload);
    return payload;
  },
};

export default AnalyticsAggregatorService;
