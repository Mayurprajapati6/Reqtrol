import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30 s default stale time — individual hooks override this
      staleTime:             30_000,
      // Keep unused cache for 5 min
      gcTime:            60_000,         // 1 min — prevent stale cross-page cache pollution
      // Retry twice on failure before showing error state
      retry:                 2,
      retryDelay:            (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      // Do NOT refetch just because user switched tabs — prevents duplicate burst
      refetchOnWindowFocus:  false,
      // Do NOT refetch on reconnect by default (polling handles it)
      refetchOnReconnect:    false,
    },
  },
});
