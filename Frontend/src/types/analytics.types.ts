/**
 * analytics.types.ts
 *
 * Central DTO (Data Transfer Object) definitions for all Reqtrol analytics data.
 * These types represent the CONTRACT between the service layer and the UI layer.
 *
 * Structure:
 *   Mock Layer  → services/ → hooks/ → UI (pages/components)
 *
 * When the real backend is connected, only services/ needs to change.
 * These types remain identical — the UI never changes.
 */

// ─── API response wrapper ─────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data:    T;
  error?:  string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

/** Aggregate counts shown in the 4 hero MetricCards */
export interface DashboardOverview {
  totalRequests: number;
  allowedCount:  number;
  blockedCount:  number;
  blockRate:     number;   // 0–100 percentage
  avgResponseMs: number;
  activeUsers:   number;
  throughput:    number;   // req/sec
  uptime:        number;   // hours
}

/** One point in the Requests-Over-Time area chart */
export interface TimelinePoint {
  label:   string;   // display label: "18 May", "10:00", etc.
  allowed: number;
  blocked: number;
  total:   number;
}

/** One bar in the Top Endpoints horizontal bar chart */
export interface EndpointChartItem {
  name:     string;   // short display name (e.g. "POST /auth/login")
  endpoint: string;   // full endpoint path
  value:    number;   // total request count
  color:    string;   // hex accent color
}

/** One point in the Request Sources (backend-reported sources) stacked area chart */
export interface SourceChartPoint {
  time:      string;
  quby:      number;
  simulator: number;
}

/** A single event in the Recent Activity feed (Dashboard + Live Feed) */
export interface ActivityEvent {
  id:          string;
  userId:      string;
  userName:    string;
  avatarUrl?:  string;
  endpoint:    string;
  method:      string;   // GET | POST | PUT | DELETE | PATCH
  limiterName?: string;
  limit?:       number;
  remaining?:   number;
  resetIn?:     number;
  allowed:     boolean;
  source:      'quby' | 'simulator';
  responseMs:  number;
  timestamp:   string;   // ISO 8601
}

/** System health summary (right panel on Dashboard) */
export interface SystemOverview {
  redisStatus:        'healthy' | 'degraded' | 'error' | 'unknown';
  apiServerStatus:    'healthy' | 'degraded' | 'error' | 'unknown';
  databaseStatus:     'healthy' | 'degraded' | 'error' | 'unknown';
  totalLimiterHits:   number;
  avgResponseMs:      number;
  activeEndpoints:    number;
}

// ─── Live Feed ────────────────────────────────────────────────────────────────

/** Time window for Live Feed (only page that uses windowed data) */
export type LiveFeedWindow = 15 | 30 | 1440;

// ─── Rate Limiters ────────────────────────────────────────────────────────────

/** One active rate limiter rule row */
export interface LimiterRule {
  id:        string;
  rule:      string;   // human-readable label (e.g. "Login (IP)")
  hits:      number;   // total hits today
  blocked:   number;   // blocked hits today
  window:    string;   // "15m" | "1h" | "24h" | "1d"
  limit:     number;   // req limit per window
  color:     string;   // hex accent color
}

/** One bar in the Limiter Hits Today bar chart */
export interface HitTrendPoint {
  time: string;
  hits: number;
}

/** Summary stats for the Rate Limiters page header */
export interface LimiterSummary {
  activeRules:  number;
  totalHits:    number;
  totalBlocked: number;
  avgWindow:    string;
}

/** Rich per-limiter card (used by the Rate Limiters detail page) */
export interface LimiterCard {
  id:             string;
  name:           string;
  endpoint:       string;    // e.g. "POST /api/auth/login"
  used:           number;
  total:          number;    // window request limit
  remaining:      number;
  blockRate:      number;    // 0–100 percentage
  saturation:     number;
  resetAt:        number;    // timestamp when window resets
  bucketStart:    number;    // unix ms — start of clock-aligned bucket
  bucketEnd:      number;    // unix ms — end of clock-aligned bucket
  reqSec:         number;    // rolling 10s average req/sec
  reqMin:         number;    // total requests in current 60s bucket
  color:          string;    // neon hex accent
  icon:           string;    // emoji icon
  health:         'healthy' | 'warning' | 'critical';
  isActive:       boolean;
  algorithm:      'Fixed Window' | 'Sliding Window' | 'Token Bucket';
  windowLabel:    string;    // "1m" | "5m" | "15m" | "1h"
  totalHitsToday: number;
  blockedToday:   number;
}

/** One violation event (for limiter detail modal) */
export interface LimiterViolation {
  id:        string;
  userId:    string;
  ip:        string;
  timestamp: string;
  endpoint:  string;
  reason:    string;
}

/** One point in a limiter's request history chart (for modal) */
export interface LimiterHistoryPoint {
  time:    string;
  allowed: number;
  blocked: number;
}

// ─── Endpoint Analytics ───────────────────────────────────────────────────────

/** One row in the Endpoint Detail table (simple) */
export interface EndpointStat {
  endpoint:  string;
  requests:  number;
  blocked:   number;
  avgMs:     number;
  p99Ms:     number;
  blockRate: number;
}

/** Rich per-endpoint card data for the Endpoint Analytics page */
export interface EndpointCardData {
  id:              string;
  path:            string;     // '/login'
  fullPath:        string;     // '/api/auth/login'
  label:           string;     // 'Login Endpoint'
  icon:            string;     // emoji
  method:          string;     // 'POST'
  color:           string;     // neon hex
  requests:        number;
  allowed:         number;
  blocked:         number;
  blockRate:       number;
  avgMs:           number;
  p95Ms:           number;
  limiterName:     string;
  limiterUsagePct: number;     // 0–100
  limiterCapacity?: number;
  health:          'healthy' | 'warning' | 'degraded' | 'critical';
  distribution:    number;     // % of total traffic
  sparkData:       number[];   // mini sparkline values
}

