import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { essaisApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useToast, ToastContainer } from '../components/Toast';
import { CheckCircle, XCircle, Clock, Lock, Unlock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { STATUT_ESSAI_LABELS } from '../types';
import type { EssaiInstanceT, StatutEssai } from '../types';

function StatutBadge({ statut }: { statut: StatutEssai }) {
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

export default function EssaiHistorique() {
  const { essaiId } = useParams<{ essaiId: string }>();
  const { user } = useAuth();
  const canUnlock = ['chef_exploitation', 'admin'].includes(user?.role ?? '');
  const qc = useQueryClient();
  const { toasts, show: showToast, dismiss } = useToast();
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: instances, isLoading } = useQuery({
    queryKey: ['essai-historique', essaiId],
    queryFn: () => essaisApi.historique(essaiId!),
    enabled: !!essaiId,
  });

  const detail = instances?.find((i: EssaiInstanceT) => i.id === detailId);
  const nomEssai = instances?.[0]?.essai?.nom;

  const deverrouillerMut = useMutation({
    mutationFn: (id: string) => essaisApi.deverrouillerInstance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['essai-historique'] });
      showToast('Essai déverrouillé pour correction');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Erreur', 'error'),
  });

  return (
    <div>
      <PageHeader title={nomEssai ? `Essai — ${nomEssai}` : 'Historique de l\'essai'} subtitle="Historique des exécutions, classées par date" />

      <div className="p-3 sm:p-6">
        {isLoading && <div className="text-center text-slate-500 py-8 text-sm">Chargement...</div>}
        {!isLoading && (!instances || instances.length === 0) && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-500 text-sm italic">
            Aucun historique pour cet essai
          </div>
        )}

        {instances && instances.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Date', 'Statut', 'Effectué par', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {instances.map((inst: EssaiInstanceT) => (
                    <tr key={inst.id} onClick={() => setDetailId(inst.id)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-slate-200 font-mono text-xs">
                        {inst.journee ? format(new Date(inst.journee.jour), 'dd/MM/yyyy', { locale: fr }) : '—'}
                      </td>
                      <td className="px-4 py-3"><StatutBadge statut={inst.statut} /></td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {inst.executant ? `${inst.executant.prenom} ${inst.executant.nom}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {inst.statut === 'effectue' && !inst.deverrouille && <Lock size={13} className="text-slate-500 inline" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={!!detailId} onClose={() => setDetailId(null)}
        title={detail?.journee ? `Relevés du ${format(new Date(detail.journee.jour), 'dd MMMM yyyy', { locale: fr })}` : 'Relevés'} size="md">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <StatutBadge statut={detail.statut} />
              {detail.executant && (
                <span className="text-xs text-slate-500">par {detail.executant.prenom} {detail.executant.nom}</span>
              )}
            </div>

            {detail.statut === 'annule' && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                Motif d'annulation : {detail.motif_annulation}
              </p>
            )}

            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-700">
                    <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">Relevé</th>
                    <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">Valeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {detail.essai.releves.map(r => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 text-slate-300">{r.nom}</td>
                      <td className="px-3 py-2 text-white font-medium">
                        {detail.valeurs[r.id] ?? '—'}
                        {r.unite && detail.valeurs[r.id] && <span className="text-slate-500 ml-1">{r.unite}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detail.statut === 'effectue' && !detail.deverrouille && canUnlock && (
              <button onClick={() => deverrouillerMut.mutate(detail.id)} disabled={deverrouillerMut.isPending}
                className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50">
                <Unlock size={14} /> Déverrouiller pour correction
              </button>
            )}
          </div>
        )}
      </Modal>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
