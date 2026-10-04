import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { demoApi } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import { useToast, ToastContainer } from '../../components/Toast';
import { Database } from 'lucide-react';

interface Statut {
  etat: 'inactif' | 'en_cours' | 'termine' | 'erreur';
  message: string;
}

export default function DonneesDemo() {
  const qc = useQueryClient();
  const { toasts, show: showToast, dismiss } = useToast();
  const [enCours, setEnCours] = useState(false);

  const { data: statut } = useQuery<Statut>({
    queryKey: ['demo-statut'],
    queryFn: demoApi.statut,
    refetchInterval: enCours ? 3000 : false,
  });

  useEffect(() => {
    if (statut?.etat === 'en_cours') setEnCours(true);
    if (enCours && statut && statut.etat !== 'en_cours') {
      setEnCours(false);
      qc.invalidateQueries();
      showToast(statut.message, statut.etat === 'termine' ? 'success' : 'error');
    }
  }, [statut]);

  const genererMut = useMutation({
    mutationFn: demoApi.generer,
    onSuccess: (data: Statut) => {
      qc.setQueryData(['demo-statut'], data);
      setEnCours(true);
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Erreur', 'error'),
  });

  const occupe = enCours || statut?.etat === 'en_cours' || genererMut.isPending;

  return (
    <div>
      <PageHeader
        title="Données fictives"
        subtitle="Remplir l'application avec un historique d'exploitation fictif"
      />

      <div className="p-3 sm:p-6 max-w-2xl">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Database size={20} />
            </div>
            <div>
              <p className="text-white font-semibold">Générer des données de démonstration</p>
              <p className="text-xs text-slate-400">Environ 60 jours : relevés, manœuvres, alarmes, essais, consignes, réclamations, messages.</p>
            </div>
          </div>

          <p className="text-sm text-slate-300">
            Les données sont entièrement fictives. Elles ne sont ajoutées que si la base ne contient encore aucune
            journée : les données existantes ne sont jamais modifiées ni supprimées.
          </p>

          {statut?.message && statut.etat !== 'inactif' && (
            <p className={`text-sm rounded-lg px-3 py-2 border ${
              statut.etat === 'erreur'
                ? 'text-red-400 bg-red-500/10 border-red-500/30'
                : statut.etat === 'en_cours'
                  ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                  : 'text-green-400 bg-green-500/10 border-green-500/30'
            }`}>
              {statut.message}
            </p>
          )}

          <button
            onClick={() => genererMut.mutate()}
            disabled={occupe}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {occupe ? 'Génération en cours…' : 'Générer les données fictives'}
          </button>
        </div>
      </div>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
