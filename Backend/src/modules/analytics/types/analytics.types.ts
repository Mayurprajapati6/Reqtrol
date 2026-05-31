export type AnalyticsSource = 'quby' | 'simulator';

export type CanonicalEndpoint =
  | '/auth/login'
  | '/auth/register'
  | '/auth/reset-password'
  | '/auth/forgot-password'
  | '/payment/order'
  | '/payment/verify'
  | '/booking/create'
  | '/payment/webhook'
  | '/global'
  | '/unknown';

export type EndpointHealth = 'healthy' | 'warning' | 'degraded' | 'critical';

export interface LimiterMetadata {
  endpoint: CanonicalEndpoint;
  limiterName: string;
  limit: number;
  max: number;
  windowMs: number;
  windowLabel: string;
  algorithm: 'Fixed Window' | 'Sliding Window';
  action: string;
  source: AnalyticsSource;
}

export interface AnalyticsEvent {
  analyticsId: string;
  requestId: string;
  fingerprint: string;
  trackedAt: Date;
  userId: string;
  userName: string;
  avatarUrl: string;
  endpoint: CanonicalEndpoint;
  action: string;
  method: string;
  ip: string;
  userAgent: string;
  allowed: boolean;
  reason: string | null;
  limit: number;
  remaining: number;
  resetIn: number;
  service: string;
  source: AnalyticsSource;
  algorithm: string;
  limiterName: string;
  limiterLimit: number;
  limiterWindowMs: number;
  responseTimeMs: number;
  statusCode: number;
  windowKey: string;
  timestamp: Date;
}

export interface EndpointAggregate {
  endpoint: CanonicalEndpoint;
  limiterName: string;
  action: string;
  source: AnalyticsSource | 'mixed';
  total: number;
  allowed: number;
  blocked: number;
  blockRate: number;
  avgResponseMs: number;
  riskScore: number;
  requestVelocity: number;
  severity: EndpointHealth;
  trendData: number[];
  spikeDetected: boolean;
}

export interface UserAggregate {
  userId: string;
  userName: string;
  avatarUrl: string;
  source: AnalyticsSource | 'mixed';
  favoriteEndpoint: CanonicalEndpoint | '';
  total: number;
  allowed: number;
  blocked: number;
  blockRate: number;
  lastSeen: string;
  riskScore: number;
  requestVelocity: number;
  severity: 'critical' | 'warning' | 'healthy';
  trendData: number[];
  suspiciousEvents: number;
}

export interface HistoricalBucket {
  label: string;
  start: Date;
  end: Date;
  endpoint?: CanonicalEndpoint;
  allowed: number;
  blocked: number;
  total: number;
}

export interface AnalyticsChartDto {
  id: string;
  endpoint: CanonicalEndpoint;
  label: CanonicalEndpoint;
  requests: number;
  blocked: number;
  allowed: number;
  blockRate: number;
  latency: number;
  p95Latency: number;
  limiterName: string;
  saturation: number;
  health: EndpointHealth;
  rank: number;
  distribution: number;
}

export interface LimiterAggregate {
  id: string;
  endpoint: CanonicalEndpoint;
  limiterName: string;
  requests: number;
  allowed: number;
  blocked: number;
  blockRate: number;
  limit: number;
  remaining: number;
  limiterLimit: number;
  limiterWindowMs: number;
  saturation: number;
  resetSeconds: number;
  health: 'healthy' | 'warning' | 'critical';
}

export interface AnalyticsSnapshotPayload {
  generatedAt: string;
  source: AnalyticsSource | 'all';
  endpoints: AnalyticsChartDto[];
  limiters: LimiterAggregate[];
  activeEndpointCount: number;
  busiestEndpoints: AnalyticsChartDto[];
  endpointPressure: AnalyticsChartDto[];
  requestDistribution: AnalyticsChartDto[];
}
