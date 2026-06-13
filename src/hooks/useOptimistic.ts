import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { formatLKR } from '@/lib/formatters';

interface OptimisticState<T> {
  data: T;
  isPending: boolean;
  error: Error | null;
}

/**
 * Hook for optimistic UI updates with automatic rollback on error.
 * Provides immediate feedback before server confirmation.
 */
export function useOptimistic<T>(initialData: T) {
  const [state, setState] = useState<OptimisticState<T>>({
    data: initialData,
    isPending: false,
    error: null,
  });

  const createOptimisticUpdate = useCallback(
    async <R,>(
      optimisticValue: T,
      asyncFn: () => Promise<R>,
      options?: {
        successMessage?: string;
        errorMessage?: string;
        onSuccess?: (result: R) => void;
        onError?: (error: Error) => void;
      }
    ): Promise<R | null> => {
      // Immediately update UI optimistically
      setState({
        data: optimisticValue,
        isPending: true,
        error: null,
      });

      try {
        const result = await asyncFn();
        
        setState({
          data: optimisticValue,
          isPending: false,
          error: null,
        });

        if (options?.successMessage) {
          toast.success(options.successMessage);
        }
        
        options?.onSuccess?.(result);
        return result;
      } catch (error) {
        // Rollback to initial data on error
        setState({
          data: initialData,
          isPending: false,
          error: error as Error,
        });

        const errorMessage = options?.errorMessage || 'Operation failed';
        toast.error(errorMessage);
        
        options?.onError?.(error as Error);
        return null;
      }
    },
    [initialData]
  );

  return {
    ...state,
    createOptimisticUpdate,
  };
}

/**
 * Optimistic feedback utilities for common actions.
 * Shows immediate UI feedback before server confirmation.
 */
export const optimisticFeedback = {
  bookingCreated: () => {
    const id = toast.loading('Creating booking...');
    return {
      success: () => toast.success('Booking created successfully', { id }),
      error: (msg?: string) => toast.error(msg || 'Failed to create booking', { id }),
    };
  },
  
  statusChanged: (newStatus: string) => {
    const id = toast.loading(`Updating to ${newStatus}...`);
    return {
      success: () => toast.success(`Status updated to ${newStatus}`, { id }),
      error: (msg?: string) => toast.error(msg || 'Failed to update status', { id }),
    };
  },
  
  paymentRecorded: (amount: number) => {
    const id = toast.loading(`Recording payment of ${formatLKR(amount)}...`);
    return {
      success: () => toast.success('Payment recorded successfully', { id }),
      error: (msg?: string) => toast.error(msg || 'Failed to record payment', { id }),
    };
  },
  
  dataUpdated: (entity: string) => {
    const id = toast.loading(`Updating ${entity}...`);
    return {
      success: () => toast.success(`${entity} updated successfully`, { id }),
      error: (msg?: string) => toast.error(msg || `Failed to update ${entity}`, { id }),
    };
  },
};
