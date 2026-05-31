import { useQuery } from '@tanstack/react-query';
import {
  getDashboardOverview, getDashboardTimeline, getDashboardEndpointChart,
  getDashboardSourceChart, getDashboardActivity, getDashboardSystemOverview,
} from '@/services/dashboard.service';
import type { AnalyticsSource, DashboardChartWindow, DashboardSourceWindow } from '@/types/analytics.contract';
import { useAppSettingsStore } from '@/store/appSettingsStore';
import { realtimeQueryPolicy } from '@/hooks/queryPolicy';

export const dashboardKeys = {
  all:         ['dashboard-analytics'] as const,
  overview:    (s: AnalyticsSource) => [...dashboardKeys.all, 'overview', s] as const,
  timeline:    (w: DashboardChartWindow, s: AnalyticsSource) => [...dashboardKeys.all, 'timeline', w, s] as const,
  endpoints:   (s: AnalyticsSource) => [...dashboardKeys.all, 'endpoints', s] as const,
  sources:     (w: DashboardSourceWindow, s: AnalyticsSource) => [...dashboardKeys.all, 'sources', w, s] as const,
  activity:    (l: number, s: AnalyticsSource) => [...dashboardKeys.all, 'activity', l, s] as const,
  sysOverview: (s: AnalyticsSource) => [...dashboardKeys.all, 'sysOverview', s] as const,
};

const DASH_LIVE = { staleTime: 2_500, refetchInterval: 3_000, retry: 2 };
const DASH_SLOW = { staleTime: 8_000, refetchInterval: 10_000, retry: 1 };

export function useDashboardOverview(source: AnalyticsSource = 'all') {
  const { pollingIntervalMs, realtimeEnabled } = useAppSettingsStore();
  return useQuery({ queryKey: dashboardKeys.overview(source), queryFn: () => getDashboardOverview(source), ...DASH_LIVE, ...realtimeQueryPolicy, refetchInterval: realtimeEnabled ? pollingIntervalMs : false });
}

export function useDashboardTimeline(window: DashboardChartWindow = 15, source: AnalyticsSource = 'all') {
  const { chartRefreshIntervalMs, realtimeEnabled } = useAppSettingsStore();
  return useQuery({ queryKey: dashboardKeys.timeline(window, source), queryFn: () => getDashboardTimeline(window, source), ...DASH_LIVE, ...realtimeQueryPolicy, refetchInterval: realtimeEnabled ? chartRefreshIntervalMs : false });
}

export function useDashboardEndpointChart(source: AnalyticsSource = 'all') {
  const { chartRefreshIntervalMs, realtimeEnabled } = useAppSettingsStore();
  return useQuery({ queryKey: dashboardKeys.endpoints(source), queryFn: () => getDashboardEndpointChart(source), ...DASH_SLOW, ...realtimeQueryPolicy, refetchInterval: realtimeEnabled ? chartRefreshIntervalMs : false });
}

export function useDashboardSourceChart(window: DashboardSourceWindow = 7, source: AnalyticsSource = 'all') {
  const { chartRefreshIntervalMs, realtimeEnabled } = useAppSettingsStore();
  return useQuery({ queryKey: dashboardKeys.sources(window, source), queryFn: () => getDashboardSourceChart(window, source), ...DASH_SLOW, ...realtimeQueryPolicy, refetchInterval: realtimeEnabled ? chartRefreshIntervalMs : false });
}

export function useDashboardActivity(limit = 12, source: AnalyticsSource = 'all') {
  const { pollingIntervalMs, realtimeEnabled } = useAppSettingsStore();
  return useQuery({ queryKey: dashboardKeys.activity(limit, source), queryFn: () => getDashboardActivity(limit, source), ...DASH_LIVE, ...realtimeQueryPolicy, refetchInterval: realtimeEnabled ? pollingIntervalMs : false });
}

export function useDashboardSystemOverview(source: AnalyticsSource = 'all') {
  const { chartRefreshIntervalMs, realtimeEnabled } = useAppSettingsStore();
  return useQuery({ queryKey: dashboardKeys.sysOverview(source), queryFn: () => getDashboardSystemOverview(source), ...DASH_SLOW, ...realtimeQueryPolicy, refetchInterval: realtimeEnabled ? chartRefreshIntervalMs : false });
}
