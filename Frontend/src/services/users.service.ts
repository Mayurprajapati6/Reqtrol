import { fetchEndpoints, fetchLiveFeed, fetchUsers, fetchUserSummary, type UserStat as ApiUserStat } from '@/api/client';
import type {
  UserActivity, UserStat, UserSummary, UserTimelineEvent,
  UserFrequencyPoint, EndpointUsageSlice,
} from '@/types/analytics.types';
import { globalQuery, type AnalyticsSource } from '@/types/analytics.contract';
import { istDateKey, istShortDate } from '@/utils/ist';
import { safePct } from '@/services/analytics.selectors';

export async function getUserActivities(source: AnalyticsSource = 'all'): Promise<UserActivity[]> {
  const raw = await fetchUsers(globalQuery(source), 100);
  return raw.map(r => ({
    userId:           r.userId,
    userName:         r.userName || r.userId,
    email:            '',
    avatarUrl:        r.avatarUrl || undefined,
    source:           r.source === 'simulator' ? 'simulator' as const : 'quby' as const,
    total:            r.total,
    allowed:          r.allowed,
    blocked:          r.blocked,
    blockRate:        r.blockRate,
    favoriteEndpoint: r.favoriteEndpoint ?? '',
    lastSeen:         r.lastSeen,
    isActive:         new Date(r.lastSeen).getTime() > Date.now() - 10 * 60_000,
    severity:         r.blockRate >= 25 ? 'critical' : r.blockRate >= 10 ? 'warning' : 'healthy',
    sparkData:        [],
  }));
}

export async function getUserStats(source: AnalyticsSource = 'all'): Promise<UserStat[]> {
  const raw = await fetchUsers(globalQuery(source));
  return raw.map(r => ({
    userId:    r.userId,
    userName:  r.userName,
    total:     r.total,
    allowed:   r.allowed,
    blocked:   r.blocked,
    blockRate: r.blockRate,
    severity:  r.blockRate >= 25 ? 'critical' : r.blockRate >= 10 ? 'warning' : 'healthy',
    lastSeen:  r.lastSeen,
  }));
}

export async function getUserSummary(source: AnalyticsSource = 'all'): Promise<UserSummary> {
  const [raw, endpoints] = await Promise.all([fetchUserSummary(globalQuery(source)), fetchEndpoints(globalQuery(source))]);
  const users = raw.users ?? [];
  return {
    totalUsers:      raw.activeCount ?? users.length,
    totalRequests:   users.reduce((s: number, u: ApiUserStat) => s + u.total, 0),
    blockedRequests: users.reduce((s: number, u: ApiUserStat) => s + u.blocked, 0),
    activeEndpoints: endpoints.length,
    highRiskUsers:   raw.suspiciousUsers ?? 0,
    fullyAllowed:    users.filter((u: ApiUserStat) => u.blocked === 0).length,
  };
}

export async function getUserTimeline(source: AnalyticsSource = 'all'): Promise<UserTimelineEvent[]> {
  const events = await fetchLiveFeed(500, source);
  return events
  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  .map((event) => ({
    id:        event._id,
    userId:    event.userId,
    userName:  event.userName || event.userId,
    avatarUrl: event.avatarUrl || undefined,
    source:    event.source === 'simulator' ? 'simulator' as const : 'quby' as const,
    endpoint:  event.endpoint,
    limiterName: event.limiterName || 'No Limiter',
    responseMs: event.responseTimeMs,
    method:    ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes((event.method ?? '').toUpperCase())
      ? event.method.toUpperCase()
      : 'POST',
    allowed:   event.allowed,
    timestamp: event.timestamp,
  }));
}

export async function getUserFrequency(source: AnalyticsSource = 'all'): Promise<UserFrequencyPoint[]> {
  const events = await fetchLiveFeed(500, source);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  return days.map((day) => {
    const date = istShortDate(day);
    const sameDay = events.filter((event) => {
      return istDateKey(event.timestamp) === istDateKey(day);
    });
    return {
      date,
      realUsers: sameDay.filter((event) => event.source !== 'simulator').length,
      simUsers:  sameDay.filter((event) => event.source === 'simulator').length,
    };
  });
}

export async function getEndpointUsage(source: AnalyticsSource = 'all'): Promise<EndpointUsageSlice[]> {
  const endpoints = await fetchEndpoints(globalQuery(source));
  const total = endpoints.reduce((sum, endpoint) => sum + endpoint.total, 0);
  const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#10b981', '#ef4444'];
  return endpoints.slice(0, 6).map((endpoint, index) => ({
    name: endpoint.endpoint,
    pct: safePct(endpoint.total, total),
    color: colors[index % colors.length],
  }));
}
