import { useQuery } from '@tanstack/react-query';
import {
  getLimiterCards, getLimiterRules, getLimiterHitTrend,
  getLimiterSummary, getLimiterViolations, getLimiterHistory,
} from '@/services/limiters.service';
import type { AnalyticsSource } from '@/types/analytics.contract';
import { useAppSettingsStore } from '@/store/appSettingsStore';
import { realtimeQueryPolicy } from '@/hooks/queryPolicy';

export const limiterKeys = {
  all:        ['rate-limiter-analytics'] as const,
  cards:      (s: AnalyticsSource) => [...limiterKeys.all, 'cards', s] as const,
  rules:      (s: AnalyticsSource) => [...limiterKeys.all, 'rules', s] as const,
  trend:      () => [...limiterKeys.all, 'trend']                   as const,
  summary:    (s: AnalyticsSource) => [...limiterKeys.all, 'summary', s] as const,
  violations: (id: string, s: AnalyticsSource) => [...limiterKeys.all, 'violations', id, s] as const,
  history:    (id: string) => [...limiterKeys.all, 'history', id]    as const,
};

const LIM_LIVE = { staleTime: 5_000, refetchInterval: 10_000, retry: 2 };
const LIM_SLOW = { staleTime: 30_000, refetchInterval: 30_000, retry: 1 };

export function useLimiterCards(source: AnalyticsSource = 'all') {
  const { pollingIntervalMs, realtimeEnabled } = useAppSettingsStore();
  // Don't use placeholderData - we want immediate updates on minute boundary changes
  return useQuery({ 
    queryKey: limiterKeys.cards(source), 
    queryFn: () => getLimiterCards(source), 
    ...LIM_LIVE, 
    ...realtimeQueryPolicy, 
    refetchInterval: realtimeEnabled ? Math.max(pollingIntervalMs, 10_000) : false 
  });
}
export function useLimiterRules(source: AnalyticsSource = 'all') {
  const { chartRefreshIntervalMs, realtimeEnabled } = useAppSettingsStore();
  return useQuery({ queryKey: limiterKeys.rules(source), queryFn: () => getLimiterRules(source), ...LIM_SLOW, ...realtimeQueryPolicy, refetchInterval: realtimeEnabled ? chartRefreshIntervalMs : false });
}
export function useLimiterHitTrend() {
  const { chartRefreshIntervalMs, realtimeEnabled } = useAppSettingsStore();
  return useQuery({ queryKey: limiterKeys.trend(), queryFn: getLimiterHitTrend, ...LIM_SLOW, ...realtimeQueryPolicy, refetchInterval: realtimeEnabled ? chartRefreshIntervalMs : false });
}
export function useLimiterSummary(source: AnalyticsSource = 'all') {
  const { chartRefreshIntervalMs, realtimeEnabled } = useAppSettingsStore();
  return useQuery({ queryKey: limiterKeys.summary(source), queryFn: () => getLimiterSummary(source), ...LIM_SLOW, ...realtimeQueryPolicy, refetchInterval: realtimeEnabled ? chartRefreshIntervalMs : false });
}

export function useLimiterViolations(limiterId: string, source: AnalyticsSource = 'all') {
  return useQuery({ queryKey: limiterKeys.violations(limiterId, source), queryFn: () => getLimiterViolations(limiterId, source), enabled: !!limiterId, ...LIM_LIVE, ...realtimeQueryPolicy });
}
export function useLimiterHistory(limiterId: string) {
  return useQuery({ queryKey: limiterKeys.history(limiterId), queryFn: () => getLimiterHistory(limiterId), enabled: !!limiterId, ...LIM_SLOW, ...realtimeQueryPolicy });
}
