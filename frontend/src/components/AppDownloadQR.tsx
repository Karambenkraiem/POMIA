import { useEffect, useState } from 'react';
import { Smartphone, Download, Share } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import Modal from './Modal';
import QRCode from './QRCode';

const APK_PATH = import.meta.env.VITE_APK_URL || '/downloads/pomia.apk';
const SEEN_KEY = 'pomia_qr_popup_seen';

function isMobileBrowser() {
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(window.navigator.userAgent);
  return isMobileUA && !Capacitor.isNativePlatform();
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function AppDownloadQR() {
  const isNativeApp = Capacitor.isNativePlatform();
  const isMobileWeb = isMobileBrowser();
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    if (isMobileWeb || isNativeApp || localStorage.getItem(SEEN_KEY)) return;
    setPopupOpen(true);
  }, [isMobileWeb, isNativeApp]);

  const closePopup = () => {
    localStorage.setItem(SEEN_KEY, '1');
    setPopupOpen(false);
  };

  const apkUrl = APK_PATH.startsWith('http') ? APK_PATH : `${window.location.origin}${APK_PATH}`;

  if (isMobileWeb) {
    return (
      <div className="w-full max-w-xs mt-6 bg-slate-900 border border-slate-700 rounded-xl p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
          {isIOS() ? <Share size={15} className="text-amber-400" /> : <Smartphone size={15} className="text-amber-400" />}
          Installer l'application
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {isIOS()
            ? "Appuyez sur le bouton de partage de votre navigateur puis « Sur l'écran d'accueil » pour installer POMIA."
            : "Ajoutez POMIA à votre écran d'accueil depuis le menu de votre navigateur (⋮ → « Ajouter à l'écran d'accueil »)."}
        </p>
        {!isIOS() && (
          <a
            href={apkUrl}
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            <Download size={12} />
            Ou télécharger l'APK Android
          </a>
        )}
      </div>
    );
  }

  return (
    <>
      <Modal open={popupOpen} onClose={closePopup} title="Application mobile POMIA" size="sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="bg-white rounded-lg p-3">
            <QRCode value={apkUrl} size={160} />
          </div>
          <div>
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white">
              <Smartphone size={15} className="text-amber-400" />
              Installez l'application sur votre téléphone
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Scannez ce code avec votre téléphone pour télécharger et installer l'application POMIA (APK Android).
            </p>
          </div>
        </div>
      </Modal>

      <div className="w-full max-w-xs mt-6 bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
        <div className="bg-white rounded-lg p-2 flex-shrink-0">
          <QRCode value={apkUrl} size={96} />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <Smartphone size={15} className="text-amber-400" />
            {isNativeApp ? 'Mettre à jour l\'application' : 'Application mobile'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {isNativeApp
              ? "Téléchargez la dernière version pour mettre à jour l'application POMIA."
              : "Scannez ce code avec votre téléphone pour télécharger et installer l'application POMIA (APK Android)."}
          </p>
          {isNativeApp && (
            <a
              href={apkUrl}
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Download size={12} />
              Télécharger l'APK
            </a>
          )}
        </div>
      </div>
    </>
  );
}
