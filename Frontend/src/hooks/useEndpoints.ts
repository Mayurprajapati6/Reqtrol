import { useQuery } from '@tanstack/react-query';
import {
  getEndpointCards, getEndpointStats, getEndpointPressureChart,
  getEndpointHeatmap,
} from '@/services/endpoints.service';
import type { AnalyticsSource } from '@/types/analytics.contract';
import { realtimeQueryPolicy } from '@/hooks/queryPolicy';

export const endpointKeys = {
  all:           ['endpoint-analytics'] as const,
  cards:         (s: AnalyticsSource) => [...endpointKeys.all, 'cards', s]    as const,
  stats:         (s: AnalyticsSource) => [...endpointKeys.all, 'stats', s]    as const,
  pressure:      (s: AnalyticsSource) => [...endpointKeys.all, 'pressure', s] as const,
  heatmap:       (s: AnalyticsSource, date?: string) => [...endpointKeys.all, 'heatmap', s, date]  as const,
};

const EP_LIVE = { staleTime: 4_000, refetchInterval: 5_000, retry: 2 };
const EP_SLOW = { staleTime: 20_000, refetchInterval: 30_000, retry: 1 };

export function useEndpointCards(source: AnalyticsSource = 'all')         { return useQuery({ queryKey: endpointKeys.cards(source),         queryFn: () => getEndpointCards(source),         ...EP_LIVE, ...realtimeQueryPolicy }); }
export function useEndpointStats(source: AnalyticsSource = 'all')         { return useQuery({ queryKey: endpointKeys.stats(source),         queryFn: () => getEndpointStats(source),         ...EP_LIVE, ...realtimeQueryPolicy }); }
export function useEndpointPressureChart(source: AnalyticsSource = 'all') { return useQuery({ queryKey: endpointKeys.pressure(source),      queryFn: () => getEndpointPressureChart(source), ...EP_LIVE, ...realtimeQueryPolicy }); }
export function useEndpointHeatmap(source: AnalyticsSource = 'all', selectedDate?: string)       { return useQuery({ queryKey: endpointKeys.heatmap(source, selectedDate),       queryFn: () => getEndpointHeatmap(source, selectedDate),       ...EP_SLOW, ...realtimeQueryPolicy }); }
