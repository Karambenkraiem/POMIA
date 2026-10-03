import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { relevesApi, journeesApi, postesApi } from '../lib/api';
import PageHeader from '../components/PageHeader';
import DateInput from '../components/DateInput';
import { Save, Trash2, RotateCcw, FlaskConical, Pencil, Plus, Unlock } from 'lucide-react';
import { useToast, ToastContainer } from '../components/Toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Poste } from '../types';
import { TRANCHE_LABELS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedDate } from '../contexts/SelectedDateContext';
import { tunisLocalToISOString, formatTunisHM, getTunisHour, formatTunisDateTimeLocal } from '../lib/tz';

const SLOT_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

function hourToTranche(h: number) {
  if (h < 8) return 'h00_07h';
  if (h < 14) return 'h07_14h';
  if (h < 20) return 'h14_20h';
  return 'h20_00h';
}

type ConsoAuxCycle = { couplage: number | null; decouplage: number | null };

/** Reconstitue la liste des cycles couplage/découplage, avec repli sur les anciens champs uniques. */
function normalizeConsoAuxCycles(data: any): ConsoAuxCycle[] {
  if (Array.isArray(data?.conso_aux_cycles) && data.conso_aux_cycles.length) return data.conso_aux_cycles;
  if (data?.conso_aux_couplage != null || data?.conso_aux_decouplage != null) {
    return [{ couplage: data.conso_aux_couplage ?? null, decouplage: data.conso_aux_decouplage ?? null }];
  }
  return [{ couplage: null, decouplage: null }];
}

function consoAuxTotal(cycles: ConsoAuxCycle[] | undefined): number | null {
  if (!cycles?.length) return null;
  let sum = 0;
  let hasPair = false;
  for (const c of cycles) {
    if (c?.couplage != null && c?.decouplage != null) {
      sum += Number(c.decouplage) - Number(c.couplage);
      hasPair = true;
    }
  }
  // Compteurs couplage/découplage relevés en kWh -> conversion en MWh
  return hasPair ? sum / 1000 : null;
}

function onEnter(e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const box = (e.currentTarget as HTMLElement).closest('[data-form]') as HTMLElement;
  if (!box) return;
  const all = Array.from(
    box.querySelectorAll('input:not([disabled]),select:not([disabled]),textarea:not([disabled])')
  ) as HTMLElement[];
  const i = all.indexOf(e.currentTarget as HTMLElement);
  if (i >= 0 && i < all.length - 1) all[i + 1].focus();
}

function F({ label, name, value, set, unit }: { label: string; name: string; value: any; set: (n: string, v: any) => void; unit?: string }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-0.5">{label}{unit && <span className="ml-1 text-slate-500">({unit})</span>}</label>
      <input type="number" step="any" value={value ?? ''} onKeyDown={onEnter}
        onChange={e => set(name, e.target.value === '' ? null : parseFloat(e.target.value))}
        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500" />
    </div>
  );
}

