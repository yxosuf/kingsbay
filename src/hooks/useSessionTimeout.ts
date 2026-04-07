import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000; // Show warning 5 min before

export function useSessionTimeout() {
  const { user, signOut } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const lastActivityRef = useRef(Date.now());
  const warningTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    if (!user) return;

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(Math.floor(WARNING_BEFORE_MS / 1000));
      countdownRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

    logoutTimerRef.current = setTimeout(() => {
      signOut();
    }, IDLE_TIMEOUT_MS);
  }, [user, signOut]);

  const stayLoggedIn = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const handler = () => {
      if (!showWarning) resetTimers();
    };

    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetTimers();

    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [user, resetTimers, showWarning]);

  return { showWarning, remainingSeconds, stayLoggedIn };
}
