import { supabase } from '@/integrations/supabase/client';

export type GuestEmailType = 'booking_confirmation' | 'pre_arrival' | 'checkout_summary';

export async function sendGuestEmail(bookingId: string, emailType: GuestEmailType) {
  const { data, error } = await supabase.functions.invoke('guest-email', {
    body: { booking_id: bookingId, email_type: emailType },
  });

  if (error) {
    console.error(`Failed to send ${emailType} email:`, error);
    throw error;
  }

  return data;
}
