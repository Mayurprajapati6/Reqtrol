import { fetchAnalyticsSnapshot, fetchEndpoints, fetchLimitsConfig, fetchLimiters, fetchHistoricalRequests, fetchLiveFeed } from '@/api/client';
import type {
  EndpointCardData, EndpointStat, PressureChartPoint,
  HeatmapRow,
} from '@/types/analytics.types';
import { globalQuery, type AnalyticsSource } from '@/types/analytics.contract';
import { completeEndpointDtos, endpointCardsFromDtos, endpointHeatmapFromEvents, limiterCardsFromBackend } from '@/services/analytics/chartTransformers';
import type { LimiterAgg } from '@/api/client';

export async function getEndpointCards(source: AnalyticsSource = 'all'): Promise<EndpointCardData[]> {
  const [snapshot, configs, agg] = await Promise.all([
    fetchAnalyticsSnapshot(source),
    fetchLimitsConfig(),
    fetchLimiters(source),
  ]);
  const limiterCards = limiterCardsFromBackend(configs, agg as LimiterAgg[]);
  return endpointCardsFromDtos(snapshot.endpoints, limiterCards);
}

export async function getEndpointStats(source: AnalyticsSource = 'all'): Promise<EndpointStat[]> {
  const raw = await fetchEndpoints(globalQuery(source));
  return completeEndpointDtos(raw.map(r => ({
    id: r.endpoint,
    endpoint:  r.endpoint,
    label: r.endpoint,
    requests:  r.total ?? r.requests ?? 0,
    allowed: r.allowed,
    blocked:   r.blocked,
    blockRate: r.blockRate,
    latency: r.latency ?? r.avgResponseMs ?? 0,
    p95Latency: r.p95Latency ?? 0,
    limiterName: r.limiterName ?? '',
    saturation: r.saturation ?? 0,
    rank: 0,
    distribution: 0,
    health: r.health ?? 'healthy',
  }))).map(r => ({
    endpoint: r.endpoint,
    requests: r.requests,
    blocked: r.blocked,
    avgMs: Math.round(r.latency),
    p99Ms: Math.round(r.p95Latency),
    blockRate: r.blockRate,
  }));
}

export async function getEndpointPressureChart(source: AnalyticsSource = 'all'): Promise<PressureChartPoint[]> {
  const snapshot = await fetchAnalyticsSnapshot(source);
  return completeEndpointDtos(snapshot.endpoints).map(r => ({
    name:     r.label,
    requests: r.requests,
    blocked:  r.blocked,
  }));
}

export async function getEndpointHeatmap(source: AnalyticsSource = 'all', selectedDate?: string): Promise<HeatmapRow[]> {
  let events: any[] = [];
  
  // Get today's date in IST for comparison
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  
  // Convert DD-MM-YYYY to YYYY-MM-DD for API if needed
  const formatDateForAPI = (date: string): string => {
    const parts = date.split('-');
    if (parts.length === 3 && parts[0].length === 2) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY to YYYY-MM-DD
    }
    return date;
  };
  
  const apiDate = selectedDate ? formatDateForAPI(selectedDate) : undefined;
  
  if (apiDate && apiDate !== todayIST) {
    // For past dates, fetch all pages from historical API
    let page = 1;
    let totalPages = 1;
    
    do {
      const response = await fetchHistoricalRequests(apiDate, page, 100, source);
      events = events.concat(response.rows);
      totalPages = response.totalPages;
      page++;
    } while (page <= totalPages);
  } else {
    // For today or no date selection, use live feed for real-time data
    events = await fetchLiveFeed(500, source);
  }
  
  return endpointHeatmapFromEvents(events, apiDate || todayIST);
}
