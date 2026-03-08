import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface NotificationPreferences {
  categories: Record<string, boolean>;
  priority_threshold: 'high' | 'medium' | 'low';
  delivery_channels: { in_app: boolean; push: boolean };
}

const DEFAULT_PREFS: NotificationPreferences = {
  categories: {
    booking: true,
    checkin_checkout: true,
    availability: true,
    maintenance: true,
    channel_sync: true,
    general: true,
  },
  priority_threshold: 'low',
  delivery_channels: { in_app: true, push: true },
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('categories, priority_threshold, delivery_channels')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setPreferences({
          categories: (data.categories as Record<string, boolean>) || DEFAULT_PREFS.categories,
          priority_threshold: (data.priority_threshold as 'high' | 'medium' | 'low') || 'low',
          delivery_channels: (data.delivery_channels as { in_app: boolean; push: boolean }) || DEFAULT_PREFS.delivery_channels,
        });
      }
    } catch (e) {
      console.error('Error fetching notification preferences:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchPreferences(); }, [fetchPreferences]);

  const savePreferences = async (prefs: NotificationPreferences) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          categories: prefs.categories as unknown as Record<string, unknown>,
          priority_threshold: prefs.priority_threshold,
          delivery_channels: prefs.delivery_channels as unknown as Record<string, unknown>,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      setPreferences(prefs);
      return true;
    } catch (e) {
      console.error('Error saving notification preferences:', e);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Filter notifications based on preferences
  const shouldShowNotification = useCallback((category: string, priority: string): boolean => {
    // Category check
    if (preferences.categories[category] === false) return false;
    // Priority threshold
    const levels = { high: 3, medium: 2, low: 1 };
    const threshold = levels[preferences.priority_threshold as keyof typeof levels] || 1;
    const notifLevel = levels[priority as keyof typeof levels] || 1;
    return notifLevel >= threshold;
  }, [preferences]);

  return { preferences, loading, saving, savePreferences, shouldShowNotification };
}
