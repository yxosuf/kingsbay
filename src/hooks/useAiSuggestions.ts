import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AiSuggestion {
  type: string;
  [key: string]: any;
}

interface UseAiSuggestionsReturn {
  suggestions: AiSuggestion[];
  loading: boolean;
  source: 'ai' | 'rules' | null;
  fetchSuggestions: (type: string, context: Record<string, any>) => Promise<void>;
}

export function useAiSuggestions(): UseAiSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'ai' | 'rules' | null>(null);

  const fetchSuggestions = useCallback(async (type: string, context: Record<string, any>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-suggestions', {
        body: { type, context },
      });

      if (error) throw error;

      setSuggestions(data?.suggestions || []);
      setSource(data?.source || 'rules');
    } catch (err) {
      console.error('AI suggestions error:', err);
      setSuggestions([]);
      setSource(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { suggestions, loading, source, fetchSuggestions };
}
