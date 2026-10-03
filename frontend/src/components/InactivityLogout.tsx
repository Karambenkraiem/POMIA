import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const INACTIVITY_LIMIT_MS = 8 * 60 * 60 * 1000; // 8 heures
const CHECK_INTERVAL_MS = 60_000; // vérifie toutes les minutes
const WRITE_THROTTLE_MS = 10_000; // évite d'écrire dans localStorage à chaque event
const LAST_ACTIVITY_KEY = 'pomia_last_activity';
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;

export default function InactivityLogout() {
  const { user, logout } = useAuth();
  const lastWriteRef = useRef(0);

  useEffect(() => {
    if (!user) return;

    function markActive() {
      const now = Date.now();
      if (now - lastWriteRef.current < WRITE_THROTTLE_MS) return;
      lastWriteRef.current = now;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    }

    markActive();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    const interval = setInterval(() => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY)) || Date.now();
      if (Date.now() - last > INACTIVITY_LIMIT_MS) logout();
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
}
