import { useState, useCallback, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UsePaginatedQueryOptions {
  queryKey: unknown[];
  table: string;
  select?: string;
  filters?: (query: any) => any;
  orderBy?: { column: string; ascending?: boolean };
  pageSize?: number;
  enabled?: boolean;
}

interface PaginatedResult<T> {
  data: T[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  refetch: () => void;
}

export function usePaginatedQuery<T = any>({
  queryKey,
  table,
  select = '*',
  filters,
  orderBy = { column: 'created_at', ascending: false },
  pageSize = 25,
  enabled = true,
}: UsePaginatedQueryOptions): PaginatedResult<T> {
  const [page, setPage] = useState(0);

  // Count query
  const { data: countData } = useQuery({
    queryKey: [...queryKey, 'count'],
    queryFn: async () => {
      let query = supabase.from(table).select('*', { count: 'exact', head: true });
      if (filters) query = filters(query);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    enabled,
    staleTime: 30_000,
  });

  const totalCount = countData ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Data query
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [...queryKey, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from(table)
        .select(select)
        .order(orderBy.column, { ascending: orderBy.ascending ?? false })
        .range(from, to);
      if (filters) query = filters(query);
      const { data, error } = await query;
      if (error) throw error;
      return (data as T[]) ?? [];
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const goToPage = useCallback((p: number) => {
    setPage(Math.max(0, Math.min(p, totalPages - 1)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setPage(p => Math.min(p + 1, totalPages - 1));
  }, [totalPages]);

  const previousPage = useCallback(() => {
    setPage(p => Math.max(p - 1, 0));
  }, []);

  return {
    data: data ?? [],
    isLoading,
    isFetching,
    error: error as Error | null,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages - 1,
    hasPreviousPage: page > 0,
    goToPage,
    nextPage,
    previousPage,
    refetch,
  };
}
