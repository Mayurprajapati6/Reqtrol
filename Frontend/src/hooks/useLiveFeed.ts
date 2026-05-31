import { useQuery } from '@tanstack/react-query';
import { getLiveFeedEvents } from '@/services/livefeed.service';
import type { LiveFeedWindow } from '@/types/analytics.types';
import type { AnalyticsSource } from '@/types/analytics.contract';
import { useAppSettingsStore } from '@/store/appSettingsStore';
import { firstLoadOnlyQueryPolicy } from '@/hooks/queryPolicy';

export const liveFeedKeys = {
  all:    ['live-feed'] as const,
  events: (window: LiveFeedWindow, limit: number, source: AnalyticsSource) =>
    [...liveFeedKeys.all, 'events', window, limit, source] as const,
};

export function useLiveFeedEvents(
  window: LiveFeedWindow = 15,
  limit  = 200,
  paused = false,
  source: AnalyticsSource = 'all',
) {
  const { pollingIntervalMs, realtimeEnabled } = useAppSettingsStore();
  return useQuery({
    queryKey: liveFeedKeys.events(window, limit, source),
    queryFn:  () => getLiveFeedEvents(window, limit, source),
    enabled:  !paused && realtimeEnabled,
    staleTime: 900,
    ...firstLoadOnlyQueryPolicy,
    refetchInterval: paused || !realtimeEnabled ? false : Math.min(pollingIntervalMs, 1000),
  });
}
