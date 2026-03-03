import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Guests page now lives under Settings → Guests tab.
 * This page redirects /guests to /settings?tab=guests preserving any query params.
 */
export default function Guests() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'guests');
    navigate(`/settings?${params.toString()}`, { replace: true });
  }, [navigate, searchParams]);

  return null;
}
