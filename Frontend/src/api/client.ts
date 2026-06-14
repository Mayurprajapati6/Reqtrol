import axios from 'axios';
import type { AnalyticsQuery, AnalyticsSource } from '@/types/analytics.contract';
const BASE =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

const api = axios.create({
  baseURL: BASE,
  timeout: 10000,
});

export interface OverviewStats {
  totalRequests: number; allowedCount: number; blockedCount: number;
  blockRate: number; avgResponseMs: number; activeUsers: number;
  windowMinutes: number; throughput: number; threatScore: number;
  errorRate: number; uptime: number;
}
export interface TimelinePoint { minute: string; allowed: number; blocked: number; total: number; }
export interface SourceTimelinePoint { time: string; quby: number; simulator: number; total: number; }
export interface HeatmapCell { day: number; hour: number; count: number; }
export interface EndpointHeatmapPoint { endpoint: string; hour: number; count: number; }
export interface EndpointStat {
  id?: string; endpoint: string; label?: string; requests?: number; total: number; allowed: number; blocked: number;
  blockRate: number; avgResponseMs: number; riskScore: number; requestVelocity: number;
  severity: 'critical' | 'warning' | 'healthy';
  latency?: number; p95Latency?: number; limiterName?: string; saturation?: number; health?: 'healthy' | 'warning' | 'degraded' | 'critical';
  trendData: number[]; spikeDetected: boolean;
}
export interface UserStat {
  userId: string; userName?: string; avatarUrl?: string; source?: 'quby' | 'simulator'; favoriteEndpoint?: string;
  total: number; allowed: number; blocked: number;
  blockRate: number; lastSeen: string; riskScore: number;
  requestVelocity: number; severity: 'critical' | 'warning' | 'healthy';
  trendData: number[]; suspiciousEvents: number;
}
export interface UserSummary {
  users: UserStat[]; anonPct: number; activeCount: number;
  suspiciousUsers: number; avgBlockRate: number; highestRisk: UserStat | null;
}
export interface BlockedEvent {
  _id: string; userId: string; endpoint: string; reason: string;
  ip: string; resetIn: number; timestamp: string;
}
export interface LiveEvent {
  _id: string; userId: string; userName: string; avatarUrl: string;
  endpoint: string; allowed: boolean;
  reason: string | null; ip: string; responseTimeMs: number;
  timestamp: string; method: string; source?: 'quby' | 'simulator'; limiterName?: string;
  limit?: number; remaining?: number; resetIn?: number;
}
export interface HistoricalRequestsPage {
  rows: LiveEvent[]; page: number; limit: number; total: number; totalPages: number;
}
export interface LimitConfig {
  endpoint: string; max: number; windowMs: number; windowLabel: string; algorithm: string; limiterName?: string;
}
export interface LimiterAgg {
  limiterName: string; totalHits: number; blockedHits: number; blockRate: number; avgRemainingPct: number;
  endpoint?: string; currentHits?: number; limit?: number; remaining?: number; resetAt?: number; windowMs?: number;
  saturation?: number; health?: 'healthy' | 'warning' | 'critical';
  bucketStart?: number; bucketEnd?: number; reqMin?: number; reqSec?: number;
}
export interface AnalyticsChartDto {
  id: string; endpoint: string; label: string; requests: number; blocked: number; allowed: number; blockRate: number;
  latency: number; p95Latency: number; limiterName: string; saturation: number;
  rank: number;
  distribution: number;
  health: 'healthy' | 'warning' | 'degraded' | 'critical';
}
export interface AnalyticsSnapshot {
  generatedAt: string; source: AnalyticsSource; endpoints: AnalyticsChartDto[]; limiters: LimiterAgg[];
  activeEndpointCount: number; busiestEndpoints: AnalyticsChartDto[]; endpointPressure: AnalyticsChartDto[];
  requestDistribution: AnalyticsChartDto[];
}
export interface SimulateResult {
  total: number; allowed: number; blocked: number; blockRate: number;
  avgLatencyMs: number; endpoint: string; userId: string; algorithm: string;
  limit: number; limiterName?: string;
  results: Array<{ seq: number; allowed: boolean; remaining: number; reason: string | null; latencyMs: number; }>;
}

function analyticsParams(query: AnalyticsQuery | number = 30, extra: Record<string, unknown> = {}) {
  if (typeof query === 'number') return { window: query, source: 'all', ...extra };
  return {
    scope: query.scope,
    window: query.windowMinutes,
    source: query.source,
    ...extra,
  };
}

