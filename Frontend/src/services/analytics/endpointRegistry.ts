export type ActiveEndpoint =
  | '/payment/order'
  | '/auth/login'
  | '/booking/create'
  | '/auth/register'
  | '/payment/verify'
  | '/payment/webhook';

export interface EndpointRegistryEntry {
  endpoint: ActiveEndpoint;
  label: string;
  icon: string;
  color: string;
  method: 'POST';
  limiterName: string;
  limit: number | null;
  windowMs: number;
  windowLabel: string;
  algorithm: 'Fixed Window' | 'Sliding Window' | 'None';
}

export const ACTIVE_ENDPOINTS: ActiveEndpoint[] = [
  '/payment/order',
  '/auth/login',
  '/booking/create',
  '/auth/register',
  '/payment/verify',
  '/payment/webhook',
];

export const ENDPOINT_REGISTRY: Record<ActiveEndpoint, EndpointRegistryEntry> = {
  '/payment/order': {
    endpoint: '/payment/order',
    label: 'Payment Order',
    icon: 'O',
    color: '#06b6d4',
    method: 'POST',
    limiterName: 'paymentOrderLimiter',
    limit: 10,
    windowMs: 60_000,
    windowLabel: '1m',
    algorithm: 'Sliding Window',
  },
  '/auth/login': {
    endpoint: '/auth/login',
    label: 'Auth Login',
    icon: 'L',
    color: '#3b82f6',
    method: 'POST',
    limiterName: 'loginLimiter',
    limit: 5,
    windowMs: 60_000,
    windowLabel: '1m',
    algorithm: 'Fixed Window',
  },
  '/booking/create': {
    endpoint: '/booking/create',
    label: 'Booking Create',
    icon: 'B',
    color: '#f59e0b',
    method: 'POST',
    limiterName: 'bookingLimiter',
    limit: 3,
    windowMs: 60_000,
    windowLabel: '1m',
    algorithm: 'Sliding Window',
  },
  '/auth/register': {
    endpoint: '/auth/register',
    label: 'Auth Register',
    icon: 'R',
    color: '#8b5cf6',
    method: 'POST',
    limiterName: 'registerLimiter',
    limit: 5,
    windowMs: 60_000,
    windowLabel: '1m',
    algorithm: 'Fixed Window',
  },
  '/payment/verify': {
    endpoint: '/payment/verify',
    label: 'Payment Verify',
    icon: 'V',
    color: '#10b981',
    method: 'POST',
    limiterName: 'paymentVerifyLimiter',
    limit: 10,
    windowMs: 60_000,
    windowLabel: '1m',
    algorithm: 'Sliding Window',
  },
  '/payment/webhook': {
    endpoint: '/payment/webhook',
    label: 'Payment Webhook',
    icon: 'W',
    color: '#14b8a6',
    method: 'POST',
    limiterName: 'No Limiter',
    limit: null,
    windowMs: 60_000,
    windowLabel: '1m',
    algorithm: 'None',
  },
};

const ENDPOINT_ALIASES: Record<string, ActiveEndpoint> = {
  '/order': '/payment/order',
  '/payment/order': '/payment/order',
  '/login': '/auth/login',
  '/auth/login': '/auth/login',
  '/booking': '/booking/create',
  '/booking/': '/booking/create',
  '/booking/create': '/booking/create',
  '/': '/booking/create',
  '/register': '/auth/register',
  '/auth/register': '/auth/register',
  '/verify': '/payment/verify',
  '/payment/verify': '/payment/verify',
  '/webhook': '/payment/webhook',
  '/payment/webhook': '/payment/webhook',
};

export function normalizeEndpoint(endpoint?: string): ActiveEndpoint | null {
  if (!endpoint) return null;
  const cleaned = endpoint.split('?')[0].replace(/\/+$/, '') || '/';
  return ENDPOINT_ALIASES[cleaned] ?? null;
}

export function endpointMeta(endpoint?: string): EndpointRegistryEntry | null {
  const normalized = normalizeEndpoint(endpoint);
  return normalized ? ENDPOINT_REGISTRY[normalized] : null;
}
