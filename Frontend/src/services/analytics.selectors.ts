import type { EndpointStat, UserStat } from '@/api/client';
import type { AnalyticsSource } from '@/types/analytics.contract';

export function safePct(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function inversePct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round((100 - value) * 10) / 10);
}

export function limiterUsagePct(used: number, total: number): number {
  return Math.min(100, safePct(used, total));
}

export function endpointHealth(blockRate: number): 'healthy' | 'degraded' | 'critical' {
  if (blockRate >= 35) return 'critical';
  if (blockRate >= 20) return 'degraded';
  return 'healthy';
}

export function limiterHealth(usagePct: number, blockRate: number): 'healthy' | 'warning' | 'critical' {
  if (usagePct >= 92 || blockRate >= 50) return 'critical';
  if (usagePct >= 75 || blockRate >= 25) return 'warning';
  return 'healthy';
}

export function topFive<T>(items: T[]): Array<T | null> {
  return Array.from({ length: 5 }, (_, index) => items[index] ?? null);
}

export function sourceMatches(source: AnalyticsSource, itemSource?: 'quby' | 'simulator'): boolean {
  return source === 'all' || itemSource === source;
}

export function endpointTotals(rows: EndpointStat[]) {
  return rows.reduce((sum, endpoint) => sum + endpoint.total, 0);
}

export function userTotals(rows: UserStat[]) {
  return rows.reduce(
    (acc, user) => ({
      requests: acc.requests + user.total,
      blocked: acc.blocked + user.blocked,
    }),
    { requests: 0, blocked: 0 },
  );
}