function BtnGroup({ label, name, value, set, opts }: { label: string; name: string; value: any; set: (n: string, v: any) => void; opts: string[] }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="flex gap-2">
        {opts.map(o => (
          <button key={o} type="button" onClick={() => set(name, value === o ? '' : o)}
            className={`flex-1 py-2 rounded text-sm font-medium border transition-colors text-center ${
              value === o
                ? 'bg-amber-500 border-amber-500 text-slate-900'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-white'
            }`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function LevelGauge({ label, name, value, set }: { label: string; name: string; value: any; set: (n: string, v: any) => void }) {
  const pct = value != null ? Math.min(100, Math.max(0, Number(value))) : null;
  const fillColor = pct == null ? 'bg-slate-700' : pct <= 20 ? 'bg-red-500' : pct <= 50 ? 'bg-amber-500' : 'bg-green-500';
  const textColor = pct == null ? 'text-slate-600' : pct <= 20 ? 'text-red-400' : pct <= 50 ? 'text-amber-400' : 'text-green-400';
  const displayLabel = pct == null ? '—' : pct === 0 ? 'Vide' : pct === 100 ? 'Full' : `${pct}%`;
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-slate-400">{label}</label>
        <span className={`text-xs font-bold tabular-nums ${textColor}`}>{displayLabel}</span>
      </div>
      <div className="relative h-7">
        {/* Track */}
        <div className="absolute inset-0 bg-slate-800 border border-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-150 ${fillColor}`}
            style={{ width: `${pct ?? 0}%` }} />
        </div>
        {/* Tick marks */}
        {ticks.slice(1, -1).map(t => (
          <div key={t} className="absolute top-0 bottom-0 w-px bg-slate-600/60 pointer-events-none"
            style={{ left: `${t}%` }} />
        ))}
        {/* Slider (transparent, on top) */}
        <input type="range" min={0} max={100} step={1}
          value={pct ?? 0}
          onChange={e => set(name, parseInt(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
      <div className="flex justify-between text-[9px] text-slate-600 mt-0.5 select-none">
        <span>0</span><span>25%</span><span>50%</span><span>75%</span><span>Full</span>
      </div>
    </div>
  );
}

function SectHead({ t }: { t: string }) {
  return (
    <div className="flex items-center gap-1.5 pt-2 first:pt-0">
      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest whitespace-nowrap">{t}</span>
      <div className="flex-1 h-px bg-slate-700" />
    </div>
  );
}

const CPT_COL = 'grid grid-cols-[2fr_0.5fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center';
const INPUT_CLS = 'bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 w-full';

function CptRow({ label, unit, fields, vals, set }: {
  label: string; unit: string;
  fields: [string, string, string, string, string];
  vals: [any, any, any, any, any];
  set: (n: string, v: any) => void;
}) {
  return (
    <div className={`${CPT_COL} border-b border-slate-800 py-2`}>
      <div className="text-sm text-slate-300">{label}</div>
      <div className="text-xs text-slate-500 text-center">{unit}</div>
      {fields.map((name, i) => (
        <input key={name} type="number" step="any" value={vals[i] ?? ''} onKeyDown={onEnter}
          onChange={e => set(name, e.target.value === '' ? null : parseFloat(e.target.value))}
          className={INPUT_CLS} />
      ))}
    </div>
  );
}

function CptRow2({ label, unit, f00h, f24h, v00h, v24h, set }: {
  label: string; unit: string;
  f00h: string; f24h: string;
  v00h: any; v24h: any;
  set: (n: string, v: any) => void;
}) {
  return (
    <div className={`${CPT_COL} border-b border-slate-800 py-2`}>
      <div className="text-sm text-slate-300">{label}</div>
      <div className="text-xs text-slate-500 text-center">{unit}</div>
      <input type="number" step="any" value={v00h ?? ''} onKeyDown={onEnter}
        onChange={e => set(f00h, e.target.value === '' ? null : parseFloat(e.target.value))}
        className={INPUT_CLS} />
      <div /><div /><div />
      <input type="number" step="any" value={v24h ?? ''} onKeyDown={onEnter}
        onChange={e => set(f24h, e.target.value === '' ? null : parseFloat(e.target.value))}
        className={INPUT_CLS} />
    </div>
  );
}

const EMPTY = (date: string, hour?: number, posteId?: string): any => ({
  heure_releve: hour !== undefined
    ? `${date}T${hour.toString().padStart(2, '0')}:00`
    : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  poste_id: posteId || '',
  detecteurs_gaz: {},
});

export default function RelevesOperateurPage() {
  const { user } = useAuth();
  const { toasts, show: showToast, dismiss } = useToast();
  const isOperateur = user?.role === 'operateur';
  const canFill = ['operateur', 'admin', 'chef_exploitation'].includes(user?.role ?? '');
  const canDelete = ['admin', 'chef_exploitation'].includes(user?.role ?? '');
  const canUnlock = ['chef_quart', 'chef_exploitation', 'admin'].includes(user?.role ?? '');
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [pageTab, setPageTab] = useState<'saisie' | 'compteurs'>(searchParams.get('tab') === 'compteurs' ? 'compteurs' : 'saisie');
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [form, setForm] = useState<any>(EMPTY(format(new Date(), 'yyyy-MM-dd')));
  const [cptForm, setCptForm] = useState<any>({});
  const [cptLocked, setCptLocked] = useState(false);
  const [cptConfirm, setCptConfirm] = useState(false);

  const { data: journees } = useQuery({
    queryKey: ['journees'],
    queryFn: () => journeesApi.list(),
  });
  const journee = journees?.find((j: any) => (j.jour as string).slice(0, 10) === selectedDate);

  const { data: postes } = useQuery({
    queryKey: ['postes', journee?.id],
    queryFn: () => postesApi.listByJournee(journee!.id),
    enabled: !!journee?.id,
  });

  const { data: releves } = useQuery({
    queryKey: ['releves-op', journee?.id],
    queryFn: () => relevesApi.listOp(journee!.id),
    enabled: !!journee?.id,
  });

  const { data: compteurs, isFetching: cptFetching } = useQuery({
    queryKey: ['compteurs', journee?.id],
    queryFn: () => relevesApi.getCompteurs(journee!.id),
    enabled: !!journee?.id,
  });

  const cptSyncedJourneeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    cptSyncedJourneeRef.current = undefined; // nouvelle journée sélectionnée : autoriser un rechargement du formulaire
  }, [journee?.id]);

  useEffect(() => {
    // Un refetch en arrière-plan (polling) renvoie un nouvel objet pour la même
    // journée : on ne resynchronise le formulaire qu'une fois par journée pour
    // ne pas écraser une saisie en cours. On attend la fin du chargement (cptFetching)
    // avant de marquer "synchronisé", sinon le tout premier passage (données pas
    // encore arrivées, ex. report du 24h de la veille) verrouillait le formulaire
    // sur un état vide et ignorait les vraies données à leur arrivée.
    if (!journee?.id || cptFetching || cptSyncedJourneeRef.current === journee.id) return;
    cptSyncedJourneeRef.current = journee.id;
    setCptForm({ ...(compteurs ?? {}), conso_aux_cycles: normalizeConsoAuxCycles(compteurs) });
    setCptLocked(!!compteurs?.id);
  }, [journee?.id, compteurs, cptFetching]);

  function setConsoAuxCycle(i: number, field: keyof ConsoAuxCycle, value: number | null) {
    setCptForm((s: any) => {
      const cycles = [...(s.conso_aux_cycles || [])];
      cycles[i] = { ...cycles[i], [field]: value };
      return { ...s, conso_aux_cycles: cycles };
    });
  }
  function addConsoAuxCycle() {
    setCptForm((s: any) => ({ ...s, conso_aux_cycles: [...(s.conso_aux_cycles || []), { couplage: null, decouplage: null }] }));
  }
  function removeConsoAuxCycle(i: number) {
    setCptForm((s: any) => {
      const cycles = (s.conso_aux_cycles || []).filter((_: any, idx: number) => idx !== i);
      return { ...s, conso_aux_cycles: cycles.length ? cycles : [{ couplage: null, decouplage: null }] };
    });
  }

  const saveCptMut = useMutation({
    mutationFn: (data: any) => relevesApi.saveCompteurs({ journee_id: journee!.id, ...data }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compteurs'] }); showToast('Compteurs enregistrés avec succès'); setCptLocked(true); },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Erreur lors de l\'enregistrement', 'error'),
  });

  function cpt(n: string, v: any) { setCptForm((s: any) => ({ ...s, [n]: v })); }

  // Map relevé by hour for fast lookup
  const releveByHour = useMemo(() => {
    const map: Record<number, any> = {};
    releves?.forEach((r: any) => {
      const h = getTunisHour(r.heure_releve);
      map[h] = r;
    });
    return map;
  }, [releves]);

  // When hour slot is selected, populate the form
  useEffect(() => {
    if (selectedHour === null || !journee) return;
    const releve = releveByHour[selectedHour];
    if (releve) {
      setForm({
        ...releve,
        heure_releve: formatTunisDateTimeLocal(releve.heure_releve),
        detecteurs_gaz: releve.detecteurs_gaz || {},
      });
    } else {
      const tranche = hourToTranche(selectedHour);
      const poste = postes?.find((p: any) => p.tranche === tranche);
      setForm(EMPTY(selectedDate, selectedHour, poste?.id));
    }
  }, [selectedHour]);

  const createMut = useMutation({
    mutationFn: (data: any) => relevesApi.createOp(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['releves-op'] }); showToast('Relevé enregistré avec succès'); },
    onError: () => showToast('Erreur lors de l\'enregistrement', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => relevesApi.updateOp(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['releves-op'] }); showToast('Relevé mis à jour'); },
    onError: () => showToast('Erreur lors de la mise à jour', 'error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => relevesApi.deleteOp(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['releves-op'] }),
  });

  const unlockMut = useMutation({
    mutationFn: (id: string) => relevesApi.deverrouillerOp(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['releves-op'] }); showToast('Créneau déverrouillé pour correction'); },
    onError: () => showToast('Erreur lors du déverrouillage', 'error'),
  });

  // For operators: slots in the future are disabled; already-filled slots are read-only
  function isSlotFuture(hour: number) {
    if (!isOperateur) return false;
    return new Date(`${selectedDate}T${hour.toString().padStart(2, '0')}:00:00`) > new Date();
  }
  function isSlotLocked(hour: number) {
    return !!(releveByHour[hour]?.saisi_par) && !releveByHour[hour]?.deverrouille;
  }
  const formDisabled = !canFill || selectedHour === null || (selectedHour !== null && (isSlotFuture(selectedHour) || isSlotLocked(selectedHour)));

  function f(n: string, v: any) { setForm((s: any) => ({ ...s, [n]: v })); }
  function det(n: string, v: any) { setForm((s: any) => ({ ...s, detecteurs_gaz: { ...(s.detecteurs_gaz || {}), [n]: v } })); }
  const dg = form.detecteurs_gaz || {};

  // ── TEST DATA (remove before production) ──
  function fillTest() {
    setForm((s: any) => ({
      ...s,
      choix_pompe: 'P1', pression_refoul_pompe_bar: 3.2, nb_ventilateurs_service: 4,
      temp_entree_ref_wtad1: 29, temp_sortie_ref_wtad2: 42,
      pression_retour_eau_ref: 2.8, pression_sortie_ref_alt: 2.6, niveau_reservoir_expansion: 80,
      temp_gaz_ftg_tkg: 38, pression_gaz_fpgi_bar: 18.5, dp_filtre_gaz_bar: 0.12,
      pression_entree_skid: 5.2, dp_filtre_gasoil_bar: 0.08,
      niveau_huile_reservoir: 75, choix_filtre_huile: 'F1', choix_refrigerant_huile: 'R1',
      pression_air_atomisation: 4.8,
      dp_totale_filtre_kpa: 1.8, dp_pre_filtre_kpa: 0.6, dp_filtre_kpa: 1.2,
      pression_air_comprime_bar: 6.5,
      temp_huile_tp: 62, temp_enroulement_tp: 75, niv_conservateur_tp: 70, choix_ventilateur_tp: 'V1',
      temp_huile_ts: 58, temp_enroulement_ts: 70, niv_conservateur_ts: 68,
      pression_circuit_incendie: 8.5, niveau_gasoil_ppe_pct: 85, pompe_jockey: 'EN SERVICE',
      compteur_gasoil_ge_l: 12450, compteur_energie_ge_kwh: 8920, stock_gasoil_l: 45000,
      temp_huile_graissage_ge: 55, pression_huile_graissage_ge: 3.8,
      temp_eau_primaire_ge: 72, temp_eau_secondaire_ge: 68,
      pression_air_demarrage_ge: 22, nb_heures_marche_ge: 18420,
      energie_active_index_0h: 98450, energie_active_index_24h: 101330,
      reactif_absorbe_0h: 12400, reactif_absorbe_24h: 13100,
      reactif_fourni_0h: 8200, reactif_fourni_24h: 8950,
      conso_aux_ht_tag_0h: 4820, conso_aux_ht_tag_24h: 4950,
      conso_aux_ht_site_0h: 1240, conso_aux_ht_site_24h: 1290,
      gasoil_0h_l: 12450, gasoil_24h_l: 12680,
      consignes_particulieres: 'Test automatique — données fictives.',
      detecteurs_gaz: {
        ha_1: 0, ha_2: 0, ha_3: 0, ha_4: 0, ha_5: 0, ha_6: 0,
        ht_1: 0, ht_2: 0, ht_3: 0, ht_4: 0, ht_5: 0, ht_6: 0,
        para_r: 1, para_s: 1, para_t: 1, paratonerre: 1,
      },
    }));
  }

  function handleSave() {
    if (!journee || selectedHour === null) return;
    const existing = releveByHour[selectedHour];
    const payload = { ...form, poste_id: form.poste_id || null, heure_releve: tunisLocalToISOString(form.heure_releve) };
    if (existing) {
      updateMut.mutate({ id: existing.id, data: payload });
    } else {
      createMut.mutate({ ...payload, journee_id: journee.id });
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  const SaveBtn = ({ compteurs = false }: { compteurs?: boolean }) => (
    <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-700">
      {/* TEST BUTTON — remove before production */}
      <button onClick={fillTest}
        className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded px-3 py-1.5 text-xs transition-colors">
        <FlaskConical size={12} /> Remplir test
      </button>
      <button onClick={() => { setForm(EMPTY(selectedDate)); setSelectedHour(null); }}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
        <RotateCcw size={13} /> Réinitialiser
      </button>
      <button onClick={handleSave}
        disabled={isPending || selectedHour === null || (compteurs ? !canFill : formDisabled)}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-5 py-2 rounded-lg text-sm disabled:opacity-50 transition-colors">
        <Save size={14} /> {isPending ? 'Enregistrement...' : 'Enregistrer le relevé'}
      </button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Relevés Opérateur" subtitle="Feuille opérateur — relevés toutes les 2 heures"
        actions={
          <DateInput value={selectedDate} onChange={d => { setSelectedDate(d); setSelectedHour(null); }} />
        } />

      {/* Onglets */}
      <div className="flex border-b border-slate-700 px-6">
        {([['saisie', 'Saisie Relevé'], ['compteurs', 'Compteurs']] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setPageTab(k)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${pageTab === k ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {lbl}
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-6">
        {!journee && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
            Aucune journée créée pour le {format(new Date(selectedDate + 'T12:00:00'), 'd MMMM yyyy', { locale: fr })}
          </div>
        )}

        {journee && (
          <>
            {/* ── Grille des 12 créneaux 2h ── */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-4">
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-medium">Créneaux du jour — cliquer pour saisir</p>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                {SLOT_HOURS.map(hour => {
                  const releve = releveByHour[hour];
                  const isFilled = !!(releve?.saisi_par);
                  const isUnlockedForCorrection = isFilled && !!releve.deverrouille;
                  const isSelected = selectedHour === hour;
                  const future = isSlotFuture(hour);
                  const locked = isSlotLocked(hour);
                  const disabled = future || locked || !canFill;
                  const showUnlock = canUnlock && isFilled && !releve.deverrouille;
                  return (
                    <div key={hour} className="relative">
                      <button
                        onClick={() => { if (disabled) return; setSelectedHour(hour === selectedHour ? null : hour); }}
                        className={`w-full py-2 px-1 rounded text-xs font-medium transition-colors text-center ${
                          disabled ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed opacity-50' :
                          isSelected ? 'bg-amber-500 text-slate-900' :
                          isUnlockedForCorrection ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25' :
                          isFilled ? 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30' :
                          'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                        }`}>
                        {hour.toString().padStart(2, '0')}h
                        <div className="text-[9px] mt-0.5 opacity-80">
                          {future ? '—' : isUnlockedForCorrection ? '✎ À corriger' : isFilled ? '✓ Rempli' : '◌ Vide'}
                        </div>
                      </button>
                      {showUnlock && (
                        <button
                          onClick={(e) => { e.stopPropagation(); unlockMut.mutate(releve.id); }}
                          disabled={unlockMut.isPending}
                          title="Déverrouiller ce créneau pour correction"
                          className="absolute -top-1.5 -right-1.5 bg-slate-800 border border-slate-600 rounded-full p-0.5 text-slate-400 hover:text-amber-400 hover:border-amber-500 transition-colors disabled:opacity-50"
                        >
                          <Unlock size={10} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedHour !== null && (
                <p className="text-xs text-slate-500 mt-2">
                  Créneau {selectedHour.toString().padStart(2,'0')}h —{' '}
                  {releveByHour[selectedHour]?.saisi_par
                    ? `Rempli par ${releveByHour[selectedHour].saiseur?.prenom || '?'} ${releveByHour[selectedHour].saiseur?.nom || ''}`
                    : 'En attente de saisie'}
                </p>
              )}
            </div>

            {/* ── Heure + Opérateur : toujours visible ── */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-0.5">Heure du relevé</label>
                <input type="datetime-local" value={form.heure_releve}
                  onChange={e => f('heure_releve', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-0.5">Opérateur</label>
                <div className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-white text-sm flex items-center justify-between">
                  <span>{user?.prenom} {user?.nom}</span>
                  {form.poste_id && postes && (
                    <span className="text-xs text-amber-400/70 ml-2">
                      {TRANCHE_LABELS[postes.find((p: Poste) => p.id === form.poste_id)?.tranche as keyof typeof TRANCHE_LABELS] ?? ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══════════════ ONGLET SAISIE ═══════════════ */}
        {journee && pageTab === 'saisie' && (
          <div className="space-y-6">
            {formDisabled && (
              <div className={`rounded-lg px-4 py-3 text-sm border ${
                selectedHour !== null && isSlotLocked(selectedHour)
                  ? 'bg-green-500/5 border-green-500/20 text-green-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                {selectedHour === null
                  ? '⬆ Sélectionnez un créneau ci-dessus pour saisir un relevé.'
                  : selectedHour !== null && isSlotLocked(selectedHour)
                    ? '✓ Ce relevé a déjà été saisi — lecture seule.'
                    : '⏳ Ce créneau est dans le futur — saisie impossible.'}
              </div>
            )}
            <div className={`bg-slate-900 border border-slate-700 rounded-lg p-5 ${formDisabled ? 'pointer-events-none opacity-60' : ''}`} data-form>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

                {/* ── Colonne 1 : Eau de Réf. → TS (fin : Niveau conservateur TS) ── */}
                <div className="space-y-2">
                  <SectHead t="Eau de Refroidissement" />
                  <BtnGroup label="Choix de la pompe" name="choix_pompe" value={form.choix_pompe} set={f} opts={['P1', 'P2', 'P1+P2']} />
                  <F label="Pres. de refoulement pompe" name="pression_refoul_pompe_bar" value={form.pression_refoul_pompe_bar} set={f} unit="bar" />
                  <F label="Nbre de ventilateur en service" name="nb_ventilateurs_service" value={form.nb_ventilateurs_service} set={f} unit="n°" />
                  <F label="Temp. entrée réf. WTAD1" name="temp_entree_ref_wtad1" value={form.temp_entree_ref_wtad1} set={f} unit="°C" />
                  <F label="Temp. sortie réf. WTAD" name="temp_sortie_ref_wtad2" value={form.temp_sortie_ref_wtad2} set={f} unit="°C" />
                  <F label="Pres. retour eau de réf." name="pression_retour_eau_ref" value={form.pression_retour_eau_ref} set={f} unit="bar" />
                  <F label="Pres. sortie eau réf. Alt." name="pression_sortie_ref_alt" value={form.pression_sortie_ref_alt} set={f} unit="bar" />
                  <LevelGauge label="Niveau réservoir d'expansion" name="niveau_reservoir_expansion" value={form.niveau_reservoir_expansion} set={f} />
                  <SectHead t="Skid Gaz" />
                  <F label="Température gaz FTG-TKG" name="temp_gaz_ftg_tkg" value={form.temp_gaz_ftg_tkg} set={f} unit="°C" />
                  <F label="Pression gaz FPGI" name="pression_gaz_fpgi_bar" value={form.pression_gaz_fpgi_bar} set={f} unit="bar" />
                  <F label="ΔP filtre" name="dp_filtre_gaz_bar" value={form.dp_filtre_gaz_bar} set={f} unit="bar" />
                  <SectHead t="Skid Gasoil" />
                  <F label="Pression entrée skid" name="pression_entree_skid" value={form.pression_entree_skid} set={f} unit="bar" />
                  <F label="ΔP filtre" name="dp_filtre_gasoil_bar" value={form.dp_filtre_gasoil_bar} set={f} unit="bar" />
                  <SectHead t="Huile de Graissage" />
                  <LevelGauge label="Niveau d'huile du réservoir" name="niveau_huile_reservoir" value={form.niveau_huile_reservoir} set={f} />
                  <BtnGroup label="Choix du filtre à huile" name="choix_filtre_huile" value={form.choix_filtre_huile} set={f} opts={['F1', 'F2']} />
                  <BtnGroup label="Choix du réfrigérant d'huile" name="choix_refrigerant_huile" value={form.choix_refrigerant_huile} set={f} opts={['R1', 'R2']} />
                  <SectHead t="Air d'Atomisation" />
                  <F label="Pression d'air d'atomisation" name="pression_air_atomisation" value={form.pression_air_atomisation} set={f} unit="bar" />
                  <SectHead t="Filtre à Air" />
                  <F label="ΔP totale filtre" name="dp_totale_filtre_kpa" value={form.dp_totale_filtre_kpa} set={f} unit="kPa" />
                  <F label="ΔP pré-filtre" name="dp_pre_filtre_kpa" value={form.dp_pre_filtre_kpa} set={f} unit="kPa" />
                  <F label="ΔP filtre" name="dp_filtre_kpa" value={form.dp_filtre_kpa} set={f} unit="kPa" />
                  <SectHead t="Compresseurs ERVOR" />
                  <F label="Pression Air Comprimée" name="pression_air_comprime_bar" value={form.pression_air_comprime_bar} set={f} unit="bar" />
                  <SectHead t="Contrôle TP" />
                  <F label="Température huile" name="temp_huile_tp" value={form.temp_huile_tp} set={f} unit="°C" />
                  <F label="Température Enroulement" name="temp_enroulement_tp" value={form.temp_enroulement_tp} set={f} unit="°C" />
                  <LevelGauge label="Niveau conservateur" name="niv_conservateur_tp" value={form.niv_conservateur_tp} set={f} />
                  <BtnGroup label="Choix de ventilateur" name="choix_ventilateur_tp" value={form.choix_ventilateur_tp} set={f} opts={['V1', 'V2', 'V1+V2']} />
                  <F label="Parafoudres phase R" name="para_r" value={dg.para_r} set={det} unit="UN" />
                  <F label="Parafoudres phase S" name="para_s" value={dg.para_s} set={det} unit="UN" />
                  <F label="Parafoudres phase T" name="para_t" value={dg.para_t} set={det} unit="UN" />
                  <SectHead t="Contrôle TS" />
                  <F label="Température huile" name="temp_huile_ts" value={form.temp_huile_ts} set={f} unit="°C" />
                  <F label="Température enroulement" name="temp_enroulement_ts" value={form.temp_enroulement_ts} set={f} unit="°C" />
                  <LevelGauge label="Niveau conservateur de contrôle TS" name="niv_conservateur_ts" value={form.niv_conservateur_ts} set={f} />
                </div>

                {/* ── Colonne 2 : Incendie + GE + Détecteurs + Consignes ── */}
                <div className="space-y-2">
                  <SectHead t="Sécurité Incendie et Autres" />
                  <F label="Pression du circuit" name="pression_circuit_incendie" value={form.pression_circuit_incendie} set={f} unit="bar" />
                  <F label="Niveau gasoil PPE thermique" name="niveau_gasoil_ppe_pct" value={form.niveau_gasoil_ppe_pct} set={f} unit="%" />
                  <BtnGroup label="Pompe jockey" name="pompe_jockey" value={form.pompe_jockey} set={f} opts={['EN SERVICE', 'ARRET']} />
                  <F label="Paratonerre réservoir gasoil" name="paratonerre" value={dg.paratonerre} set={det} unit="UN" />
                  <SectHead t="Groupe Électrogène" />
                  <F label="Compteur gasoil" name="compteur_gasoil_ge_l" value={form.compteur_gasoil_ge_l} set={f} unit="L" />
                  <F label="Compteur énergie" name="compteur_energie_ge_kwh" value={form.compteur_energie_ge_kwh} set={f} unit="kWh" />
                  <F label="Stock gasoil" name="stock_gasoil_l" value={form.stock_gasoil_l} set={f} unit="L" />
                  <F label="T° huile de graissage" name="temp_huile_graissage_ge" value={form.temp_huile_graissage_ge} set={f} unit="°C" />
                  <F label="Pression huile de graissage" name="pression_huile_graissage_ge" value={form.pression_huile_graissage_ge} set={f} unit="bar" />
                  <F label="Température eau primaire" name="temp_eau_primaire_ge" value={form.temp_eau_primaire_ge} set={f} unit="°C" />
                  <F label="Température eau secondaire" name="temp_eau_secondaire_ge" value={form.temp_eau_secondaire_ge} set={f} unit="°C" />
                  <F label="Pression air de démarrage" name="pression_air_demarrage_ge" value={form.pression_air_demarrage_ge} set={f} unit="bar" />
                  <F label="Nombre heure de marche" name="nb_heures_marche_ge" value={form.nb_heures_marche_ge} set={f} unit="h" />
                  <SectHead t="Détecteurs Gaz" />
                  {(['ha_1','ha_2','ha_3','ha_4','ha_5','ha_6'] as const).map(k => (
                    <F key={k} label={`45 HA ${k.split('_')[1]}`} name={k} value={dg[k]} set={det} />
                  ))}
                  {(['ht_1','ht_2','ht_3','ht_4','ht_5','ht_6'] as const).map(k => (
                    <F key={k} label={`45 HT ${k.split('_')[1]}`} name={k} value={dg[k]} set={det} />
                  ))}
                </div>

              </div>

              {/* ── Consignes Particulières — pleine largeur ── */}
              <div className="mt-6 space-y-2">
                <SectHead t="Consignes Particulières" />
                <textarea value={form.consignes_particulieres || ''}
                  onChange={e => f('consignes_particulieres', e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) onEnter(e as any); }}
                  rows={3}
                  placeholder="Saisir les consignes particulières..."
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </div>

              <SaveBtn />
            </div>

            {/* Liste des relevés enregistrés */}
            {releves && releves.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg">
                <div className="px-4 py-3 border-b border-slate-700">
                  <h3 className="text-sm font-medium text-white">Relevés enregistrés — {releves.filter((r: any) => r.saisi_par).length} / {SLOT_HOURS.length}</h3>
                </div>
                <div className="divide-y divide-slate-800">
                  {releves.map((r: any) => (
                    <div key={r.id} className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors ${
                      selectedHour === getTunisHour(r.heure_releve) ? 'bg-amber-500/5' : 'hover:bg-slate-800/50'
                    }`} onClick={() => setSelectedHour(getTunisHour(r.heure_releve))}>
                      <span className="font-mono text-amber-400 text-sm w-14 flex-shrink-0">
                        {formatTunisHM(r.heure_releve)}
                      </span>
                      {r.saisi_par ? (
                        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <span className="text-slate-400">P refoul.: <span className="text-white">{r.pression_refoul_pompe_bar ?? '—'} bar</span></span>
                          <span className="text-slate-400">P gaz: <span className="text-white">{r.pression_gaz_fpgi_bar ?? '—'} bar</span></span>
                          <span className="text-slate-400">N. huile: <span className="text-white">{r.niveau_huile_reservoir ?? '—'}</span></span>
                          <span className="text-slate-400">Air cprimé: <span className="text-white">{r.pression_air_comprime_bar ?? '—'} bar</span></span>
                        </div>
                      ) : (
                        <span className="flex-1 text-xs text-amber-400/60 italic">En attente de saisie</span>
                      )}
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {r.saiseur ? `${r.saiseur.prenom} ${r.saiseur.nom}` : '—'}
                      </span>
                      {canDelete && (
                        <button onClick={e => { e.stopPropagation(); deleteMut.mutate(r.id); }}
                          className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ ONGLET COMPTEURS ═══════════════ */}
        {journee && pageTab === 'compteurs' && (
          <div className={`bg-slate-900 border border-slate-700 rounded-lg p-5 ${!canFill ? 'pointer-events-none opacity-60' : ''}`} data-form>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300 font-medium">Compteurs journaliers — Opérateur</p>
                <p className="text-xs text-slate-500 mt-0.5">Relevés indépendants — saisie à 00h, 07h, 18h, 22h et 24h.</p>
              </div>
              {cptLocked && (
                <span className="text-xs text-green-400 border border-green-500/30 bg-green-500/10 rounded px-2 py-1">
                  ✓ Enregistré
                </span>
              )}
            </div>

            <div className={`${CPT_COL} mb-1`}>
              <span className="text-xs text-slate-500">Désignation</span>
              <span className="text-xs text-slate-500 text-center">Unité</span>
              {['00h', '07h', '18h', '22h', '24h'].map(t => (
                <span key={t} className="text-xs text-slate-500 text-center">{t}</span>
              ))}
            </div>

            <div className={cptLocked ? 'pointer-events-none opacity-50' : ''}>
              <CptRow label="Énergie Active" unit="MWh"
                fields={['energie_active_00h','energie_active_07h','energie_active_18h','energie_active_22h','energie_active_24h']}
                vals={[cptForm.energie_active_00h,cptForm.energie_active_07h,cptForm.energie_active_18h,cptForm.energie_active_22h,cptForm.energie_active_24h]}
                set={cpt} />
              <CptRow2 label="Réactif Fourni" unit="MVARh"
                f00h="reactif_fourni_00h" f24h="reactif_fourni_24h"
                v00h={cptForm.reactif_fourni_00h} v24h={cptForm.reactif_fourni_24h}
                set={cpt} />
              <CptRow2 label="Réactif Absorbé" unit="MVARh"
                f00h="reactif_absorbe_00h" f24h="reactif_absorbe_24h"
                v00h={cptForm.reactif_absorbe_00h} v24h={cptForm.reactif_absorbe_24h}
                set={cpt} />
              <CptRow label="Auxiliaires" unit="MWh"
                fields={['auxiliaires_00h','auxiliaires_07h','auxiliaires_18h','auxiliaires_22h','auxiliaires_24h']}
                vals={[cptForm.auxiliaires_00h,cptForm.auxiliaires_07h,cptForm.auxiliaires_18h,cptForm.auxiliaires_22h,cptForm.auxiliaires_24h]}
                set={cpt} />

              {/* ── Auxiliaire Sur GRE (HT Site) ── */}
              <div className={`${CPT_COL} border-b border-slate-800 py-2`}>
                <div className="text-sm text-slate-300">Aux. Sur GRE <span className="text-xs text-slate-500">(HT Site)</span></div>
                <div className="text-xs text-slate-500 text-center">MWh</div>
                <div className="relative">
                  <div className="text-[9px] text-slate-600 mb-0.5 truncate">couplage GRE</div>
                  <input type="number" step="any" value={cptForm.aux_gre_couplage ?? ''} onKeyDown={onEnter}
                    onChange={e => cpt('aux_gre_couplage', e.target.value === '' ? null : parseFloat(e.target.value))}
                    className={INPUT_CLS} />
                </div>
                <div /><div /><div />
                <div className="relative">
                  <div className="text-[9px] text-slate-600 mb-0.5 truncate">av. découplage GRE</div>
                  <input type="number" step="any" value={cptForm.aux_gre_decouplage ?? ''} onKeyDown={onEnter}
                    onChange={e => cpt('aux_gre_decouplage', e.target.value === '' ? null : parseFloat(e.target.value))}
                    className={INPUT_CLS} />
                </div>
              </div>

              <CptRow2 label="Gasoil" unit="L"
                f00h="gasoil_00h_l" f24h="gasoil_24h_l"
                v00h={cptForm.gasoil_00h_l} v24h={cptForm.gasoil_24h_l}
                set={cpt} />
            </div>

            {/* Consommation Auxiliaire en Charge */}
            <div className={`mt-4 border border-slate-700 rounded-lg overflow-hidden ${cptLocked ? 'pointer-events-none opacity-50' : ''}`}>
              <div className="bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700">
                Consommation Auxiliaire en Charge (kWh)
              </div>
              <div className="p-3 space-y-2">
                {(cptForm.conso_aux_cycles as ConsoAuxCycle[] || []).map((c, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Compteur couplage {i + 1}</label>
                      <input type="number" step="any" value={c.couplage ?? ''} onKeyDown={onEnter}
                        onChange={e => setConsoAuxCycle(i, 'couplage', e.target.value === '' ? null : parseFloat(e.target.value))}
                        className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-0.5">Compteur découplage {i + 1}</label>
                      <input type="number" step="any" value={c.decouplage ?? ''} onKeyDown={onEnter}
                        onChange={e => setConsoAuxCycle(i, 'decouplage', e.target.value === '' ? null : parseFloat(e.target.value))}
                        className={INPUT_CLS} />
                    </div>
                    <button type="button" onClick={() => removeConsoAuxCycle(i)}
                      disabled={(cptForm.conso_aux_cycles || []).length <= 1}
                      title="Supprimer ce cycle"
                      className="text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors pb-2">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addConsoAuxCycle}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs transition-colors">
                  <Plus size={13} /> Ajouter un couplage/découplage
                </button>
                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-xs text-slate-500 mb-0.5">Consommation en charge totale (calculée, MWh)</label>
                  <div className="bg-slate-800/50 border border-slate-700 rounded px-2 py-1.5 text-amber-400 text-sm font-bold text-center">
                    {(() => { const t = consoAuxTotal(cptForm.conso_aux_cycles); return t != null ? t.toFixed(3) : '—'; })()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-slate-700">
              {cptLocked ? (
                /* ── Mode lecture : bouton Modifier ── */
                <button onClick={() => setCptConfirm(true)}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
                  <Pencil size={14} /> Modifier les compteurs
                </button>
              ) : (
                /* ── Mode édition : test + reset + enregistrer ── */
                <>
                  {/* TEST BUTTON — remove before production */}
                  <button onClick={() => setCptForm({
                    energie_active_00h: 98450, energie_active_07h: 99120, energie_active_18h: 100540, energie_active_22h: 101100, energie_active_24h: 101330,
                    reactif_fourni_00h: 8200, reactif_fourni_07h: 8380, reactif_fourni_18h: 8750, reactif_fourni_22h: 8900, reactif_fourni_24h: 8950,
                    reactif_absorbe_00h: 12400, reactif_absorbe_07h: 12580, reactif_absorbe_18h: 12900, reactif_absorbe_22h: 13050, reactif_absorbe_24h: 13100,
                    auxiliaires_00h: 4820, auxiliaires_07h: 4860, auxiliaires_18h: 4920, auxiliaires_22h: 4940, auxiliaires_24h: 4950,
                    gasoil_00h_l: 12450, gasoil_07h_l: 12520, gasoil_18h_l: 12620, gasoil_22h_l: 12660, gasoil_24h_l: 12680,
                    conso_aux_cycles: [
                      { couplage: 4820250, decouplage: 4870500 },
                      { couplage: 4900000, decouplage: 4950750 },
                    ],
                  })}
                    className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded px-3 py-1.5 text-xs transition-colors">
                    <FlaskConical size={12} /> Remplir test
                  </button>
                  <button onClick={() => { setCptForm({ ...(compteurs ?? {}), conso_aux_cycles: normalizeConsoAuxCycles(compteurs) }); if (compteurs?.id) setCptLocked(true); }}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
                    <RotateCcw size={13} /> Annuler
                  </button>
                  <button onClick={() => saveCptMut.mutate(cptForm)} disabled={saveCptMut.isPending}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-5 py-2 rounded-lg text-sm disabled:opacity-50 transition-colors">
                    <Save size={14} /> {saveCptMut.isPending ? 'Enregistrement...' : 'Enregistrer les compteurs'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Dialogue de confirmation modification compteurs ── */}
      {cptConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCptConfirm(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-6 shadow-xl">
            <p className="text-white font-semibold text-base mb-2">Modifier les compteurs ?</p>
            <p className="text-slate-400 text-sm mb-6">
              Les compteurs ont déjà été enregistrés. Voulez-vous les modifier ?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCptConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-colors">
                Non, annuler
              </button>
              <button onClick={() => { setCptLocked(false); setCptConfirm(false); }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-slate-900 transition-colors">
                Oui, modifier
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
