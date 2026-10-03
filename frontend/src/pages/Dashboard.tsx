import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import DateInput from '../components/DateInput';
import DashboardMetrics from '../components/DashboardMetrics';
import { Activity, AlertTriangle, Wrench, Gauge, ClipboardList, ClipboardCheck } from 'lucide-react';
import { format, parse, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { STATUT_JOURNEE_LABELS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedDate } from '../contexts/SelectedDateContext';

const RELEVE_ROUTE: Record<string, string> = { operateur: '/releves-op', chef_bloc: '/releves-bloc' };

export default function Dashboard() {
  const { user } = useAuth();
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const isToday = selectedDate === format(new Date(), 'yyyy-MM-dd');
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', selectedDate],
    queryFn: () => dashboardApi.get(selectedDate),
    refetchInterval: isToday ? 60000 : false,
  });
  const [selectedPoste, setSelectedPoste] = useState<any | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const journee = data?.journeeAujourdhui;
  const selectedDateObj = parse(selectedDate, 'yyyy-MM-dd', new Date());
  const dayLabel = isToday ? "aujourd'hui" : `le ${format(selectedDateObj, 'dd/MM/yyyy')}`;
  const dernierReleve = data?.dernierReleve;

  const chartData = (data?.puissance7Jours || []).map((r: any) => ({
    date: format(new Date(r.heure_releve), 'dd/MM HH:mm', { locale: fr }),
    puissance: r.generateur?.puissance_active_mw ?? null,
  }));
  const chartTickInterval = Math.max(0, Math.floor(chartData.length / 8));
  const weekStart = startOfWeek(selectedDateObj, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDateObj, { weekStartsOn: 1 });

  return (
    <div>
      <PageHeader
        title="Tableau de Bord"
        subtitle={`${format(selectedDateObj, "EEEE d MMMM yyyy", { locale: fr })} — Journée ${journee ? STATUT_JOURNEE_LABELS[journee.statut as keyof typeof STATUT_JOURNEE_LABELS] : 'non créée'}`}
        actions={<DateInput value={selectedDate} onChange={setSelectedDate} />}
      />

      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Alerte incident */}
        {(data?.incidentsAujourdhui ?? 0) > 0 && (
          <Link to="/manouvres?tab=incident"
            className="flex items-center gap-3 bg-red-500/15 border border-red-500/40 rounded-lg p-4 animate-pulse hover:bg-red-500/25 transition-colors">
            <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300">
                {data.incidentsAujourdhui} incident{data.incidentsAujourdhui > 1 ? 's' : ''} signalé{data.incidentsAujourdhui > 1 ? 's' : ''} {dayLabel}
              </p>
              <p className="text-xs text-red-400/70">Cliquez pour consulter</p>
            </div>
          </Link>
        )}

        {/* Alerte essais à faire */}
        {(data?.essaisAFaire?.length ?? 0) > 0 && (
          <Link to="/essai"
            className="flex items-center gap-3 bg-amber-500/15 border border-amber-500/40 rounded-lg p-4 hover:bg-amber-500/25 transition-colors">
            <ClipboardCheck size={20} className="text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-300">
                Essai{data.essaisAFaire.length > 1 ? 's' : ''} à faire {dayLabel} : {data.essaisAFaire.map((e: any) => e.nom).join(', ')}
              </p>
              <p className="text-xs text-amber-400/70">Cliquez pour saisir les relevés</p>
            </div>
          </Link>
        )}

        {/* Accès rapide — opérateur / chef de bloc */}
        {user?.role && RELEVE_ROUTE[user.role] && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link to={RELEVE_ROUTE[user.role]}
              className="flex items-center gap-3 bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-lg p-4 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 flex-shrink-0">
                <ClipboardList size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Saisir un relevé</p>
                <p className="text-xs text-slate-500">Accès rapide à la saisie du relevé du jour</p>
              </div>
            </Link>
            <Link to={`${RELEVE_ROUTE[user.role]}?tab=compteurs`}
              className="flex items-center gap-3 bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-lg p-4 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Gauge size={18} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Saisir les compteurs</p>
                <p className="text-xs text-slate-500">Accès rapide aux compteurs journaliers</p>
              </div>
            </Link>
          </div>
        )}

        {/* Mesures temps réel */}
        <DashboardMetrics dernierReleve={dernierReleve} turbineStatus={data?.turbineStatus} />

        {/* Graphique puissance active de la semaine */}
        {chartData.length > 0 && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h2 className="text-sm font-medium text-white mb-4">
              Puissance active (MW) — Semaine du {format(weekStart, 'dd/MM')} au {format(weekEnd, 'dd/MM')}
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" interval={chartTickInterval} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis domain={[0, 130]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#f1f5f9' }}
                  itemStyle={{ color: '#f59e0b' }}
                />
                <Line type="monotone" dataKey="puissance" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alertes */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h2 className="text-sm font-medium text-white mb-3">État des alertes</h2>
            <div className="space-y-2">
              <Link to="/defauts" className="flex items-center justify-between py-2 border-b border-slate-800 -mx-2 px-2 rounded hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <AlertTriangle size={14} className="text-red-400" />
                  Matériels défectueux actifs
                </div>
                <span className={`text-sm font-bold ${data?.defautsActifs > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {data?.defautsActifs ?? 0}
                </span>
              </Link>
              <Link to="/ordres-travaux" className="flex items-center justify-between py-2 border-b border-slate-800 -mx-2 px-2 rounded hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Wrench size={14} className="text-amber-400" />
                  OT en cours
                </div>
                <span className="text-sm font-bold text-amber-400">{data?.otsEnCours ?? 0}</span>
              </Link>
              <Link to="/releves-jour" className="flex items-center justify-between py-2 -mx-2 px-2 rounded hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Activity size={14} className="text-blue-400" />
                  Relevés {dayLabel}
                </div>
                <span className="text-sm font-bold text-blue-400">{journee?._count?.releves_bloc ?? 0}</span>
              </Link>
            </div>
          </div>

          {/* Postes du jour */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h2 className="text-sm font-medium text-white mb-3">Postes du jour</h2>
            {journee?.postes?.length > 0 ? (
              <div className="space-y-1">
                {journee.postes.map((poste: any) => (
                  <button key={poste.id} onClick={() => setSelectedPoste(poste)}
                    className="w-full flex items-center justify-between text-xs py-1.5 px-1 -mx-1 rounded border-b border-slate-800 last:border-0 hover:bg-slate-800/50 transition-colors text-left">
                    <span className="text-slate-400">{poste.tranche.replace('h', 'h ').replace('_', '— ')}</span>
                    <span className="text-slate-300">{poste.chefQuart ? `${poste.chefQuart.prenom} ${poste.chefQuart.nom}` : '—'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Aucun poste configuré</p>
            )}
          </div>

          {/* Activité journée */}
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
            <h2 className="text-sm font-medium text-white mb-3">Activité {dayLabel}</h2>
            <div className="space-y-2">
              {[
                { label: 'Manœuvres', value: (journee?._count?.manouvres ?? 0) - (data?.incidentsAujourdhui ?? 0), to: '/manouvres' },
                { label: 'Incidents', value: data?.incidentsAujourdhui ?? 0, to: '/manouvres?tab=incident' },
                { label: 'Alarmes', value: journee?._count?.alarmes ?? 0, to: '/alarmes' },
                { label: 'OT', value: journee?._count?.ordres_travaux ?? 0, to: '/ordres-travaux' },
              ].map(({ label, value, to }) => (
                <Link key={label} to={to} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0 -mx-2 px-2 rounded hover:bg-slate-800/50 transition-colors">
                  <span className="text-sm text-slate-300">{label}</span>
                  <span className="text-sm font-bold text-slate-100">{value}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!selectedPoste} onClose={() => setSelectedPoste(null)}
        title={selectedPoste ? `Équipe — ${selectedPoste.tranche.replace('h', 'h ').replace('_', '— ')}` : ''} size="sm">
        {selectedPoste && (
          <div className="space-y-3">
            {[
              { label: 'Chef de Quart', p: selectedPoste.chefQuart },
              { label: 'Chef de Bloc', p: selectedPoste.chefBloc },
              { label: 'Opérateur 1', p: selectedPoste.operateur1 },
              { label: 'Opérateur 2', p: selectedPoste.operateur2 },
            ].map(({ label, p }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <span className="text-sm text-slate-400">{label}</span>
                <span className="text-sm text-white font-medium">{p ? `${p.prenom} ${p.nom}` : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
