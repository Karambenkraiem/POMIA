import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const DISMISS_KEY = 'pomia_install_dismissed_until';
const DISMISS_DAYS = 14;

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isDismissed() {
  const until = localStorage.getItem(DISMISS_KEY);
  return until ? Date.now() < Number(until) : false;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    if (isIOS()) {
      setShowIosHint(true);
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-50 rounded-xl border border-amber-500/30 bg-slate-900/95 backdrop-blur px-4 py-3 shadow-lg flex items-start gap-3">
      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
        {showIosHint ? <Share size={17} /> : <Download size={17} />}
      </div>
      <div className="flex-1 text-sm">
        <div className="font-semibold text-slate-100">Installer POMIA</div>
        {showIosHint ? (
          <p className="mt-0.5 text-slate-400">
            Appuyez sur <Share size={12} className="inline -mt-0.5" /> puis « Sur l'écran d'accueil » pour installer l'application.
          </p>
        ) : (
          <p className="mt-0.5 text-slate-400">Accédez à POMIA comme une application, directement depuis votre écran d'accueil.</p>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        {!showIosHint && (
          <button
            onClick={install}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
          >
            Installer
          </button>
        )}
        <button onClick={dismiss} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
