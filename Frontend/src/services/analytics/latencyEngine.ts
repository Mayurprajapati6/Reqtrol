import type { ActiveEndpoint } from './endpointRegistry';

const LATENCY_RANGES: Record<ActiveEndpoint, [number, number]> = {
  '/auth/login': [25, 35],
  '/booking/create': [4, 8],
  '/payment/order': [2, 5],
  '/payment/verify': [2, 5],
  '/auth/register': [2, 5],
  '/payment/webhook': [2, 5],
};

function hash(value: string): number {
  let n = 0;
  for (let i = 0; i < value.length; i += 1) n = (n * 31 + value.charCodeAt(i)) >>> 0;
  return n;
}

export function deterministicLatency(endpoint: ActiveEndpoint, salt = ''): number {
  const [min, max] = LATENCY_RANGES[endpoint];
  const span = max - min + 1;
  return min + (hash(`${endpoint}:${salt}`) % span);
}

export function deterministicP95Latency(endpoint: ActiveEndpoint): number {
  const [, max] = LATENCY_RANGES[endpoint];
  return max;
}
