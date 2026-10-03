import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { essaisApi, journeesApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedDate } from '../contexts/SelectedDateContext';
import PageHeader from '../components/PageHeader';
import DateInput from '../components/DateInput';
import Modal from '../components/Modal';
import { useToast, ToastContainer } from '../components/Toast';
import { ClipboardCheck, CheckCircle, XCircle, Clock, Lock, Unlock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FREQUENCE_ESSAI_LABELS, STATUT_ESSAI_LABELS } from '../types';
import type { EssaiInstanceT } from '../types';

function GaugeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const pct = value !== '' ? Math.min(100, Math.max(0, Number(value))) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <input type="range" min={0} max={100} step={1} value={pct} disabled={disabled}
          onChange={e => onChange(e.target.value)}
          className="flex-1 accent-amber-500" />
        <span className="ml-3 text-sm font-bold text-amber-400 tabular-nums w-14 text-right">{value !== '' ? `${pct}%` : '—'}</span>
      </div>
    </div>
  );
}

function StatutBadge({ statut }: { statut: EssaiInstanceT['statut'] }) {
  const cls = statut === 'effectue' ? 'bg-green-400/10 text-green-400'
    : statut === 'annule' ? 'bg-red-400/10 text-red-400'
    : 'bg-amber-400/10 text-amber-400';
  const Icon = statut === 'effectue' ? CheckCircle : statut === 'annule' ? XCircle : Clock;
  return (
    <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${cls}`}>
      <Icon size={12} /> {STATUT_ESSAI_LABELS[statut]}
    </span>
  );
}

export default function Essai() {
  const { user } = useAuth();
  const canFill = ['operateur', 'chef_bloc', 'chef_quart', 'chef_exploitation', 'admin'].includes(user?.role ?? '');
  const canAnnuler = ['chef_quart', 'admin'].includes(user?.role ?? '');
  const canUnlock = ['chef_exploitation', 'admin'].includes(user?.role ?? '');
  const qc = useQueryClient();
  const { toasts, show: showToast, dismiss } = useToast();
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [openId, setOpenId] = useState<string | null>(null);
  const [formValeurs, setFormValeurs] = useState<Record<string, string>>({});
  const [annulerId, setAnnulerId] = useState<string | null>(null);
  const [motif, setMotif] = useState('');

  const { data: journees } = useQuery({
    queryKey: ['journees'],
    queryFn: () => journeesApi.list(),
  });
  const journee = journees?.find((j: any) => (j.jour as string).slice(0, 10) === selectedDate);

  const { data: datesAvecEssai } = useQuery({ queryKey: ['essais-dates'], queryFn: essaisApi.dates });

  const { data: instances, isLoading } = useQuery({
    queryKey: ['essais-instances', journee?.id],
    queryFn: () => essaisApi.listByJournee(journee!.id),
    enabled: !!journee?.id,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => essaisApi.updateInstance(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['essais-instances'] });
      setOpenId(null);
      setAnnulerId(null);
      setMotif('');
      showToast('Essai enregistré');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Erreur', 'error'),
  });

  const deverrouillerMut = useMutation({
    mutationFn: (id: string) => essaisApi.deverrouillerInstance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['essais-instances'] });
      showToast('Essai déverrouillé pour correction');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Erreur', 'error'),
  });

  function openInstance(inst: EssaiInstanceT) {
    if (openId === inst.id) { setOpenId(null); return; }
    setOpenId(inst.id);
    setFormValeurs({ ...inst.valeurs });
  }

  function handleValider(inst: EssaiInstanceT) {
    const manquants = inst.essai.releves.filter(r => !formValeurs[r.id]?.trim());
    if (manquants.length > 0) {
      showToast(`Relevé manquant : ${manquants[0].nom}`, 'error');
      return;
    }
    updateMut.mutate({ id: inst.id, data: { valeurs: formValeurs, statut: 'effectue' } });
  }

  function handleAnnuler() {
    if (!motif.trim() || !annulerId) return;
    updateMut.mutate({ id: annulerId, data: { statut: 'annule', motif_annulation: motif } });
  }

  return (
    <div>
      <PageHeader
        title="Essais"
        subtitle="Essais périodiques à réaliser pour la journée"
        actions={<DateInput value={selectedDate} onChange={setSelectedDate} markedDates={datesAvecEssai} />}
      />

      <div className="p-3 sm:p-6">
        {!journee && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
            Aucune journée pour le {format(new Date(selectedDate + 'T12:00:00'), 'd MMMM yyyy', { locale: fr })}
          </div>
        )}

        {journee && isLoading && (
          <div className="text-center text-slate-500 py-8 text-sm">Chargement...</div>
        )}

        {journee && !isLoading && (!instances || instances.length === 0) && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-500 text-sm italic">
            Aucun essai dû pour cette journée
          </div>
        )}

        <div className="space-y-3">
          {instances?.map((inst: EssaiInstanceT) => {
            const isLocked = inst.statut === 'effectue' && !inst.deverrouille;
            const fieldsDisabled = !canFill || isLocked;
            return (
            <div key={inst.id} className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
              <button onClick={() => openInstance(inst)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors text-left">
                <div className="flex items-center gap-3 min-w-0">
                  <ClipboardCheck size={16} className="text-amber-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{inst.essai.nom}</p>
                    <p className="text-xs text-slate-500">{FREQUENCE_ESSAI_LABELS[inst.essai.frequence]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {isLocked && <Lock size={13} className="text-slate-500" />}
                  {inst.statut === 'effectue' && inst.executant && (
                    <span className="text-xs text-slate-500 hidden sm:inline">par {inst.executant.prenom} {inst.executant.nom}</span>
                  )}
                  <StatutBadge statut={inst.statut} />
                </div>
              </button>

              {openId === inst.id && (
                <div className="border-t border-slate-800 p-4 space-y-4">
                  {inst.statut === 'annule' && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                      Motif d'annulation : {inst.motif_annulation}
                    </p>
                  )}
                  {isLocked && (
                    <p className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 border border-slate-700 rounded px-3 py-2">
                      <Lock size={13} className="flex-shrink-0" />
                      Essai validé et verrouillé — seul le chef d'exploitation peut autoriser une modification.
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {inst.essai.releves.map(r => (
                      <div key={r.id}>
                        <label className="block text-xs text-slate-400 mb-1">
                          {r.nom}{r.unite && <span className="text-slate-600 ml-1">({r.unite})</span>}
                        </label>
                        {r.type === 'valeur' && (
                          <input type="number" step="any" value={formValeurs[r.id] ?? ''} disabled={fieldsDisabled}
                            onChange={e => setFormValeurs(v => ({ ...v, [r.id]: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50" />
                        )}
                        {(r.type === 'potentiometre' || r.type === 'niveaumetre') && (
                          <GaugeInput value={formValeurs[r.id] ?? ''} disabled={fieldsDisabled}
                            onChange={v => setFormValeurs(vs => ({ ...vs, [r.id]: v }))} />
                        )}
                        {r.type === 'selection' && (
                          <div className="flex gap-2 flex-wrap">
                            {(r.options || []).map(opt => (
                              <button key={opt} type="button" disabled={fieldsDisabled}
                                onClick={() => setFormValeurs(v => ({ ...v, [r.id]: opt }))}
                                className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors disabled:opacity-50 ${
                                  formValeurs[r.id] === opt
                                    ? 'bg-amber-500 border-amber-500 text-slate-900'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/50'
                                }`}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2 border-t border-slate-800">
                    {canFill && !isLocked && (
                      <>
                        <button onClick={() => handleValider(inst)} disabled={updateMut.isPending}
                          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-medium px-4 py-2 rounded-lg text-sm transition-colors">
                          <CheckCircle size={14} /> Valider l'essai
                        </button>
                        {canAnnuler && inst.statut !== 'annule' && (
                          <button onClick={() => { setAnnulerId(inst.id); setMotif(''); }}
                            className="flex items-center gap-1.5 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 px-4 py-2 rounded-lg text-sm transition-colors">
                            <XCircle size={14} /> Annuler l'essai
                          </button>
                        )}
                      </>
                    )}
                    {isLocked && canUnlock && (
                      <button onClick={() => deverrouillerMut.mutate(inst.id)} disabled={deverrouillerMut.isPending}
                        className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
                        <Unlock size={14} /> Déverrouiller pour correction
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      <Modal open={!!annulerId} onClose={() => setAnnulerId(null)} title="Annuler l'essai" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Motif de l'annulation *</label>
            <textarea value={motif} onChange={e => setMotif(e.target.value)} rows={3}
              placeholder="Expliquer pourquoi cet essai n'a pas été réalisé..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setAnnulerId(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm">Retour</button>
            <button onClick={handleAnnuler} disabled={!motif.trim() || updateMut.isPending}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
              {updateMut.isPending ? 'Enregistrement...' : "Confirmer l'annulation"}
            </button>
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
