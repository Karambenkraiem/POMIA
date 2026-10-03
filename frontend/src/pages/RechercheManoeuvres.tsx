import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Search } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DateInput from '../components/DateInput';
import { rechercheApi } from '../lib/api';
import { formatTunisHM } from '../lib/tz';

export default function RechercheManoeuvres() {
  const [type, setType] = useState<'manoeuvre' | 'incident'>('manoeuvre');
  const [texte, setTexte] = useState('');
  const [from, setFrom] = useState(format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['recherche-manouvres', type, texte, from, to],
    queryFn: () => rechercheApi.manouvres({ type, texte, from, to }),
    enabled: false,
  });

  function handleSearch() {
    setSubmitted(true);
    refetch();
  }

  return (
    <div>
      <PageHeader
        title="Recherche — Manœuvres & Incidents"
        subtitle="Retrouvez une manœuvre ou un incident par texte et par période"
        actions={
          <Link to="/analyse" className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
            <ArrowLeft size={15} />
            Retour à l'analyse
          </Link>
        }
      />

      <div className="p-3 sm:p-6 space-y-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-wrap items-end gap-4">
          <div className="flex bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
            {(['manoeuvre', 'incident'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  type === t ? 'bg-amber-500 text-slate-900' : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t === 'manoeuvre' ? 'Manœuvres' : 'Incidents'}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Texte recherché</label>
            <input
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ex : couplage, arrêt turbine..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Du</label>
            <DateInput value={from} onChange={setFrom} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Au</label>
            <DateInput value={to} onChange={setTo} />
          </div>
          <button
            onClick={handleSearch}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Search size={15} />
            Rechercher
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium whitespace-nowrap">Heure</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Texte</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium whitespace-nowrap">Chef de Quart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {!submitted && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Lancez une recherche pour voir les résultats.</td></tr>
                )}
                {submitted && isLoading && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Recherche en cours...</td></tr>
                )}
                {submitted && !isLoading && (data?.length ?? 0) === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Aucun résultat.</td></tr>
                )}
                {(data || []).map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{format(new Date(r.heure_manouvre), 'dd/MM/yyyy')}</td>
                    <td className="px-4 py-3 font-mono text-amber-400 whitespace-nowrap">{formatTunisHM(r.heure_manouvre)}</td>
                    <td className="px-4 py-3 text-slate-200">{r.description}</td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{r.chef_quart || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
