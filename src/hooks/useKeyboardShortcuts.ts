import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface Shortcut {
  keys: string;
  label: string;
  action: () => void;
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const [pendingG, setPendingG] = useState(false);

  const shortcuts: Shortcut[] = [
    { keys: 'N', label: 'New Booking', action: () => navigate('/bookings/new') },
    { keys: 'G → D', label: 'Go to Dashboard', action: () => navigate('/') },
    { keys: 'G → B', label: 'Go to Bookings', action: () => navigate('/bookings') },
    { keys: 'G → R', label: 'Go to Rooms', action: () => navigate('/rooms') },
    { keys: 'G → F', label: 'Go to Front Desk', action: () => navigate('/front-desk') },
    { keys: 'G → S', label: 'Go to Settings', action: () => navigate('/settings') },
    { keys: '?', label: 'Show Shortcuts', action: () => setShowHelp(true) },
  ];

  const isInputFocused = useCallback(() => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
  }, []);

  useEffect(() => {
    let gTimeout: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      if (isInputFocused() || e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (pendingG) {
        setPendingG(false);
        clearTimeout(gTimeout);
        switch (key) {
          case 'd': navigate('/'); break;
          case 'b': navigate('/bookings'); break;
          case 'r': navigate('/rooms'); break;
          case 'f': navigate('/front-desk'); break;
          case 's': navigate('/settings'); break;
        }
        return;
      }

      if (key === 'g') {
        setPendingG(true);
        gTimeout = setTimeout(() => setPendingG(false), 1000);
        return;
      }

      if (key === 'n') { navigate('/bookings/new'); return; }
      if (key === '?') { setShowHelp(prev => !prev); return; }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      clearTimeout(gTimeout);
    };
  }, [navigate, pendingG, isInputFocused]);

  return { showHelp, setShowHelp, shortcuts };
}
