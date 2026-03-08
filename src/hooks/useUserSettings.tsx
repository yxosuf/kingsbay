import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

export interface UserSettings {
  hidden_pages: string[];
  default_landing_page: string;
  theme: string;
  favorite_settings: string[];
}

const DEFAULT_SETTINGS: UserSettings = {
  hidden_pages: [],
  default_landing_page: '/',
  theme: 'system',
  favorite_settings: [],
};

interface UserSettingsContextType {
  settings: UserSettings;
  loading: boolean;
  saveSettings: (updates: Partial<UserSettings>) => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType>({
  settings: DEFAULT_SETTINGS,
  loading: true,
  saveSettings: async () => {},
});

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('hidden_pages, default_landing_page, theme, favorite_settings')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        const s: UserSettings = {
          hidden_pages: Array.isArray(data.hidden_pages) ? (data.hidden_pages as string[]) : [],
          default_landing_page: data.default_landing_page || '/',
          theme: data.theme || 'system',
          favorite_settings: Array.isArray(data.favorite_settings) ? (data.favorite_settings as string[]) : [],
        };
        setSettings(s);
        setTheme(s.theme);
      }
      setLoading(false);
    };

    fetchSettings();
  }, [user?.id, setTheme]);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const saveSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!user?.id) return;

    const merged = { ...settingsRef.current, ...updates };
    setSettings(merged);

    if (updates.theme) {
      setTheme(updates.theme);
    }

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        hidden_pages: merged.hidden_pages,
        default_landing_page: merged.default_landing_page,
        theme: merged.theme,
        favorite_settings: merged.favorite_settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    }
  }, [user?.id, setTheme]);

  return (
    <UserSettingsContext.Provider value={{ settings, loading, saveSettings }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings() {
  return useContext(UserSettingsContext);
}
