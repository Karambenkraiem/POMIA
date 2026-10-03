import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const EXIT_WINDOW_MS = 2000;

export default function AndroidBackButton() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const armedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const listenerPromise = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        navigate(-1);
        return;
      }

      if (armedRef.current) {
        CapacitorApp.exitApp();
        return;
      }

      armedRef.current = true;
      setShowExitPrompt(true);
      timerRef.current = setTimeout(() => {
        armedRef.current = false;
        setShowExitPrompt(false);
      }, EXIT_WINDOW_MS);
    });

    return () => {
      listenerPromise.then((l) => l.remove());
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [navigate]);

  if (!showExitPrompt) return null;

  const handleLogout = () => {
    armedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowExitPrompt(false);
    logout();
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xs bg-slate-900/95 border border-slate-700 rounded-xl shadow-lg px-4 py-3 text-center">
      <p className="text-sm text-slate-200">Êtes-vous sûr de vouloir vous déconnecter ?</p>
      <p className="text-xs text-slate-500 mt-1">Ou appuyez de nouveau sur retour pour quitter l'application.</p>
      <button
        onClick={handleLogout}
        className="mt-3 w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium text-sm py-1.5 rounded-lg transition-colors"
      >
        <LogOut size={14} />
        Se déconnecter
      </button>
    </div>
  );
}
