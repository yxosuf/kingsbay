/**
 * Shared booking lifecycle actions.
 *
 * Consolidates the duplicated check-in / check-out / cancel / no-show
 * handlers from BookingCard, BookingQuickActions, and Index.tsx.
 */

import { supabase } from '@/integrations/supabase/client';

export async function checkInBooking(bookingId: string, roomId: string) {
  const { error: bookingErr } = await supabase
    .from('bookings')
    .update({ status: 'checked_in' as never, checked_in_at: new Date().toISOString() })
    .eq('id', bookingId);
  if (bookingErr) throw bookingErr;

  const { error: roomErr } = await supabase
    .from('rooms')
    .update({ status: 'occupied' as never })
    .eq('id', roomId);
  if (roomErr) throw roomErr;
}

export async function checkOutBooking(bookingId: string, roomId: string) {
  const { error: bookingErr } = await supabase
    .from('bookings')
    .update({ status: 'checked_out' as never, checked_out_at: new Date().toISOString() })
    .eq('id', bookingId);
  if (bookingErr) throw bookingErr;

  const { error: roomErr } = await supabase
    .from('rooms')
    .update({
      status: 'available' as never,
      housekeeping_status: 'dirty' as never,
      last_checkout_at: new Date().toISOString(),
      cleaning_until: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
    })
    .eq('id', roomId);
  if (roomErr) throw roomErr;
}

export async function cancelBooking(bookingId: string, reason: string) {
  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled' as never,
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason.trim(),
    })
    .eq('id', bookingId);
  if (error) throw error;
}

export async function markNoShow(bookingId: string) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'no_show' as never, no_show_at: new Date().toISOString() })
    .eq('id', bookingId);
  if (error) throw error;
}
