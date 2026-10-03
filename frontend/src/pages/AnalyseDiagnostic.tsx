import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PageHeader from '../components/PageHeader';
import DateInput from '../components/DateInput';
import Modal from '../components/Modal';
import { analyseApi } from '../lib/api';
import { Search, ListPlus, LayoutGrid, Rows3 } from 'lucide-react';

interface MetricDef {
  id: string;
  label: string;
  unit: string;
  source: 'bloc' | 'operateur';
}

const METRICS: MetricDef[] = [
  { id: 'bloc_puissance_active', label: 'Puissance Active', unit: 'MW', source: 'bloc' },
  { id: 'bloc_puissance_reactive', label: 'Puissance Réactive', unit: 'MVAr', source: 'bloc' },
  { id: 'bloc_frequence', label: 'Fréquence', unit: 'Hz', source: 'bloc' },
  { id: 'bloc_cos_phi', label: 'Cos φ', unit: '', source: 'bloc' },
  { id: 'bloc_tension_alternateur', label: 'Tension Alternateur', unit: 'kV', source: 'bloc' },
  { id: 'bloc_tension_ligne', label: 'Tension Ligne', unit: 'kV', source: 'bloc' },
  { id: 'bloc_temp_echappement', label: 'Temp. Échappement', unit: '°C', source: 'bloc' },
  { id: 'bloc_spread', label: 'Spread', unit: '°C', source: 'bloc' },
  { id: 'bloc_ecart_ttxspl', label: 'Écart TTXSPL', unit: '°C', source: 'bloc' },
  { id: 'bloc_vibration_maxi', label: 'Vibration Maxi', unit: 'mm/s', source: 'bloc' },
  { id: 'bloc_temp_ambiante', label: 'Temp. Ambiante', unit: '°C', source: 'bloc' },
  { id: 'bloc_pression_atm', label: 'Pression Atmosphérique', unit: 'mmHg', source: 'bloc' },
  { id: 'bloc_vitesse_turbine', label: 'Vitesse Turbine', unit: 'RPM', source: 'bloc' },
  { id: 'bloc_niveau_huile', label: 'Niveau Bac à Huile', unit: 'mm', source: 'bloc' },
  { id: 'bloc_temp_huile_collecteur', label: 'Temp. Collecteur Huile', unit: '°C', source: 'bloc' },
  { id: 'op_pression_refoul_pompe', label: 'Pres. Refoulement Pompe', unit: 'bar', source: 'operateur' },
  { id: 'op_temp_entree_ref', label: 'Temp. Entrée Réf. WTAD1', unit: '°C', source: 'operateur' },
  { id: 'op_temp_sortie_ref', label: 'Temp. Sortie Réf. WTAD', unit: '°C', source: 'operateur' },
  { id: 'op_pression_retour_eau_ref', label: 'Pres. Retour Eau Réf.', unit: 'bar', source: 'operateur' },
  { id: 'op_niveau_reservoir_expansion', label: "Niveau Réservoir d'Expansion", unit: '', source: 'operateur' },
  { id: 'op_temp_gaz', label: 'Température Gaz', unit: '°C', source: 'operateur' },
  { id: 'op_pression_gaz', label: 'Pression Gaz', unit: 'bar', source: 'operateur' },
  { id: 'op_niveau_huile_reservoir', label: "Niveau d'Huile Réservoir", unit: '', source: 'operateur' },
  { id: 'op_pression_air_atomisation', label: "Pression d'Air d'Atomisation", unit: 'bar', source: 'operateur' },
  { id: 'op_pression_air_comprime', label: 'Pression Air Comprimé', unit: 'bar', source: 'operateur' },
  { id: 'op_temp_huile_tp', label: 'Temp. Huile TP', unit: '°C', source: 'operateur' },
  { id: 'op_temp_enroulement_tp', label: 'Temp. Enroulement TP', unit: '°C', source: 'operateur' },
  { id: 'op_temp_huile_ts', label: 'Temp. Huile TS', unit: '°C', source: 'operateur' },
  { id: 'op_temp_enroulement_ts', label: 'Temp. Enroulement TS', unit: '°C', source: 'operateur' },
  { id: 'op_pression_circuit_incendie', label: 'Pression Circuit Incendie', unit: 'bar', source: 'operateur' },
  { id: 'op_niveau_gasoil_ppe', label: 'Niveau Gasoil PPE', unit: '%', source: 'operateur' },
  { id: 'op_stock_gasoil', label: 'Stock Gasoil', unit: 'L', source: 'operateur' },
  { id: 'op_temp_eau_primaire', label: 'Temp. Eau Primaire', unit: '°C', source: 'operateur' },
  { id: 'op_temp_eau_secondaire', label: 'Temp. Eau Secondaire', unit: '°C', source: 'operateur' },
  { id: 'op_pression_air_demarrage', label: 'Pression Air Démarrage', unit: 'bar', source: 'operateur' },
  { id: 'op_nb_heures_marche', label: 'Nb. Heures de Marche', unit: 'h', source: 'operateur' },
];

