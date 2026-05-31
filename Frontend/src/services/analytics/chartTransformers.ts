import type { AnalyticsChartDto, LimitConfig, LimiterAgg, LiveEvent, SourceTimelinePoint } from '@/api/client';
import type { EndpointCardData, EndpointChartItem, HeatmapRow, LimiterCard, SourceChartPoint } from '@/types/analytics.types';
import { ACTIVE_ENDPOINTS, ENDPOINT_REGISTRY, endpointMeta, normalizeEndpoint, type ActiveEndpoint } from './endpointRegistry';
import { allowedCount, blockedRate, distribution, limiterRemaining, limiterUsage, limiterUsed } from './analyticsCalculations';
import { deterministicLatency, deterministicP95Latency } from './latencyEngine';
import { endpointHealth, limiterHealth } from './limiterHealth';

export function stableEndpointSort<T extends { endpoint?: string; path?: string; requests?: number; blocked?: number }>(a: T, b: T): number {
  const aEndpoint = normalizeEndpoint(a.endpoint ?? a.path) ?? '/payment/webhook';
  const bEndpoint = normalizeEndpoint(b.endpoint ?? b.path) ?? '/payment/webhook';
  return (b.requests ?? 0) - (a.requests ?? 0)
    || (b.blocked ?? 0) - (a.blocked ?? 0)
    || aEndpoint.localeCompare(bEndpoint);
}

