import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityLogApi } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface LogEntry {
  id: string;
  matricule: string | null;
  nom_complet: string | null;
  role: string | null;
  methode: string;
  route: string;
  statut: number;
  cree_le: string;
}

const METHOD_COLORS: Record<string, string> = {
  POST: 'bg-blue-400/10 text-blue-400',
  PUT: 'bg-amber-400/10 text-amber-400',
  PATCH: 'bg-amber-400/10 text-amber-400',
  DELETE: 'bg-red-400/10 text-red-400',
};

function statusColor(statut: number) {
  if (statut >= 500) return 'bg-red-400/10 text-red-400';
  if (statut >= 400) return 'bg-amber-400/10 text-amber-400';
  return 'bg-green-400/10 text-green-400';
}

export default function ActivityLogs() {
  const [methodFilter, setMethodFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data: logs, isLoading } = useQuery<LogEntry[]>({
    queryKey: ['activity-logs'],
    queryFn: activityLogApi.list,
  });

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter((l) => {
      if (methodFilter && l.methode !== methodFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = `${l.nom_complet ?? ''} ${l.matricule ?? ''} ${l.route}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, methodFilter, search]);

  return (
    <div>
      <PageHeader
        title="Journal d'activité"
        subtitle="Actions effectuées par les utilisateurs (créations, modifications, suppressions, connexions)"
        actions={
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un utilisateur, une route..."
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm w-56 focus:outline-none focus:border-amber-500"
            />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="">Toutes les actions</option>
              <option value="POST">Création (POST)</option>
              <option value="PUT">Modification (PUT)</option>
              <option value="PATCH">Modification (PATCH)</option>
              <option value="DELETE">Suppression (DELETE)</option>
            </select>
          </div>
        }
      />

      <div className="p-3 sm:p-6">
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium whitespace-nowrap">Date / Heure</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium whitespace-nowrap">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium whitespace-nowrap">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium whitespace-nowrap">Action</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium">Route</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-400 font-medium whitespace-nowrap">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Chargement...</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Aucune action trouvée</td></tr>
                )}
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {format(new Date(l.cree_le), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                      {l.nom_complet || <span className="text-slate-500">Anonyme</span>}
                      {l.matricule && <span className="text-xs font-mono text-amber-400 ml-1.5">{l.matricule}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{l.role || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${METHOD_COLORS[l.methode] || 'bg-slate-700 text-slate-300'}`}>
                        {l.methode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs break-all">{l.route}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${statusColor(l.statut)}`}>{l.statut}</span>
                    </td>
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
