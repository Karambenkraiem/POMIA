import { ReactNode, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Zap, Activity, Thermometer, Gauge, Clock, Plus, Pencil, X, Fan } from 'lucide-react';
import StatCard from './StatCard';
import Modal from './Modal';
import { formatTunisHM } from '../lib/tz';

type Color = 'amber' | 'green' | 'red' | 'blue' | 'slate';

interface MetricDef {
  id: string;
  label: string;
  unit?: string;
  icon: ReactNode;
  value: (dernierReleve: any) => string | number;
  color: (dernierReleve: any) => Color;
  sub?: (dernierReleve: any) => string | undefined;
}

const METRICS: MetricDef[] = [
  {
    id: 'puissance_active',
    label: 'Puissance Active',
    unit: 'MW',
    icon: <Zap size={20} />,
    value: (r) => r?.generateur?.puissance_active_mw ?? '—',
    color: (r) => (r?.generateur?.puissance_active_mw != null ? 'amber' : 'slate'),
  },
  {
    id: 'puissance_reactive',
    label: 'Puissance Réactive',
    unit: 'MVAr',
    icon: <Zap size={20} />,
    value: (r) => r?.generateur?.puissance_reactive_mvar ?? '—',
    color: (r) => (r?.generateur?.puissance_reactive_mvar != null ? 'amber' : 'slate'),
  },
  {
    id: 'frequence',
    label: 'Fréquence',
    unit: 'Hz',
    icon: <Activity size={20} />,
    value: (r) => r?.generateur?.frequence_hz ?? '—',
    color: (r) => (r?.generateur?.frequence_hz != null ? 'green' : 'slate'),
  },
  {
    id: 'cos_phi',
    label: 'Cos φ',
    icon: <Gauge size={20} />,
    value: (r) => r?.generateur?.cos_phi ?? '—',
    color: (r) => (r?.generateur?.cos_phi != null ? 'amber' : 'slate'),
  },
  {
    id: 'tension_alternateur',
    label: 'Tension Alternateur',
    unit: 'kV',
    icon: <Gauge size={20} />,
    value: (r) => r?.generateur?.tension_alt_dvx_kv ?? '—',
    color: (r) => (r?.generateur?.tension_alt_dvx_kv != null ? 'amber' : 'slate'),
  },
  {
    id: 'tension_ligne',
    label: 'Tension Ligne',
    unit: 'kV',
    icon: <Gauge size={20} />,
    value: (r) => r?.generateur?.tension_svlx_kv ?? '—',
    color: (r) => (r?.generateur?.tension_svlx_kv != null ? 'amber' : 'slate'),
  },
  {
    id: 'temp_echappement',
    label: 'Temp. Échappement',
    unit: '°C',
    icon: <Thermometer size={20} />,
    value: (r) => r?.echappement?.ttxm_moyenne ?? '—',
    color: (r) => (r?.echappement?.ttxm_moyenne != null ? 'amber' : 'slate'),
  },
  {
    id: 'spread',
    label: 'Spread',
    unit: '°C',
    icon: <Thermometer size={20} />,
    value: (r) => r?.echappement?.spread_calcule ?? '—',
    color: (r) => {
      const v = r?.echappement?.spread_calcule;
      return v != null ? (v > 40 ? 'red' : 'green') : 'slate';
    },
    sub: (r) => {
      const v = r?.echappement?.spread_calcule;
      return v != null ? (v > 40 ? '⚠ Seuil dépassé' : 'Normal') : undefined;
    },
  },
  {
    id: 'ecart_ttxspl',
    label: 'Écart TTXSPL',
    unit: '°C',
    icon: <Thermometer size={20} />,
    value: (r) => r?.echappement?.ttxspl_ecart ?? '—',
    color: (r) => (r?.echappement?.ttxspl_ecart != null ? 'amber' : 'slate'),
  },
  {
    id: 'vibration_maxi',
    label: 'Vibration Maxi',
    unit: 'mm/s',
    icon: <Gauge size={20} />,
    value: (r) => r?.vibrations?.vibration_maxi ?? '—',
    color: (r) => {
      const v = r?.vibrations?.vibration_maxi;
      return v != null ? (v > 20 ? 'red' : 'green') : 'slate';
    },
  },
  {
    id: 'temp_ambiante',
    label: 'Temp. Ambiante',
    unit: '°C',
    icon: <Thermometer size={20} />,
    value: (r) => r?.temp_ambiante_ctim ?? '—',
    color: (r) => (r?.temp_ambiante_ctim != null ? 'amber' : 'slate'),
  },
  {
    id: 'pression_atm',
    label: 'Pression Atmosphérique',
    unit: 'mmHg',
    icon: <Gauge size={20} />,
    value: (r) => r?.pression_atm_afpap ?? '—',
    color: (r) => (r?.pression_atm_afpap != null ? 'amber' : 'slate'),
  },
  {
    id: 'vitesse_turbine',
    label: 'Vitesse Turbine',
    unit: 'RPM',
    icon: <Activity size={20} />,
    value: (r) => r?.vitesse_turbine_rpm ?? '—',
    color: (r) => (r?.vitesse_turbine_rpm != null ? 'amber' : 'slate'),
  },
  {
    id: 'dernier_releve',
    label: 'Dernier Relevé',
    icon: <Clock size={20} />,
    value: (r) => (r ? formatTunisHM(r.heure_releve) : '—'),
    color: () => 'slate',
    sub: (r) => (r ? format(new Date(r.heure_releve), 'dd/MM/yyyy') : 'Aucun'),
  },
];

