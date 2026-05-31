import { useEffect, useMemo, useRef } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';

export const realtimeQueryPolicy = {
  placeholderData: undefined,
  refetchOnMount: 'always' as const,
};

export const firstLoadOnlyQueryPolicy = {
  placeholderData: undefined,
  refetchOnMount: 'always' as const,
};

type HydrationQuery = Pick<UseQueryResult<unknown>, 'dataUpdatedAt' | 'isError' | 'isPending'>;

export function useInitialQueryHydration(queries: HydrationQuery[], identity: readonly unknown[] = []) {
  const mountedAtRef = useRef(Date.now());

  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, identity);

  return useMemo(() => {
    return queries.some((query) => {
      if (query.isError) return false;
      if (query.isPending || query.dataUpdatedAt === 0) return true;
      return false;
    });
  }, [queries]);
}
