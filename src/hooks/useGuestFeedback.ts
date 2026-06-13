import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GuestFeedback {
  id: string;
  booking_id: string;
  guest_id: string;
  property_id: string | null;
  rating: number;
  comment: string | null;
  categories: Record<string, number>;
  created_by: string | null;
  created_at: string;
}

export function useGuestFeedback(options?: {
  bookingId?: string;
  guestId?: string;
  propertyId?: string | null;
  showAllProperties?: boolean;
}) {
  const [feedback, setFeedback] = useState<GuestFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('guest_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (options?.bookingId) {
        query = query.eq('booking_id', options.bookingId);
      }
      if (options?.guestId) {
        query = query.eq('guest_id', options.guestId);
      }
      if (options?.propertyId && !options?.showAllProperties) {
        query = query.eq('property_id', options.propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      setFeedback(
        (data || []).map((d) => ({
          ...d,
          categories: (d.categories as Record<string, number>) || {},
        }))
      );
    } catch (e) {
      console.error('Error fetching feedback:', e);
      toast.error('Failed to load guest feedback');
    } finally {
      setLoading(false);
    }
  }, [options?.bookingId, options?.guestId, options?.propertyId, options?.showAllProperties]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const submitFeedback = async (data: {
    booking_id: string;
    guest_id: string;
    property_id: string | null;
    rating: number;
    comment: string;
    categories: Record<string, number>;
    created_by: string;
  }) => {
    const { error } = await supabase.from('guest_feedback').insert(data);
    if (error) throw error;
    await fetchFeedback();
  };

  const averageRating =
    feedback.length > 0
      ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
      : 0;

  return { feedback, loading, submitFeedback, averageRating, refetch: fetchFeedback };
}