const MAX_METRICS = 15;
const VIEW_KEY = 'pomia_analyse_view';
type ViewMode = 'grid' | 'list';

function MetricChart({ metric, from, to }: { metric: MetricDef; from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['serie', metric.id, from, to],
    queryFn: () => analyseApi.getSerie(metric.id, from, to),
  });

  const chartData = (data || []).map((p: any) => ({
    date: format(new Date(p.heure_releve), 'dd/MM HH:mm', { locale: fr }),
    value: Number(p.value),
  }));
  const tickInterval = Math.max(0, Math.floor(chartData.length / 6));

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-medium text-white mb-1">{metric.label}</h3>
      <p className="text-xs text-slate-500 mb-3">
        {metric.source === 'bloc' ? 'Relevé Chef de Bloc' : 'Relevé Opérateur'}
        {metric.unit && ` — ${metric.unit}`}
      </p>
      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-slate-500 text-sm">Chargement...</div>
      ) : chartData.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-slate-500 text-sm">Aucune donnée sur cette période</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="date" interval={tickInterval} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis domain={['dataMin', 'dataMax']} tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#f1f5f9' }}
              itemStyle={{ color: '#f59e0b' }}
              formatter={(v: number) => [`${v}${metric.unit ? ' ' + metric.unit : ''}`, metric.label]}
            />
            <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function AnalyseDiagnostic() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>(['bloc_puissance_active']);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [from, setFrom] = useState(format(new Date(Date.now() - 6 * 86400000), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_KEY) as ViewMode) || 'grid'
  );

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  }

  function toggleMetric(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((m) => m !== id);
      if (prev.length >= MAX_METRICS) return prev;
      return [...prev, id];
    });
  }

  const selectedDefs = selected.map((id) => METRICS.find((m) => m.id === id)).filter((m): m is MetricDef => !!m);

  return (
    <div>
      <PageHeader
        title="Analyse & Diagnostic"
        subtitle="Courbes d'évolution des mesures relevées, sur la période de votre choix"
        actions={
          <button
            onClick={() => navigate('/analyse/recherche')}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <Search size={14} />
            Rechercher dans les manœuvres / incidents
          </button>
        }
      />

      <div className="p-3 sm:p-6 space-y-4">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Du</label>
            <DateInput value={from} onChange={setFrom} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Au</label>
            <DateInput value={to} onChange={setTo} />
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <ListPlus size={15} />
            Choisir les mesures ({selected.length}/{MAX_METRICS})
          </button>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Affichage</label>
            <div className="flex rounded-lg border border-slate-700 overflow-hidden">
              <button
                onClick={() => changeViewMode('grid')}
                title="Grille"
                className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                  viewMode === 'grid' ? 'bg-amber-500 text-slate-900 font-medium' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => changeViewMode('list')}
                title="Liste (une courbe par ligne)"
                className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors border-l border-slate-700 ${
                  viewMode === 'list' ? 'bg-amber-500 text-slate-900 font-medium' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Rows3 size={15} />
              </button>
            </div>
          </div>
        </div>

        {selectedDefs.length === 0 ? (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-500">
            Choisissez au moins une mesure à afficher.
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'flex flex-col gap-4'}>
            {selectedDefs.map((m) => (
              <MetricChart key={m.id} metric={m} from={from} to={to} />
            ))}
          </div>
        )}
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title={`Choisir les mesures (max ${MAX_METRICS})`} size="md">
        <div className="space-y-4">
          {(['bloc', 'operateur'] as const).map((source) => (
            <div key={source}>
              <p className="text-xs font-medium text-amber-400/80 uppercase tracking-wide mb-2">
                {source === 'bloc' ? 'Relevés Chef de Bloc' : 'Relevés Opérateur'}
              </p>
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {METRICS.filter((m) => m.source === source).map((m) => {
                  const checked = selected.includes(m.id);
                  const disabled = !checked && selected.length >= MAX_METRICS;
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer transition-colors ${
                        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleMetric(m.id)}
                        className="accent-amber-500"
                      />
                      <span className="text-slate-200">{m.label}</span>
                      {m.unit && <span className="text-xs text-slate-500">({m.unit})</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-4">
          <button
            onClick={() => setPickerOpen(false)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Fermer
          </button>
        </div>
      </Modal>
    </div>
  );
}