const DEFAULT_IDS = ['puissance_active', 'frequence', 'temp_echappement', 'spread'];
const STORAGE_KEY = 'pomia_dashboard_metrics';
const MAX_METRICS = 6;

function loadSelection(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_IDS;
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids) || !ids.length) return DEFAULT_IDS;
    const valid = ids.filter((id: string) => METRICS.some((m) => m.id === id));
    return valid.length ? valid : DEFAULT_IDS;
  } catch {
    return DEFAULT_IDS;
  }
}

interface Props {
  dernierReleve: any;
  turbineStatus?: 'running' | 'stopped' | 'unknown';
}

export default function DashboardMetrics({ dernierReleve, turbineStatus }: Props) {
  const [selected, setSelected] = useState<string[]>(loadSelection);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selected));
  }, [selected]);

  const pickMetric = (id: string) => {
    if (pickerSlot === null) return;
    setSelected((prev) => {
      const next = [...prev];
      if (pickerSlot === -1) next.push(id);
      else next[pickerSlot] = id;
      return next;
    });
    setPickerSlot(null);
  };

  const removeSlot = (index: number) => {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  };

  const currentEditingId = pickerSlot !== null && pickerSlot >= 0 ? selected[pickerSlot] : null;
  const availableForPicker = METRICS.filter((m) => !selected.includes(m.id) || m.id === currentEditingId);

  return (
    <div>
      <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Mesures temps réel</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {turbineStatus && turbineStatus !== 'unknown' && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-1">Turbine</p>
              <p className={`text-2xl font-bold ${turbineStatus === 'running' ? 'text-green-400' : 'text-slate-300'}`}>
                {turbineStatus === 'running' ? 'RUNNING' : 'STOPPED'}
              </p>
            </div>
            <Fan
              size={40}
              className={turbineStatus === 'running' ? 'text-green-400 animate-[spin_1.1s_linear_infinite]' : 'text-slate-600'}
            />
          </div>
        )}
        {selected.map((id, index) => {
          const metric = METRICS.find((m) => m.id === id);
          if (!metric) return null;
          return (
            <div key={`${id}-${index}`} className="relative group">
              <StatCard
                label={metric.label}
                value={metric.value(dernierReleve)}
                unit={metric.unit}
                icon={metric.icon}
                color={metric.color(dernierReleve)}
                sub={metric.sub?.(dernierReleve)}
              />
              <div className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center gap-1">
                <button
                  onClick={() => setPickerSlot(index)}
                  title="Changer la mesure"
                  className="p-1 rounded bg-slate-800/90 text-slate-400 hover:text-white transition-colors"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => removeSlot(index)}
                  title="Retirer ce bloc"
                  className="p-1 rounded bg-slate-800/90 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          );
        })}

        {selected.length < MAX_METRICS && (
          <button
            onClick={() => setPickerSlot(-1)}
            className="flex flex-col items-center justify-center gap-1.5 bg-slate-900/50 border border-dashed border-slate-700 hover:border-amber-500/50 rounded-lg p-4 text-slate-500 hover:text-amber-400 transition-colors min-h-[92px]"
          >
            <Plus size={18} />
            <span className="text-xs">Ajouter</span>
          </button>
        )}
      </div>

      <Modal open={pickerSlot !== null} onClose={() => setPickerSlot(null)} title="Choisir une mesure" size="sm">
        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
          {availableForPicker.map((m) => (
            <button
              key={m.id}
              onClick={() => pickMetric(m.id)}
              className="w-full flex items-center justify-between gap-2 bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-2 text-left transition-colors"
            >
              <span className="text-sm text-white">{m.label}</span>
              {m.unit && <span className="text-xs text-slate-500">{m.unit}</span>}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
