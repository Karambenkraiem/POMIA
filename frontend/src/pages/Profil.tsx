import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useToast, ToastContainer } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { authApi } from '../lib/api';
import { ROLE_LABELS } from '../types';
import { Sun, Moon, Lock } from 'lucide-react';

export default function Profil() {
  const { user, updateUser } = useAuth();
  const { theme, toggle } = useTheme();
  const { toasts, show: showToast, dismiss } = useToast();
  const isGuest = user?.role === 'guest' || user?.role === 'statistique' || user?.role === 'md_center_assistant';

  const [nom, setNom] = useState(user?.nom || '');
  const [prenom, setPrenom] = useState(user?.prenom || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const wantsPasswordChange = currentPassword || newPassword || confirmPassword;
  const identityChanged = nom !== (user?.nom || '') || prenom !== (user?.prenom || '');

  const updateMeMut = useMutation({
    mutationFn: () => authApi.updateMe({ nom, prenom }),
    onSuccess: (data) => updateUser({ nom: data.nom, prenom: data.prenom }),
  });

  const changePasswordMut = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
  });

  function openConfirm() {
    setFormError('');
    if (!nom.trim() || !prenom.trim()) {
      setFormError('Le nom et le prénom sont requis.');
      return;
    }
    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setFormError('Pour changer le mot de passe, remplissez les 3 champs.');
        return;
      }
      if (newPassword.length < 6) {
        setFormError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setFormError('Les deux mots de passe ne correspondent pas.');
        return;
      }
    }
    if (!identityChanged && !wantsPasswordChange) {
      setFormError('Aucune modification à enregistrer.');
      return;
    }
    setShowConfirm(true);
  }

  async function confirmSave() {
    let hadError = false;
    if (identityChanged) {
      try {
        await updateMeMut.mutateAsync();
      } catch (err: any) {
        hadError = true;
        showToast(err?.response?.data?.error || 'Erreur lors de la mise à jour du profil', 'error');
      }
    }
    if (wantsPasswordChange) {
      try {
        await changePasswordMut.mutateAsync();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (err: any) {
        hadError = true;
        showToast(err?.response?.data?.error || 'Erreur lors du changement de mot de passe', 'error');
      }
    }
    if (!hadError) showToast('Modifications enregistrées');
    setShowConfirm(false);
  }

  const isSaving = updateMeMut.isPending || changePasswordMut.isPending;

  return (
    <div>
      <PageHeader title="Mon Profil" subtitle="Informations du compte et préférences d'affichage" />

      <div className="p-3 sm:p-6 space-y-4 max-w-xl">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-4">
          <p className="text-sm font-medium text-slate-300">Informations personnelles</p>
          {isGuest && (
            <p className="text-xs text-slate-500">Le compte invité ne peut pas modifier ces informations.</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Prénom *</label>
              <input value={prenom} onChange={(e) => setPrenom(e.target.value)} disabled={isGuest}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nom *</label>
              <input value={nom} onChange={(e) => setNom(e.target.value)} disabled={isGuest}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Matricule</label>
              <input value={user?.matricule || ''} disabled
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 text-sm cursor-not-allowed font-mono" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Rôle</label>
              <input value={user ? ROLE_LABELS[user.role] : ''} disabled
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-400 text-sm cursor-not-allowed" />
            </div>
          </div>
        </div>

        {!isGuest && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Lock size={14} className="text-slate-500" />
              Changer le mot de passe
              <span className="text-xs font-normal text-slate-500">(laisser vide pour ne pas modifier)</span>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">Mot de passe actuel</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nouveau mot de passe</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Confirmer</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
            </div>
          </div>
        )}

        {formError && <p className="text-red-400 text-sm">{formError}</p>}

        {!isGuest && (
          <button
            onClick={openConfirm}
            disabled={isSaving}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            Enregistrer les modifications
          </button>
        )}

        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
          <p className="text-sm font-medium text-slate-300 mb-3">Apparence</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              {theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
              Mode {theme === 'dark' ? 'sombre' : 'clair'}
            </div>
            <button
              onClick={toggle}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Passer en mode {theme === 'dark' ? 'clair' : 'sombre'}
            </button>
          </div>
        </div>
      </div>

      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title="Confirmer les modifications" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Voulez-vous vraiment enregistrer les modifications suivantes ?</p>
          <ul className="text-sm text-slate-400 list-disc list-inside space-y-1">
            {identityChanged && <li>Nom / prénom : <span className="text-white">{prenom} {nom}</span></li>}
            {wantsPasswordChange && <li>Mot de passe : sera modifié</li>}
          </ul>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowConfirm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm">
              Annuler
            </button>
            <button
              onClick={confirmSave}
              disabled={isSaving}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium py-2 rounded-lg text-sm disabled:opacity-50"
            >
              {isSaving ? 'Enregistrement...' : 'Confirmer'}
            </button>
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
