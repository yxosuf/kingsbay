import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';

export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const { selectedProperty, showAllProperties } = useProperty();

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied' as const;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const showNotification = useCallback((title: string, body?: string, link?: string) => {
    if (permission !== 'granted') return;
    if (typeof Notification === 'undefined') return;

    const notification = new Notification(title, {
      body: body || undefined,
      icon: '/pwa-192.png',
      tag: `pms-${Date.now()}`,
    });

    if (link) {
      notification.onclick = () => {
        window.focus();
        window.location.href = link;
        notification.close();
      };
    }

    // Auto-close after 8 seconds
    setTimeout(() => notification.close(), 8000);
  }, [permission]);

  // Listen for realtime high-priority notifications
  useEffect(() => {
    if (permission !== 'granted') return;

    const channel = supabase
      .channel('push-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const n = payload.new as any;
          
          // Only show browser notification for high priority
          if (n.priority !== 'high') return;

          // Property filter
          if (selectedProperty && !showAllProperties && n.property_id !== selectedProperty.id) return;

          // Don't show if tab is focused
          if (document.hasFocus()) return;

          showNotification(n.title, n.message || undefined, n.link || undefined);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [permission, selectedProperty, showAllProperties, showNotification]);

  return { permission, requestPermission, showNotification };
}
