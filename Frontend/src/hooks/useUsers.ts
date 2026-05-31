import { useQuery } from '@tanstack/react-query';
import {
  getUserActivities, getUserStats, getUserSummary,
  getUserTimeline, getUserFrequency, getEndpointUsage,
} from '@/services/users.service';
import type { AnalyticsSource } from '@/types/analytics.contract';
import { useAppSettingsStore } from '@/store/appSettingsStore';
import { realtimeQueryPolicy } from '@/hooks/queryPolicy';

export const userKeys = {
  all:        ['user-activity'] as const,
  activities: (s: AnalyticsSource) => [...userKeys.all, 'activities', s] as const,
  stats:      (s: AnalyticsSource) => [...userKeys.all, 'stats', s]      as const,
  summary:    (s: AnalyticsSource) => [...userKeys.all, 'summary', s]    as const,
  timeline:   (s: AnalyticsSource) => [...userKeys.all, 'timeline', s]   as const,
  frequency:  (s: AnalyticsSource) => [...userKeys.all, 'frequency', s]  as const,
  epUsage:    (s: AnalyticsSource) => [...userKeys.all, 'epUsage', s]    as const,
};

const U_LIVE = { staleTime: 4_000, refetchInterval: 5_000, retry: 2 };
const U_SLOW = { staleTime: 20_000, refetchInterval: 30_000, retry: 1 };

function useRefresh(live: boolean) {
  const { pollingIntervalMs, chartRefreshIntervalMs, realtimeEnabled } = useAppSettingsStore();
  return realtimeEnabled ? (live ? pollingIntervalMs : chartRefreshIntervalMs) : false;
}

export function useUserActivities(source: AnalyticsSource = 'all') { const r = useRefresh(true); return useQuery({ queryKey: userKeys.activities(source), queryFn: () => getUserActivities(source), ...U_LIVE, ...realtimeQueryPolicy, refetchInterval: r }); }
export function useUserStats(source: AnalyticsSource = 'all')      { const r = useRefresh(true); return useQuery({ queryKey: userKeys.stats(source),      queryFn: () => getUserStats(source),      ...U_LIVE, ...realtimeQueryPolicy, refetchInterval: r }); }
export function useUserSummary(source: AnalyticsSource = 'all')    { const r = useRefresh(true); return useQuery({ queryKey: userKeys.summary(source),    queryFn: () => getUserSummary(source),    ...U_LIVE, ...realtimeQueryPolicy, refetchInterval: r }); }
export function useUserTimeline(source: AnalyticsSource = 'all')   { const r = useRefresh(true); return useQuery({ queryKey: userKeys.timeline(source),   queryFn: () => getUserTimeline(source),   ...U_LIVE, ...realtimeQueryPolicy, refetchInterval: r }); }
export function useUserFrequency(source: AnalyticsSource = 'all')  { const r = useRefresh(false); return useQuery({ queryKey: userKeys.frequency(source),  queryFn: () => getUserFrequency(source),  ...U_SLOW, ...realtimeQueryPolicy, refetchInterval: r }); }
export function useEndpointUsage(source: AnalyticsSource = 'all')  { const r = useRefresh(false); return useQuery({ queryKey: userKeys.epUsage(source),    queryFn: () => getEndpointUsage(source),  ...U_SLOW, ...realtimeQueryPolicy, refetchInterval: r }); }