/** One row in the endpoint heatmap (hour bucket × 6 endpoints) */
export interface HeatmapRow {
  hour:   string;
  values: Record<string, number>; // endpoint id → intensity 0–100
}

/** One point in the 7-day endpoint pressure chart */
export interface PressureTimePoint {
  date:     string;
  login:    number;
  register: number;
  booking:  number;
  payment:  number;
  reviews:  number;
  scan:     number;
}

/** One bar in the Endpoint Pressure chart */
export interface PressureChartPoint {
  name:     string;   // short endpoint name
  requests: number;
  blocked:  number;
}

// ─── User Activity ────────────────────────────────────────────────────────────

/** Simple row (legacy / backward compat) */
export interface UserStat {
  userId:    string;
  userName?: string;
  total:     number;
  allowed:   number;
  blocked:   number;
  blockRate: number;
  severity:  'critical' | 'warning' | 'healthy';
  lastSeen:  string;
}

/** Rich per-user record for the User Activity page */
export interface UserActivity {
  userId:           string;
  userName:         string;
  email:            string;
  avatarUrl?:       string;
  source:           'quby' | 'simulator';
  total:            number;
  allowed:          number;
  blocked:          number;
  blockRate:        number;
  favoriteEndpoint: string;
  lastSeen:         string;
  isActive:         boolean;
  severity:         'healthy' | 'warning' | 'critical';
  sparkData:        number[];
}

/** One event in the User Activity Timeline */
export interface UserTimelineEvent {
  id:        string;
  userId:    string;
  userName:  string;
  avatarUrl?: string;
  source:    'quby' | 'simulator';
  endpoint:  string;
  method:    string;
  limiterName?: string;
  responseMs?: number;
  allowed:   boolean;
  timestamp: string;
}

/** One point in the 7-day User Request Frequency chart */
export interface UserFrequencyPoint {
  date:      string;
  realUsers: number;
  simUsers:  number;
}

/** Summary stats for User Activity page header cards */
export interface UserSummary {
  totalUsers:       number;
  totalRequests:    number;
  blockedRequests:  number;
  activeEndpoints:  number;
  highRiskUsers:    number;
  fullyAllowed:     number;
}

/** One segment in the endpoint usage breakdown donut */
export interface EndpointUsageSlice {
  name:  string;
  pct:   number;
  color: string;
}

// ─── Redis Monitor ────────────────────────────────────────────────────────────

/** Redis connection + performance status (legacy) */
export interface RedisStatus {
  connected:    boolean;
  memoryUsedMb: number;
  totalKeys:    number;
  opsPerSec:    number;
}

/** One point in the Redis Memory Usage area chart (legacy) */
export interface RedisMemoryPoint {
  time: string;
  used: number;   // MB
}

/** One key pattern row in the Redis Key Patterns table (legacy) */
export interface RedisKeyPattern {
  key:   string;
  count: number;
  ttl:   string;
  type:  'Rate Limiter' | 'Session' | 'Cache';
}

/** Full Redis metrics snapshot (legacy) */
export interface RedisMetrics {
  status:      RedisStatus;
  memoryData:  RedisMemoryPoint[];
  keyPatterns: RedisKeyPattern[];
}

// ── Rich Redis Monitor types ─────────────────────────────────────────────────

/** One point in the 7-day memory chart */
export interface RedisMemoryTrend {
  date: string;
  mb:   number;
}

/** One point in the 7-day key growth chart */
export interface RedisKeyGrowthPoint {
  date: string;
  keys: number;
}

/** One point in the Redis operations chart (commands/sec per type) */
export interface RedisOpPoint {
  date:   string;
  GET:    number;
  SET:    number;
  DEL:    number;
  EXPIRE: number;
  INCR:   number;
}

/** One point in the limiter counter activity chart */
export interface RedisLimiterPoint {
  date:             string;
  loginLimiter:     number;
  registerLimiter:  number;
  bookingLimiter:   number;
  paymentLimiter:   number;
  others:           number;
}

/** One row in the Real-time Command Stats table */
export interface RedisCommandStat {
  command: string;
  color:   string;
  opsPerSec: number;
  pctTotal:  number;
  sparkData: number[];
}

/** One row in the Slowest Commands table */
export interface SlowCommand {
  command:   string;
  avgMs:     number;
  callsSec:  number;
}

/** One row in the Limiter Storage Overview (right sidebar) */
export interface LimiterStorageEntry {
  name:  string;
  color: string;
  keys:  number;   // absolute key count
  pct:   number;   // % of total limiter keys
}

/** Comprehensive Redis health + info snapshot */
export interface RedisHealthSnapshot {
  overallHealth:       'Healthy' | 'Degraded' | 'Error';
  redisVersion:        string;
  uptime:              string;
  connectedClients:    number;
  usedCpuPct:          number;
  hitRatePct:          number;
  evictedKeys:         number;
  rejectedConnections: number;
  usedMemoryMb:        number;
  freeMemoryMb:        number;
  maxMemoryMb:         number;
  totalKeys:           number;
  expiringKeys:        number;
  persistentKeys:      number;
  avgTtlSec:           number;
  commandThroughput:   number;
  requestWritesSec:    number;
  activeLimiterKeys:   number;
  services: {
    server:      'Healthy' | 'Degraded' | 'Error';
    memory:      'Healthy' | 'Degraded' | 'Error';
    persistence: 'Healthy' | 'Degraded' | 'Error';
    replication: 'Healthy' | 'Degraded' | 'Error';
    latency:     'Optimal' | 'Degraded' | 'Error';
  };
}
