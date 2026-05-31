import type {
  RedisHealthSnapshot, RedisMemoryTrend, RedisKeyGrowthPoint,
  RedisOpPoint, RedisLimiterPoint, RedisCommandStat,
  SlowCommand, LimiterStorageEntry, RedisMetrics,
} from '@/types/analytics.types';
import axios from 'axios';

async function fetchRedisHealthFromApi(): Promise<RedisHealthSnapshot> {
  const { data } = await axios.get('/api/v1/stats/redis-health');
  const raw = data.data;
  return {
    overallHealth:       raw.overallHealth        ?? 'Healthy',
    redisVersion:        raw.redisVersion          ?? '',
    uptime:              raw.uptime                ?? '',
    connectedClients:    raw.connectedClients       ?? 0,
    usedCpuPct:          raw.usedCpuPct             ?? 0,
    hitRatePct:          raw.hitRatePct             ?? 0,
    evictedKeys:         raw.evictedKeys            ?? 0,
    rejectedConnections: raw.rejectedConnections    ?? 0,
    usedMemoryMb:        raw.usedMemoryMb           ?? 0,
    freeMemoryMb:        raw.freeMemoryMb           ?? 0,
    maxMemoryMb:         raw.maxMemoryMb            ?? 0,
    totalKeys:           raw.totalKeys              ?? 0,
    expiringKeys:        raw.expiringKeys           ?? 0,
    persistentKeys:      raw.persistentKeys         ?? 0,
    avgTtlSec:           raw.avgTtlSec              ?? 0,
    commandThroughput:   raw.commandThroughput       ?? 0,
    requestWritesSec:    raw.requestWritesSec        ?? 0,
    activeLimiterKeys:   raw.activeLimiterKeys       ?? 0,
    services:            raw.services               ?? {
      server: 'Healthy', memory: 'Healthy', persistence: 'Healthy',
      replication: 'Healthy', latency: 'Optimal',
    },
  };
}

export async function getRedisHealth(): Promise<RedisHealthSnapshot> {
  return fetchRedisHealthFromApi();
}

export async function getRedisLimiterStorage(): Promise<LimiterStorageEntry[]> {
  const { data } = await axios.get('/api/v1/stats/redis-health');
  return data.data?.limiterStorage ?? [];
}

export async function getRedisCommandStats(): Promise<RedisCommandStat[]> {
  const { data } = await axios.get('/api/v1/stats/redis-health');
  return data.data?.commandStats ?? [];
}

export async function getRedisMemoryTrend(): Promise<RedisMemoryTrend[]> { return []; }
export async function getRedisKeyGrowth(): Promise<RedisKeyGrowthPoint[]> { return []; }
export async function getRedisOpsTrend(): Promise<RedisOpPoint[]> { return []; }
export async function getRedisLimiterCounters(): Promise<RedisLimiterPoint[]> { return []; }
export async function getRedisSlowCommands(): Promise<SlowCommand[]> { return []; }
export async function getRedisMetrics(): Promise<RedisMetrics> {
  return {
    status: { connected: false, memoryUsedMb: 0, totalKeys: 0, opsPerSec: 0 },
    memoryData: [],
    keyPatterns: [],
  };
}
