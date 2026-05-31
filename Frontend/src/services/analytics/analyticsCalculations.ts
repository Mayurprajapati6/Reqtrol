import type { ActiveEndpoint } from './endpointRegistry';
import { ENDPOINT_REGISTRY } from './endpointRegistry';

export function pct(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function blockedRate(blocked: number, totalRequests: number): number {
  return pct(blocked, totalRequests);
}

export function allowedCount(totalRequests: number, blocked: number): number {
  return Math.max(0, totalRequests - blocked);
}

export function limiterUsed(endpoint: ActiveEndpoint, requests: number, remaining?: number): number {
  const limit = ENDPOINT_REGISTRY[endpoint].limit;
  if (!limit) return 0;
  if (Number.isFinite(remaining)) return Math.max(0, Math.min(limit, limit - Math.max(0, remaining ?? limit)));
  return Math.max(0, Math.min(limit, requests));
}

export function limiterRemaining(endpoint: ActiveEndpoint, used: number): number {
  const limit = ENDPOINT_REGISTRY[endpoint].limit;
  if (!limit) return 0;
  return Math.max(0, limit - used);
}

export function limiterUsage(endpoint: ActiveEndpoint, used: number): number {
  const limit = ENDPOINT_REGISTRY[endpoint].limit;
  return limit ? pct(used, limit) : 0;
}

export function distribution(requests: number, totalRequests: number): number {
  return pct(requests, totalRequests);
}
