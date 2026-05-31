export type AnalyticsSource = 'all' | 'quby' | 'simulator';
export type AnalyticsScope = 'global' | 'window';
export type AnalyticsWindow = 15 | 30 | 1440;
export type DashboardChartWindow = 15 | 30 | 1440;
export type DashboardSourceWindow = 7;

export interface AnalyticsQuery {
  scope: AnalyticsScope;
  source: AnalyticsSource;
  windowMinutes?: number;
}

export const GLOBAL_ANALYTICS: AnalyticsQuery = { scope: 'global', source: 'all' };
export const DASHBOARD_KPI_QUERY: AnalyticsQuery = { scope: 'window', windowMinutes: 15, source: 'all' };

export function withSource(query: AnalyticsQuery, source: AnalyticsSource): AnalyticsQuery {
  return { ...query, source };
}

export function windowQuery(windowMinutes: AnalyticsWindow, source: AnalyticsSource = 'all'): AnalyticsQuery {
  return { scope: 'window', windowMinutes, source };
}

export function globalQuery(source: AnalyticsSource = 'all'): AnalyticsQuery {
  return { scope: 'global', source };
}