export function completeEndpointDtos(rows: AnalyticsChartDto[] = []): AnalyticsChartDto[] {
  const byEndpoint = new Map<ActiveEndpoint, AnalyticsChartDto>();
  for (const row of rows) {
    const endpoint = normalizeEndpoint(row.endpoint);
    if (endpoint) byEndpoint.set(endpoint, row);
  }
  const total = ACTIVE_ENDPOINTS.reduce((sum, endpoint) => sum + (byEndpoint.get(endpoint)?.requests ?? 0), 0);

  return ACTIVE_ENDPOINTS.map((endpoint) => {
    const meta = ENDPOINT_REGISTRY[endpoint];
    const row = byEndpoint.get(endpoint);
    const requests = row?.requests ?? 0;
    const blocked = endpoint === '/payment/webhook' ? 0 : (row?.blocked ?? 0);
    const allowed = allowedCount(requests, blocked);
    const used = limiterUsed(endpoint, requests);
    const usage = endpoint === '/payment/webhook' ? 0 : limiterUsage(endpoint, used);
    const latency = deterministicLatency(endpoint, String(requests));
    return {
      id: endpoint,
      endpoint,
      label: endpoint,
      requests,
      allowed,
      blocked,
      blockRate: endpoint === '/payment/webhook' ? 0 : blockedRate(blocked, requests),
      latency,
      p95Latency: deterministicP95Latency(endpoint),
      limiterName: meta.limiterName,
      saturation: usage,
      rank: 0,
      distribution: distribution(requests, total),
      health: endpoint === '/payment/webhook' ? 'healthy' : endpointHealth(blockedRate(blocked, requests), usage),
    };
  }).sort(stableEndpointSort).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function endpointCardsFromDtos(rows: AnalyticsChartDto[], limiterCards?: LimiterCard[]): EndpointCardData[] {
  const limiterMap = new Map(limiterCards?.map(c => [c.endpoint, c]) ?? []);
  return completeEndpointDtos(rows).map((row) => {
    const meta = ENDPOINT_REGISTRY[row.endpoint as ActiveEndpoint];
    const limiterCard = limiterMap.get(row.endpoint);
    const realTimeUsage = limiterCard ? Math.min(100, Math.round((limiterCard.used / limiterCard.total) * 1000) / 10) : row.saturation;
    return {
      id: row.endpoint,
      path: row.endpoint,
      fullPath: row.endpoint,
      label: meta.label,
      icon: meta.icon,
      method: meta.method,
      color: meta.color,
      requests: row.requests,
      allowed: row.allowed,
      blocked: row.blocked,
      blockRate: row.blockRate,
      avgMs: row.latency,
      p95Ms: row.p95Latency,
      limiterName: meta.limiterName,
      limiterUsagePct: realTimeUsage,
      limiterCapacity: meta.limit ?? 0,
      health: row.health,
      distribution: row.distribution,
      sparkData: [],
    };
  });
}

export function endpointChartItems(rows: AnalyticsChartDto[]): EndpointChartItem[] {
  return completeEndpointDtos(rows).map((row) => ({
    name: row.endpoint,
    endpoint: row.endpoint,
    value: row.requests,
    color: ENDPOINT_REGISTRY[row.endpoint as ActiveEndpoint].color,
  }));
}

export function limiterCardsFromBackend(configs: LimitConfig[], agg: LimiterAgg[]): LimiterCard[] {
  const aggByEndpoint = new Map<ActiveEndpoint, LimiterAgg>();
  for (const row of agg) {
    const endpoint = normalizeEndpoint(row.endpoint);
    if (endpoint) aggByEndpoint.set(endpoint, row);
  }

  return ACTIVE_ENDPOINTS.map((endpoint) => {
    const meta = ENDPOINT_REGISTRY[endpoint];
    const config = configs.find((cfg) => normalizeEndpoint(cfg.endpoint) === endpoint);
    const row = aggByEndpoint.get(endpoint);
    const total = config?.max ?? meta.limit ?? 0;
    const requests = row?.totalHits ?? 0;
    const blocked = endpoint === '/payment/webhook' ? 0 : (row?.blockedHits ?? 0);
    const used = endpoint === '/payment/webhook' ? 0 : limiterUsed(endpoint, row?.currentHits ?? requests, row?.remaining);
    const remaining = endpoint === '/payment/webhook' ? 0 : limiterRemaining(endpoint, used);
    const saturation = endpoint === '/payment/webhook' ? 0 : limiterUsage(endpoint, used);
    const windowMs = config?.windowMs ?? meta.windowMs ?? 60000;
    const resetAt = row?.resetAt ?? 0;

    // Clock-aligned bucket boundaries — fall back to server-computed values
    const now = Date.now();
    const defaultBucketStart = Math.floor(now / windowMs) * windowMs;
    const defaultBucketEnd   = defaultBucketStart + windowMs;

    return {
      id: `${meta.limiterName}:${endpoint}`,
      name: endpoint === '/payment/webhook' ? 'No Limiter' : (row?.limiterName || config?.limiterName || meta.limiterName),
      icon: meta.icon,
      endpoint,
      used,
      total,
      remaining,
      blockRate: endpoint === '/payment/webhook' ? 0 : blockedRate(blocked, requests),
      saturation,
      resetAt,
      bucketStart: endpoint === '/payment/webhook' ? 0 : (row?.bucketStart ?? defaultBucketStart),
      bucketEnd:   endpoint === '/payment/webhook' ? 0 : (row?.bucketEnd   ?? defaultBucketEnd),
      reqSec:      endpoint === '/payment/webhook' ? 0 : (row?.reqSec      ?? 0),
      reqMin:      endpoint === '/payment/webhook' ? 0 : (row?.reqMin      ?? 0),
      color: meta.color,
      health: limiterHealth(saturation),
      isActive: true,
      algorithm: endpoint === '/payment/webhook' ? 'Fixed Window' : (meta.algorithm === 'None' ? 'Fixed Window' : meta.algorithm),
      windowLabel: endpoint === '/payment/webhook' ? 'Bypassed' : (config?.windowLabel ?? meta.windowLabel),
      totalHitsToday: requests,
      blockedToday: blocked,
    };
  });
}

export function sourceDateSeries(rows: SourceTimelinePoint[], days: number): SourceChartPoint[] {
  const byLabel = new Map(rows.map((row) => [row.time, row]));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    const label = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' });
    const row = byLabel.get(label);
    return { time: label, quby: row?.quby ?? 0, simulator: row?.simulator ?? 0 };
  });
}

export function endpointHeatmapFromEvents(events: LiveEvent[], selectedDate?: string): HeatmapRow[] {
  const counts = new Map<string, number>();
  let max = 0;
  
  // Use selected date or default to today's IST date
  const targetDate = selectedDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  
  for (const event of events) {
    const endpoint = normalizeEndpoint(event.endpoint);
    if (!endpoint) continue;
    
    // Filter events to only include the selected date's events
    const eventDate = new Date(event.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (eventDate !== targetDate) continue;
    
    const hour = new Date(event.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
    const key = `${endpoint}:${hour}:00`;
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    max = Math.max(max, next);
  }

  return ACTIVE_ENDPOINTS.map((endpoint) => {
    const values: Record<string, number> = {};
    for (let h = 0; h < 24; h += 1) {
      const hour = `${String(h).padStart(2, '0')}:00`;
      const count = counts.get(`${endpoint}:${hour}`) ?? 0;
      values[hour] = count; // Show actual request counts, not normalized percentages
    }
    return { hour: endpoint, values };
  });
}

export function activeEndpointOptions(): ActiveEndpoint[] {
  return ACTIVE_ENDPOINTS;
}

export function eventEndpoint(event: Pick<LiveEvent, 'endpoint'>): ActiveEndpoint | null {
  return endpointMeta(event.endpoint)?.endpoint ?? null;
}
