import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { visitesApi } from '../../lib/api';
import PageHeader from '../../components/PageHeader';

interface Lieu {
  pays: string;
  region: string | null;
  ville: string | null;
  visites: number;
  visiteurs: number;
}
interface Compte { visites: number; visiteurs: number }
interface Stats {
  jours: number;
  aujourdhui: Compte;
  sept_jours: Compte;
  trente_jours: Compte;
  periode: Compte;
  parLieu: Lieu[];
}

const PERIODES = [
  { valeur: 7, label: '7 jours' },
  { valeur: 30, label: '30 jours' },
  { valeur: 90, label: '90 jours' },
  { valeur: 365, label: '1 an' },
];

function Carte({ titre, compte }: { titre: string; compte?: Compte }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
      <p className="text-xs text-slate-400 uppercase tracking-wider">{titre}</p>
      <p className="text-2xl font-bold text-white mt-1">{compte?.visites ?? 0}</p>
      <p className="text-xs text-slate-500 mt-0.5">visites · {compte?.visiteurs ?? 0} visiteurs uniques</p>
    </div>
  );
}

export default function Visites() {
  const [jours, setJours] = useState(30);
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['visites-stats', jours],
    queryFn: () => visitesApi.stats(jours),
    refetchInterval: 60000,
  });

  return (
    <div>
      <PageHeader
        title="Visites du site"
        subtitle="Fréquentation anonyme de l'application (aucune adresse IP conservée)"
        actions={
          <select
            value={jours}
            onChange={(e) => setJours(Number(e.target.value))}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500"
          >
            {PERIODES.map((p) => (
              <option key={p.valeur} value={p.valeur}>{p.label}</option>
            ))}
          </select>
        }
      />

      <div className="p-3 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Carte titre="Aujourd'hui" compte={data?.aujourdhui} />
          <Carte titre="7 derniers jours" compte={data?.sept_jours} />
          <Carte titre="30 derniers jours" compte={data?.trente_jours} />
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="bg-cyan-500 px-4 py-2.5">
            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wide italic">
              Répartition géographique — {jours} derniers jours
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-cyan-500/15 border-b border-cyan-500/30">
                  <th className="text-left px-4 py-2 text-cyan-300 font-semibold">Pays</th>
                  <th className="text-left px-4 py-2 text-cyan-300 font-semibold">Région</th>
                  <th className="text-left px-4 py-2 text-cyan-300 font-semibold">Ville</th>
                  <th className="text-right px-4 py-2 text-cyan-300 font-semibold">Visites</th>
                  <th className="text-right px-4 py-2 text-cyan-300 font-semibold">Visiteurs uniques</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-6 text-xs">Chargement...</td></tr>
                )}
                {!isLoading && (!data || data.parLieu.length === 0) && (
                  <tr><td colSpan={5} className="text-center text-slate-600 py-8 text-xs italic">Aucune visite sur la période</td></tr>
                )}
                {data?.parLieu.map((l, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td className="px-4 py-2.5 text-slate-200">{l.pays}</td>
                    <td className="px-4 py-2.5 text-slate-300">{l.region ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-300">{l.ville ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-amber-400">{l.visites}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-300">{l.visiteurs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          La localisation est estimée à partir de l'adresse IP (base GeoLite locale) : elle donne le pays et une
          région approximative, pas une localisation précise.
        </p>
      </div>
    </div>
  );
}
