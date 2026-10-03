import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Download } from 'lucide-react';
import Modal from './Modal';

const VERSION_PATH = import.meta.env.VITE_APK_VERSION_URL || '/downloads/version.json';
const APK_PATH = import.meta.env.VITE_APK_URL || '/downloads/pomia.apk';
const DISMISS_KEY = 'pomia_update_dismissed_version';

function toAbsolute(path: string) {
  return path.startsWith('http') ? path : `${window.location.origin}${path}`;
}

export default function UpdateBanner() {
  const [remoteCode, setRemoteCode] = useState<number | null>(null);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    (async () => {
      try {
        const info = await CapacitorApp.getInfo();
        const installedCode = parseInt(info.build, 10);

        const res = await fetch(toAbsolute(VERSION_PATH), { cache: 'no-store' });
        if (!res.ok) return;
        const remote = await res.json();
        const code = Number(remote.versionCode);
        if (!Number.isFinite(installedCode) || !Number.isFinite(code) || code <= installedCode) return;

        if (localStorage.getItem(DISMISS_KEY) === String(code)) return;
        setRemoteCode(code);
      } catch {
        // vérification best-effort : on ignore silencieusement les échecs réseau
      }
    })();
  }, []);

  const dismiss = () => {
    if (remoteCode !== null) localStorage.setItem(DISMISS_KEY, String(remoteCode));
    setRemoteCode(null);
  };

  return (
    <Modal open={remoteCode !== null} onClose={dismiss} title="Nouvelle version disponible" size="sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
          <Download size={26} />
        </div>
        <p className="text-sm text-slate-300">
          Une nouvelle version de l'application POMIA est disponible. Téléchargez-la et installez-la pour continuer à
          bénéficier des dernières corrections et fonctionnalités.
        </p>
        <div className="flex w-full gap-3">
          <button
            onClick={dismiss}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm transition-colors"
          >
            Plus tard
          </button>
          <a
            href={toAbsolute(APK_PATH)}
            onClick={dismiss}
            className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium py-2 rounded-lg text-sm transition-colors"
          >
            <Download size={14} />
            Télécharger
          </a>
        </div>
      </div>
    </Modal>
  );
}
