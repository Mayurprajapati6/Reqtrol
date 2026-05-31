import { fetchLimitsConfig, fetchLimiters, fetchRichBlocked, type LimiterAgg } from '@/api/client';
import type {
  LimiterCard, LimiterRule, HitTrendPoint, LimiterSummary,
  LimiterViolation, LimiterHistoryPoint,
} from '@/types/analytics.types';
import type { AnalyticsSource } from '@/types/analytics.contract';
import { limiterCardsFromBackend } from '@/services/analytics/chartTransformers';

export async function getLimiterCards(source: AnalyticsSource = 'all'): Promise<LimiterCard[]> {
  const [configs, agg] = await Promise.all([fetchLimitsConfig(), fetchLimiters(source)]);
  return limiterCardsFromBackend(configs, agg as LimiterAgg[]);
}

export async function getLimiterRules(source: AnalyticsSource = 'all'): Promise<LimiterRule[]> {
  const cards = await getLimiterCards(source);
  return cards.map(c => ({
    id: c.id, rule: c.name, hits: c.totalHitsToday, blocked: c.blockedToday,
    window: c.windowLabel, limit: c.total, color: c.color,
  }));
}

export async function getLimiterHitTrend(): Promise<HitTrendPoint[]> {
  return [];
}

export async function getLimiterSummary(source: AnalyticsSource = 'all'): Promise<LimiterSummary> {
  const cards = await getLimiterCards(source);
  return {
    activeRules:  cards.length,
    totalHits:    cards.reduce((s, c) => s + c.totalHitsToday, 0),
    totalBlocked: cards.reduce((s, c) => s + c.blockedToday, 0),
    avgWindow:    '',
  };
}

export async function getLimiterViolations(limiterId: string, source: AnalyticsSource = 'all'): Promise<LimiterViolation[]> {
  const rich = await fetchRichBlocked(100, source);
  const separatorIndex = limiterId.indexOf(':');
  const name = separatorIndex >= 0 ? limiterId.slice(0, separatorIndex) : limiterId;
  const endpoint = separatorIndex >= 0 ? limiterId.slice(separatorIndex + 1) : '';
  return rich
    .filter(e => e.limiterName === name && (!endpoint || e.endpoint === endpoint))
    .map((e, i) => ({
      id:        e._id ?? `v${i}`,
      userId:    e.userId,
      ip:        e.ip,
      timestamp: e.timestamp,
      endpoint:  e.endpoint,
      reason:    e.reason,
    }));
}

export async function getLimiterHistory(limiterId: string): Promise<LimiterHistoryPoint[]> {
  void limiterId;
  return [];
}
