import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useFxRate(propertyId: string | null | undefined) {
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!propertyId) {
      setFxRate(null);
      return;
    }

    setLoading(true);
    supabase
      .from('property_inventory_settings')
      .select('fx_usd_lkr_rate')
      .eq('property_id', propertyId)
      .maybeSingle()
      .then(({ data }) => {
        const rate = data?.fx_usd_lkr_rate;
        setFxRate(rate ? Number(rate) : null);
        setLoading(false);
      });
  }, [propertyId]);

  const toUsd = (lkrAmount: number) => {
    if (!fxRate || fxRate === 0) return null;
    return Math.round(lkrAmount / fxRate);
  };

  return { fxRate, loading, toUsd };
}
