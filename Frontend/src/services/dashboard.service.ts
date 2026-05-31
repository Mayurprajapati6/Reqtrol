import type {
  DashboardOverview, TimelinePoint, EndpointChartItem,
  SourceChartPoint, ActivityEvent, SystemOverview,
} from '@/types/analytics.types';
import { fetchAnalyticsSnapshot, fetchOverview, fetchTimeline, fetchLiveFeed, fetchSourceTimeline } from '@/api/client';
import { DASHBOARD_KPI_QUERY, globalQuery, windowQuery, type AnalyticsSource, type DashboardChartWindow, type DashboardSourceWindow } from '@/types/analytics.contract';
import axios from 'axios';
import { endpointChartItems, sourceDateSeries } from '@/services/analytics/chartTransformers';

export async function getDashboardOverview(source: AnalyticsSource = 'all'): Promise<DashboardOverview> {
  const raw = await fetchOverview({ ...DASHBOARD_KPI_QUERY, source });
  return {
    totalRequests: raw.totalRequests,
    allowedCount:  raw.allowedCount,
    blockedCount:  raw.blockedCount,
    blockRate:     raw.blockRate,
    avgResponseMs: raw.avgResponseMs,
    activeUsers:   raw.activeUsers ?? 0,
    throughput:    raw.throughput,
    uptime:        raw.uptime,
  };
}

export async function getDashboardTimeline(windowMinutes: DashboardChartWindow = 15, source: AnalyticsSource = 'all'): Promise<TimelinePoint[]> {
  const raw = await fetchTimeline(windowQuery(windowMinutes, source));

  // The backend returns per-minute timeline points. When requesting a large
  // window such as 1440 (Today) the UI expects hourly buckets labelled
  // `HH:00`. Aggregate minute rows into hourly buckets on the client so the
  // X-axis aligns with the dashboard's hourly slots (00:00, 01:00 ...).
  if (windowMinutes >= 60) {
    const byHour = new Map<string, { allowed: number; blocked: number }>();
    for (const r of raw) {
      // r.minute is expected in `HH:MM` format
      const hour = String(r.minute.split(':')[0]).padStart(2, '0');
      const key = `${hour}:00`;
      const entry = byHour.get(key) ?? { allowed: 0, blocked: 0 };
      entry.allowed += r.allowed ?? 0;
      entry.blocked += r.blocked ?? 0;
      byHour.set(key, entry);
    }

    // Return hours in ascending order; keep total as allowed+blocked
    return Array.from(byHour.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([label, v]) => ({
      label,
      allowed: v.allowed,
      blocked: v.blocked,
      total: v.allowed + v.blocked,
    }));
  }

  return raw.map(r => ({
    label:   r.minute,
    allowed: r.allowed,
    blocked: r.blocked,
    total:   r.total ?? r.allowed + r.blocked,
  }));
}

export async function getDashboardEndpointChart(source: AnalyticsSource = 'all'): Promise<EndpointChartItem[]> {
  const raw = await fetchAnalyticsSnapshot(source);
  return endpointChartItems(raw.endpoints);
}

export async function getDashboardSourceChart(days: DashboardSourceWindow = 7, source: AnalyticsSource = 'all'): Promise<SourceChartPoint[]> {
  const windowDays = days;
  return sourceDateSeries(await fetchSourceTimeline(windowDays, source), windowDays);
}

export async function getDashboardActivity(limit = 12, source: AnalyticsSource = 'all'): Promise<ActivityEvent[]> {
  const raw = await fetchLiveFeed(limit, source);
  return raw.map(r => ({
    id:         r._id,
    userId:     r.userId,
    userName:   r.userName ?? '',
    avatarUrl:  r.avatarUrl ?? undefined,
    endpoint:   r.endpoint,
    limiterName: r.limiterName || 'No Limiter',
    method:     ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes((r.method ?? '').toUpperCase())
      ? (r.method ?? 'POST').toUpperCase()
      : 'POST',
    allowed:    r.allowed,
    source:     r.source === 'simulator' ? 'simulator' as const : 'quby' as const,
    responseMs: r.responseTimeMs,
    timestamp:  r.timestamp,
  }));
}

export async function getDashboardSystemOverview(source: AnalyticsSource = 'all'): Promise<SystemOverview> {
  const [overview, snapshot, redis] = await Promise.all([
    fetchOverview(globalQuery(source)),
    fetchAnalyticsSnapshot(source),
    axios.get('/api/v1/stats/redis-health').then((r) => r.data?.data).catch(() => null),
  ]);
  const redisStatus = redis?.overallHealth === 'Healthy'
    ? 'healthy'
    : redis?.overallHealth === 'Error'
      ? 'error'
      : redis?.overallHealth === 'Degraded'
        ? 'degraded'
        : 'unknown';
  return {
    redisStatus,
    apiServerStatus:     overview ? 'healthy' : 'unknown',
    databaseStatus:      snapshot ? 'healthy' : 'unknown',
    totalLimiterHits:    overview.totalRequests,
    avgResponseMs:       overview.avgResponseMs,
    activeEndpoints:     snapshot.activeEndpointCount,
  };
}