export const fetchOverview    = async (q: AnalyticsQuery | number = 30) => (await api.get<{data:OverviewStats}>('/stats/overview', { params: analyticsParams(q) })).data.data;
export const fetchTimeline    = async (q: AnalyticsQuery | number = 30) => (await api.get<{data:TimelinePoint[]}>('/stats/timeline', { params: analyticsParams(q) })).data.data;
export const fetchSourceTimeline = async (days = 7, source: AnalyticsSource = 'all') => (await api.get<{data:SourceTimelinePoint[]}>('/stats/sources', { params: { days, source } })).data.data;
export const fetchHeatmap     = async (source: AnalyticsSource = 'all') => (await api.get<{data:HeatmapCell[]}>('/stats/heatmap', { params: { source } })).data.data;
export const fetchEndpointHeatmap = async (source: AnalyticsSource = 'all') => (await api.get<{data:EndpointHeatmapPoint[]}>('/stats/endpoints/heatmap', { params: { source } })).data.data;
export const fetchEndpoints   = async (q: AnalyticsQuery | number = 30) => (await api.get<{data:EndpointStat[]}>('/stats/endpoints', { params: analyticsParams(q) })).data.data;
export const fetchUsers       = async (q: AnalyticsQuery | number = 30, limit = 50) => (await api.get<{data:UserStat[]}>('/stats/users', { params: analyticsParams(q, { limit }) })).data.data;
export const fetchUserSummary = async (q: AnalyticsQuery | number = 30) => (await api.get<{data:UserSummary}>('/stats/users/summary', { params: analyticsParams(q) })).data.data;
export const fetchBlocked     = async (l = 50, source: AnalyticsSource = 'all') => (await api.get<{data:BlockedEvent[]}>('/stats/blocked', { params: { limit: l, source } })).data.data;
export const fetchLiveFeed    = async (l = 100, source: AnalyticsSource = 'all', window?: number) =>
  (await api.get<{data:LiveEvent[]}>('/stats/live', { params: { limit: l, source, ...(window ? { window } : {}) } })).data.data;
export const fetchHistoricalRequests = async (date: string, page = 1, limit = 25, source: AnalyticsSource = 'all') =>
  (await api.get<{data:HistoricalRequestsPage}>('/stats/requests', { params: { date, page, limit, source } })).data.data;
export const fetchLimitsConfig = async ()       => (await api.get<{data:LimitConfig[]}>('/stats/limits-config')).data.data;
export const fetchLimiters     = async (source: AnalyticsSource = 'all') => (await api.get<{data:LimiterAgg[]}>('/stats/limiters', { params: { source } })).data.data;
export const fetchAnalyticsSnapshot = async (source: AnalyticsSource = 'all') => (await api.get<{data:AnalyticsSnapshot}>('/stats/snapshot', { params: { source } })).data.data;
export const runSimulation = async (p: { userId: string; endpoint: string; count: number; delayMs: number }) =>
  (await api.post<{data:SimulateResult}>('/simulate', p)).data.data;

// ── Blocked intelligence ──────────────────────────────────────────────────────
export interface BlockedTimelinePoint {
  time: string; blocked: number; dominantEndpoint: string;
}
export interface EndpointHeatmapCell {
  endpoint: string; hour: number; blocked: number;
}
export interface BlockedStats {
  totalBlocked: number; criticalEndpoints: number; uniqueAttackers: number;
  avgRetryWindow: number; highestAttackRoute: string; highestAttackRouteCount: number;
  totalSpikes: number; maxBlockedPerMin: number; affectedEndpoints: number;
  anonBlocked: number; anonBlockedPct: number;
}
export interface RichBlockedEvent {
  _id: string; userId: string; endpoint: string; reason: string;
  ip: string; resetIn: number; timestamp: string;
  limiterName?: string;
  severity: 'critical' | 'warning' | 'medium';
  threatScore: number; attackPattern: string; trendData: number[];
}

export const fetchBlockedTimeline     = async (q: AnalyticsQuery | number = 30) => (await api.get<{data:BlockedTimelinePoint[]}>('/stats/blocked/timeline', { params: analyticsParams(q) })).data.data;
export const fetchEndpointAbuseHeatmap = async (h = 6, source: AnalyticsSource = 'all') => (await api.get<{data:EndpointHeatmapCell[]}>('/stats/blocked/endpoint-heatmap', { params: { hours: h, source } })).data.data;
export const fetchBlockedStats        = async (q: AnalyticsQuery | number = 30) => (await api.get<{data:BlockedStats}>('/stats/blocked/stats', { params: analyticsParams(q) })).data.data;
export const fetchRichBlocked         = async (l = 200, source: AnalyticsSource = 'all') => (await api.get<{data:RichBlockedEvent[]}>('/stats/blocked/rich', { params: { limit: l, source } })).data.data;
