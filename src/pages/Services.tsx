import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Services page now lives under Settings → Services tab.
 * This page redirects /services to /settings?tab=services.
 */
export default function Services() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/settings?tab=services', { replace: true });
  }, [navigate]);

  return null;
}
