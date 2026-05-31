import type { AnalyticsSource, CanonicalEndpoint } from '../types/analytics.types';
import { getLimiterMetadata } from '../config/limiterRegistry';

const EXACT_ENDPOINTS: Record<string, CanonicalEndpoint> = {
  '/': '/booking/create',
  '/booking': '/booking/create',
  '/booking/': '/booking/create',
  '/booking/create': '/booking/create',
  '/order': '/payment/order',
  '/payment/order': '/payment/order',
  '/verify': '/payment/verify',
  '/payment/verify': '/payment/verify',
  '/webhook': '/payment/webhook',
  '/payment/webhook': '/payment/webhook',
  '/login': '/auth/login',
  '/auth/login': '/auth/login',
  '/register': '/auth/register',
  '/auth/register': '/auth/register',
  '/reset-password': '/auth/reset-password',
  '/auth/reset-password': '/auth/reset-password',
  '/forgot-password': '/auth/forgot-password',
  '/auth/forgot-password': '/auth/forgot-password',
  'global': '/global',
  '/global': '/global',
  'default': '/unknown',
};

function cleanEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) return '/unknown';
  const withoutQuery = trimmed.split('?')[0]?.split('#')[0] ?? trimmed;
  const withSlash = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash;
}

export function normalizeEndpoint(endpoint: string): CanonicalEndpoint {
  const cleaned = cleanEndpoint(endpoint);
  const exact = EXACT_ENDPOINTS[cleaned];
  if (exact) return exact;

  if (cleaned.endsWith('/login')) return '/auth/login';
  if (cleaned.endsWith('/register')) return '/auth/register';
  if (cleaned.endsWith('/reset-password')) return '/auth/reset-password';
  if (cleaned.endsWith('/forgot-password')) return '/auth/forgot-password';
  if (cleaned.endsWith('/order')) return '/payment/order';
  if (cleaned.endsWith('/verify')) return '/payment/verify';
  if (cleaned.endsWith('/booking/create')) return '/booking/create';

  return '/unknown';
}

export function normalizeSourceValue(source: string | undefined, service: string | undefined): AnalyticsSource {
  const candidate = source === 'simulator' || source === 'quby' ? source : service;
  return candidate === 'simulator' ? 'simulator' : 'quby';
}

export function normalizeAction(endpoint: CanonicalEndpoint, action: string | undefined): string {
  const trimmed = action?.trim();
  if (trimmed && trimmed !== 'unknown') return trimmed;
  return getLimiterMetadata(endpoint).action;
}
