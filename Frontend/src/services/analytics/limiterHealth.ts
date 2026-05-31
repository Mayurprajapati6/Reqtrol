export type LimiterHealth = 'healthy' | 'warning' | 'critical';
export type EndpointHealth = 'healthy' | 'warning' | 'degraded' | 'critical';

export function limiterHealth(usage: number): LimiterHealth {
  if (usage >= 90) return 'critical';
  if (usage >= 70) return 'warning';
  return 'healthy';
}

export function endpointHealth(blockRate: number, usage: number): EndpointHealth {
  if (usage >= 90 || blockRate >= 35) return 'critical';
  if (usage >= 70 || blockRate >= 20) return 'warning';
  return 'healthy';
}
