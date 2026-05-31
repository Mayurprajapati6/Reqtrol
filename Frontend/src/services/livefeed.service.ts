import { fetchLiveFeed } from '@/api/client';
import type { ActivityEvent, LiveFeedWindow } from '@/types/analytics.types';
import type { AnalyticsSource } from '@/types/analytics.contract';
import { istDateKey, istTodayKey } from '@/utils/ist';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

function displayMethod(method?: string): string {
  const normalized = (method ?? 'POST').toUpperCase();
  return HTTP_METHODS.has(normalized) ? normalized : 'POST';
}

export async function getLiveFeedEvents(
  window: LiveFeedWindow = 15,
  limit = 200,
  source: AnalyticsSource = 'all',
): Promise<ActivityEvent[]> {
  const raw = await fetchLiveFeed(limit, source, window);
  const cutoff = Date.now() - window * 60 * 1000;
  return raw
    .map(r => ({
      id:         r._id,
      userId:     r.userId,
      userName:   r.userName ?? '',
      avatarUrl:  r.avatarUrl ?? undefined,
      endpoint:   r.endpoint,
      method:     displayMethod(r.method),
      limiterName: r.limiterName ?? 'No Limiter',
      limit:      r.limit ?? 0,
      remaining:  r.remaining ?? 0,
      resetIn:    r.resetIn ?? 0,
      allowed:    r.allowed,
      source:     r.source === 'simulator' ? 'simulator' as const : 'quby' as const,
      responseMs: r.responseTimeMs,
      timestamp:  r.timestamp,
    }))
    .filter(ev => window === 1440 ? istDateKey(ev.timestamp) === istTodayKey() : new Date(ev.timestamp).getTime() > cutoff);
}
