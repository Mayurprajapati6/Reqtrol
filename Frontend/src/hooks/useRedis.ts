import { useQuery } from '@tanstack/react-query';
import {
  getRedisHealth, getRedisMemoryTrend, getRedisKeyGrowth,
  getRedisOpsTrend, getRedisLimiterCounters, getRedisCommandStats,
  getRedisSlowCommands, getRedisLimiterStorage, getRedisMetrics,
} from '@/services/redis.service';

export const redisKeys = {
  all:             ['redis'] as const,
  health:          () => [...redisKeys.all, 'health']      as const,
  memoryTrend:     () => [...redisKeys.all, 'memTrend']    as const,
  keyGrowth:       () => [...redisKeys.all, 'keyGrowth']   as const,
  opsTrend:        () => [...redisKeys.all, 'opsTrend']    as const,
  limiterCounters: () => [...redisKeys.all, 'limCounters'] as const,
  cmdStats:        () => [...redisKeys.all, 'cmdStats']    as const,
  slowCmds:        () => [...redisKeys.all, 'slowCmds']    as const,
  limiterStorage:  () => [...redisKeys.all, 'limStorage']  as const,
  metrics:         () => [...redisKeys.all, 'metrics']     as const,
};

const REDIS_LIVE  = { staleTime:  5_000, refetchInterval: 10_000, retry: 2 };
const REDIS_TREND = { staleTime: 15_000, refetchInterval: 20_000, retry: 1 };
const REDIS_HIST  = { staleTime: 30_000, refetchInterval: 60_000, retry: 1 };

export function useRedisHealth()          { return useQuery({ queryKey: redisKeys.health(),          queryFn: getRedisHealth,          ...REDIS_LIVE  }); }
export function useRedisMemoryTrend()     { return useQuery({ queryKey: redisKeys.memoryTrend(),     queryFn: getRedisMemoryTrend,     ...REDIS_HIST  }); }
export function useRedisKeyGrowth()       { return useQuery({ queryKey: redisKeys.keyGrowth(),       queryFn: getRedisKeyGrowth,       ...REDIS_HIST  }); }
export function useRedisOpsTrend()        { return useQuery({ queryKey: redisKeys.opsTrend(),        queryFn: getRedisOpsTrend,        ...REDIS_TREND }); }
export function useRedisLimiterCounters() { return useQuery({ queryKey: redisKeys.limiterCounters(), queryFn: getRedisLimiterCounters, ...REDIS_TREND }); }
export function useRedisCommandStats()    { return useQuery({ queryKey: redisKeys.cmdStats(),        queryFn: getRedisCommandStats,    ...REDIS_LIVE  }); }
export function useRedisSlowCommands()    { return useQuery({ queryKey: redisKeys.slowCmds(),        queryFn: getRedisSlowCommands,    ...REDIS_TREND }); }
export function useRedisLimiterStorage()  { return useQuery({ queryKey: redisKeys.limiterStorage(),  queryFn: getRedisLimiterStorage,  ...REDIS_TREND }); }
export function useRedisMetrics()         { return useQuery({ queryKey: redisKeys.metrics(),         queryFn: getRedisMetrics,         ...REDIS_LIVE  }); }
