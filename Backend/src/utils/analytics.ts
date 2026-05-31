export type AnalyticsSource = 'all' | 'quby' | 'simulator';
export type AnalyticsScope = 'global' | 'window';

export interface AnalyticsQuery {
  scope: AnalyticsScope;
  source: AnalyticsSource;
  windowMinutes?: number;
}

export const IST_TIMEZONE = 'Asia/Kolkata';

export function normalizeSource(value: unknown): AnalyticsSource {
  return value === 'quby' || value === 'simulator' ? value : 'all';
}

export function windowQuery(windowMinutes: number, source: AnalyticsSource = 'all'): AnalyticsQuery {
  return { scope: 'window', windowMinutes, source };
}

export function globalQuery(source: AnalyticsSource = 'all'): AnalyticsQuery {
  return { scope: 'global', source };
}

export function matchFor(query: AnalyticsQuery): Record<string, unknown> {
  const match: Record<string, unknown> = {};
  if (query.scope === 'window' && query.windowMinutes) {
    match.timestamp = { $gte: new Date(Date.now() - query.windowMinutes * 60 * 1000) };
  }
  if (query.source !== 'all') {
    match.source = query.source;
  }
  return match;
}

export function percentage(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function perSecond(total: number, windowMinutes?: number): number {
  if (!windowMinutes || windowMinutes <= 0 || total <= 0) return 0;
  return Math.round((total / (windowMinutes * 60)) * 10) / 10;
}

export const mongoISTDateParts = (field = '$timestamp') => ({
  year: { $year: { date: field, timezone: IST_TIMEZONE } },
  month: { $month: { date: field, timezone: IST_TIMEZONE } },
  day: { $dayOfMonth: { date: field, timezone: IST_TIMEZONE } },
  hour: { $hour: { date: field, timezone: IST_TIMEZONE } },
  minute: { $minute: { date: field, timezone: IST_TIMEZONE } },
});

