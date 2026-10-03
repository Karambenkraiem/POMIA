import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { relevesApi, journeesApi, postesApi } from '../lib/api';
import PageHeader from '../components/PageHeader';
import DateInput from '../components/DateInput';
import { Save, RotateCcw, FlaskConical, Gauge, Pencil, Unlock } from 'lucide-react';
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
  return [];
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

function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const box = (e.currentTarget as HTMLElement).closest('[data-form]') as HTMLElement;
  if (!box) return;
  const all = Array.from(box.querySelectorAll('input:not([disabled])')) as HTMLElement[];
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

function Titre({ t }: { t: string }) {
  return (
    <div className="col-span-full flex items-center gap-2 mt-3">
      <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest whitespace-nowrap">{t}</span>
      <div className="flex-1 h-px bg-slate-700" />
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

type CptRowProps = { label: string; nameA: string; nameB: string; a: any; b: any; set: (n: string, v: any) => void; unit?: string; isInt?: boolean; readOnly?: boolean };
function CptRow({ label, nameA, nameB, a, b, set, unit, isInt = false, readOnly = false }: CptRowProps) {
  const diff = (a != null && b != null) ? Number(b) - Number(a) : null;
  const parse = (v: string) => v === '' ? null : isInt ? parseInt(v) : parseFloat(v);
  const cellCls = 'bg-slate-800/50 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs text-center w-full';
  return (
    <tr className="border-b border-slate-800 hover:bg-slate-800/20">
      <td className="px-3 py-1.5 text-xs text-slate-300">
        {label}{unit && <span className="text-slate-500 ml-1">({unit})</span>}
        {readOnly && <span className="ml-1.5 text-[9px] text-slate-600 italic">opérateur</span>}
      </td>
      <td className="px-1.5 py-1">
        {readOnly
          ? <div className={cellCls}>{a != null ? Number(a).toFixed(isInt ? 0 : 1) : '—'}</div>
          : <input type="number" step={isInt ? '1' : 'any'} value={a ?? ''}
              onChange={e => set(nameA, parse(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-500 text-center" />}
      </td>
      <td className="px-1.5 py-1">
        {readOnly
          ? <div className={cellCls}>{b != null ? Number(b).toFixed(isInt ? 0 : 1) : '—'}</div>
          : <input type="number" step={isInt ? '1' : 'any'} value={b ?? ''}
              onChange={e => set(nameB, parse(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-amber-500 text-center" />}
      </td>
      <td className={`px-3 py-1.5 text-center text-xs font-bold ${diff == null ? 'text-slate-600' : diff < 0 ? 'text-red-400' : 'text-amber-400'}`}>
        {diff != null ? diff.toFixed(isInt ? 0 : 1) : '—'}
      </td>
    </tr>
  );
}
function CptSectionRow({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={4} className="px-3 py-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-slate-800/60 border-y border-slate-700">
        {title}
      </td>
    </tr>
  );
}

const EMPTY = (date: string, hour?: number, posteId?: string): any => ({
  heure_releve: hour !== undefined
    ? `${date}T${hour.toString().padStart(2, '0')}:00`
    : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  poste_id: posteId || '',
  generateur: {}, huile: {}, vibrations: {}, echappement: {}, metal_blanc: {},
});

export default function RelevesChefBloc() {
  const { user } = useAuth();
  const { toasts, show: showToast, dismiss } = useToast();
  const isChefBloc = user?.role === 'chef_bloc';
  const canCreate = ['chef_bloc', 'admin', 'chef_exploitation'].includes(user?.role ?? '');
  const canDelete = ['admin', 'chef_exploitation'].includes(user?.role ?? '');
  const canUnlock = ['chef_quart', 'chef_exploitation', 'admin'].includes(user?.role ?? '');
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [pageTab, setPageTab] = useState<'saisie' | 'compteurs'>(searchParams.get('tab') === 'compteurs' ? 'compteurs' : 'saisie');
  const [form, setForm] = useState<any>(EMPTY(format(new Date(), 'yyyy-MM-dd')));
  const [cptForm, setCptForm] = useState<any>({});
  const [cptLocked, setCptLocked] = useState(false);
  const [cptConfirm, setCptConfirm] = useState<'save' | 'modify' | null>(null);

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
    queryKey: ['releves-bloc', journee?.id],
    queryFn: () => relevesApi.listBloc(journee!.id),
    enabled: !!journee?.id,
  });

  const { data: compteursData, isFetching: cptFetching } = useQuery({
    queryKey: ['compteurs', journee?.id],
    queryFn: () => relevesApi.getCompteurs(journee!.id),
    enabled: !!journee?.id,
  });

  const releveByHour = useMemo(() => {
    const map: Record<number, any> = {};
    releves?.forEach((r: any) => { map[getTunisHour(r.heure_releve)] = r; });
    return map;
  }, [releves]);

  useEffect(() => {
    if (selectedHour === null || !journee) return;
    const releve = releveByHour[selectedHour];
    if (releve) {
      setForm({
        ...releve,
        heure_releve: formatTunisDateTimeLocal(releve.heure_releve),
        generateur: releve.generateur || {},
        huile: releve.huile || {},
        vibrations: releve.vibrations || {},
        echappement: releve.echappement || {},
        metal_blanc: releve.metal_blanc || {},
      });
    } else {
      const tranche = hourToTranche(selectedHour);
      const poste = postes?.find((p: any) => p.tranche === tranche);
      setForm(EMPTY(selectedDate, selectedHour, poste?.id));
    }
  }, [selectedHour]);

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
    setCptForm({ ...(compteursData ?? {}), conso_aux_cycles: normalizeConsoAuxCycles(compteursData) });
    setCptLocked(!!compteursData?.id);
  }, [journee?.id, compteursData, cptFetching]);

  const energieCalc = useMemo(() => {
    const n = (v: any) => v != null ? Number(v) : null;
    const ea00 = n(cptForm.energie_active_00h);
    const ea07 = n(cptForm.energie_active_07h);
    const ea18 = n(cptForm.energie_active_18h);
    const ea22 = n(cptForm.energie_active_22h);
    const ea24 = n(cptForm.energie_active_24h);
    const jour   = ea07 != null && ea18 != null ? ea18 - ea07 : null;
    const pointe = ea18 != null && ea22 != null ? ea22 - ea18 : null;
    const nuit   = ea22 != null && ea24 != null && ea00 != null && ea07 != null
      ? (ea24 - ea22) + (ea07 - ea00) : null;
    const total  = jour != null && pointe != null && nuit != null ? jour + pointe + nuit : null;
    return { jour, pointe, nuit, total };
  }, [cptForm.energie_active_00h, cptForm.energie_active_07h, cptForm.energie_active_18h, cptForm.energie_active_22h, cptForm.energie_active_24h]);

  const createMut = useMutation({
    mutationFn: (data: any) => relevesApi.createBloc(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['releves-bloc'] }); showToast('Relevé enregistré avec succès'); },
    onError: () => showToast('Erreur lors de l\'enregistrement', 'error'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => relevesApi.updateBloc(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['releves-bloc'] }); showToast('Relevé mis à jour'); },
    onError: () => showToast('Erreur lors de la mise à jour', 'error'),
  });

  const saveCptMut = useMutation({
    mutationFn: (data: any) => relevesApi.saveCompteurs(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compteurs'] }); showToast('Compteurs enregistrés'); setCptLocked(true); setCptConfirm(null); },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Erreur lors de l\'enregistrement des compteurs', 'error'),
  });

  const unlockMut = useMutation({
    mutationFn: (id: string) => relevesApi.deverrouillerBloc(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['releves-bloc'] }); showToast('Créneau déverrouillé pour correction'); },
    onError: () => showToast('Erreur lors du déverrouillage', 'error'),
  });

  function isSlotFuture(hour: number) {
    if (!isChefBloc) return false;
    return new Date(`${selectedDate}T${hour.toString().padStart(2, '0')}:00:00`) > new Date();
  }
  function isSlotLocked(hour: number) { return !!(releveByHour[hour]) && !releveByHour[hour].deverrouille; }
  const formDisabled = !canCreate || selectedHour === null || (selectedHour !== null && (isSlotFuture(selectedHour) || isSlotLocked(selectedHour)));

  function f(n: string, v: any) { setForm((s: any) => ({ ...s, [n]: v })); }
  function g(sub: string, n: string, v: any) { setForm((s: any) => ({ ...s, [sub]: { ...(s[sub] || {}), [n]: v } })); }
  const fc = (n: string, v: any) => setCptForm((s: any) => ({ ...s, [n]: v }));
  function handleSaveCpt() {
    if (!journee) return;
    saveCptMut.mutate({
      ...cptForm,
      journee_id: journee.id,
      energie_jour_mwh: energieCalc.jour,
      energie_pointe_mwh: energieCalc.pointe,
      energie_nuit_mwh: energieCalc.nuit,
    });
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

  // ── TEST DATA (remove before production) ──
  function fillTest() {
    setForm((s: any) => ({
      ...s,
      temp_ambiante_ctim: 28, pression_atm_afpap: 760, humidite_rhum: 65,
      dp_filtre_totale_tfdp: 12, dp_admis_comp_csdp: 8, dp_admission_afpcs: 5,
      temp_tunnel_ttib1: 32, temp_air_atomisation: 35, vitesse_turbine_rpm: 3000,
      position_tmgv_deg: 72.5, position_igv_deg: 84.0, tension_ligne_kv: 225.4,
      temp_entree_aeroref_wtad: 29, temp_sortie_aeroref_wtad: 42,
      temp_patte_turbine1_wttl1: 48, temp_patte_turbine2_wttl2: 47,
      temp_gaz_ftg_tkg: 38, press_skid_gaz_fpgi: 18.5, press_avant_srv_fgup: 17.8,
      press_inter_vanne_fpg2: 17.2, debit_massique_fqgm: 4.6, signal_reference_fsr: 78.3,
      press_refoul_cpd: 11.4, temp_entree_comp_ctifr: 28, temp_sortie_ctd: 310, debit_massique_comp: 195,
      generateur: {
        puissance_active_mw: 120, puissance_reactive_mvar: 30, frequence_hz: 50.01,
        cos_phi: 0.97, tension_alt_dvx_kv: 10.5, tension_svlx_kv: 225.4,
        tension_excitation_v: 185, courant_excitation_a: 920,
        temp_air_froid_a_gca1: 38, temp_air_froid_b_gca2: 39,
        temp_air_chaud_c_gha1: 72, temp_air_chaud_d_gha2: 73,
        temp_stator_e_gst1: 78, temp_stator_f_gst2: 79, temp_stator_g_gst3: 77,
        temp_stator_h_gst4: 80, temp_stator_i_gst5: 78, temp_stator_j_gst6: 79,
        temp_stator_k_gst7: 76, temp_stator_l_gst8: 78, temp_stator_m_gst9: 77,
        temp_air_excitation_gext: 65,
      },
      huile: {
        niveau_bac_huile_mm: 420, pression_qap3_bar: 1.8, pression_palier5_qgp: 1.6,
        temp_collecteur_ltth: 52, temp_cuve1_ltot1: 48, temp_cuve2_ltot2: 49,
        temp_butee_ltbt1d: 55, temp_palier1_ltb1d: 53, temp_palier2_ltb2d: 54,
        temp_palier3_ltb3d: 53, temp_palier4_lttg1d: 56, temp_palier5_ltg2d: 57,
        press_pompe_hp_attelee: 140, press_pompe_hp_elec: 138,
      },
      vibrations: {
        palier1_bb1: 1.2, palier1_bb2: 1.3, palier2_bb3: 1.5, palier2_bb4: 1.4,
        palier3_bb5: 1.1, palier4_bb10: 0.9, palier4_bb11: 1.0,
        palier1_bb12: 1.2, vibration_maxi: 1.5,
      },
      metal_blanc: {
        btta1_2: 62, btta1_5: 63, btta1_8: 61,
        btti1_2: 60, btti1_5: 61, btti1_9: 62,
        btj1_1: 65, btj1_2: 64, btj2_1: 66, btj2_2: 65,
        btj3_1: 63, btj3_2: 64, btgj1_1_p4: 67, btgj1_1_p5: 68,
        ttws1fi1: 480, ttws1fi2: 482, ttws1_01: 478, ttws1_02: 479,
        ttws2f01: 510, ttws2f02: 512, ttws2a01: 508, ttws2a02: 509,
        ttws3f01: 535, ttws3f02: 537, ttws3a01: 533, ttws3a02: 534,
      },
      echappement: {
        ttxm_moyenne: 542, ttxspl_ecart: 18, ttxsp1: 540, ttxsp2: 544, ttxsp3: 541,
        ...Object.fromEntries(
          Array.from({length:24},(_,i)=>[`ttxd_${String(i+1).padStart(2,'0')}`, 535 + Math.round(Math.random()*20)])
        ),
      },
    }));
  }

  const ge = form.generateur || {};
  const hu = form.huile || {};
  const vi = form.vibrations || {};
  const ec = form.echappement || {};
  const mb = form.metal_blanc || {};

  const SaveBtn = () => (
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
      <button onClick={handleSave} disabled={isPending || selectedHour === null || formDisabled}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-5 py-2 rounded-lg text-sm disabled:opacity-50 transition-colors">
        <Save size={14} /> {isPending ? 'Enregistrement...' : 'Enregistrer le relevé'}
      </button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Relevés Chef de Bloc" subtitle="Saisie des paramètres toutes les 2 heures"
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

      <div className="p-3 sm:p-6 space-y-4">
        {!journee && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
            Aucune journée créée pour le {format(new Date(selectedDate + 'T12:00:00'), 'd MMMM yyyy', { locale: fr })}
          </div>
        )}

        {journee && (
          <>
            {/* Grille des 12 créneaux */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-medium">Créneaux du jour — cliquer pour saisir</p>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                {SLOT_HOURS.map(hour => {
                  const releve = releveByHour[hour];
                  const isFilled = !!releve;
                  const isUnlockedForCorrection = isFilled && !!releve.deverrouille;
                  const isSelected = selectedHour === hour;
                  const future = isSlotFuture(hour);
                  const locked = isSlotLocked(hour);
                  const disabled = future || locked || !canCreate;
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
                  {releveByHour[selectedHour]
                    ? `Rempli par ${releveByHour[selectedHour].saiseur?.prenom || '?'} ${releveByHour[selectedHour].saiseur?.nom || ''}`
                    : 'En attente de saisie'}
                </p>
              )}
            </div>
          </>
        )}

        {journee && pageTab === 'compteurs' && (
          <>
            {/* ── Compteurs Journaliers ── */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <Gauge size={14} className="text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Compteurs Journaliers</h3>
                  <span className="text-xs text-slate-500">— saisie une fois par jour</span>
                </div>
                {cptLocked && (
                  <span className="text-xs text-green-400 border border-green-500/30 bg-green-500/10 rounded px-2 py-1">
                    ✓ Enregistré
                  </span>
                )}
              </div>

              <div className={`p-4 space-y-4${cptLocked ? ' pointer-events-none opacity-50' : ''}`}>
                {/* Energie Brute + Puissance Max */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Energie Brute — calculée depuis les index opérateur */}
                  <div className="border border-slate-700 rounded-lg overflow-hidden">
                    <div className="bg-slate-800 text-center text-xs font-bold text-slate-300 uppercase tracking-wider py-2 border-b border-slate-700">
                      Répartition Horaire Energie Brute (MWh)
                    </div>
                    <div className="grid grid-cols-4 border-b border-slate-800 text-center text-xs text-slate-500 py-1.5">
                      {['Jour', 'Pointe', 'Nuit', 'Total'].map(h => <span key={h}>{h}</span>)}
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-2">
                      {[energieCalc.jour, energieCalc.pointe, energieCalc.nuit, energieCalc.total].map((v, i) => (
                        <div key={i} className={`flex items-center justify-center rounded py-1.5 text-xs font-bold text-center ${
                          v != null ? (v < 0 ? 'text-red-400' : 'text-amber-400') : 'text-slate-600'
                        }`}>
                          {v != null ? v.toFixed(1) : '—'}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-600 text-center pb-2 px-2">
                      Calculé : Jour = E18h−E07h · Pointe = E22h−E18h · Nuit = (E24h−E22h)+(E07h−E00h)
                    </p>
                  </div>

                  {/* Puissance Max */}
                  <div className="border border-slate-700 rounded-lg overflow-hidden">
                    <div className="bg-slate-800 text-center text-xs font-bold text-slate-300 uppercase tracking-wider py-2 border-b border-slate-700">
                      Puissance Maximale
                    </div>
                    <div className="p-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Puissance max (MW)</label>
                        <input type="number" step="any" value={cptForm.puissance_max_mw ?? ''}
                          onChange={e => fc('puissance_max_mw', e.target.value === '' ? null : parseFloat(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">T° ambiante (°C)</label>
                        <input type="number" step="any" value={cptForm.temp_amb_puissance_max ?? ''}
                          onChange={e => fc('temp_amb_puissance_max', e.target.value === '' ? null : parseFloat(e.target.value))}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Heure</label>
                        <input type="time" value={cptForm.heure_puissance_max ?? ''}
                          onChange={e => fc('heure_puissance_max', e.target.value || null)}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Nature</label>
                        <select value={cptForm.nature_puissance_max ?? ''}
                          onChange={e => fc('nature_puissance_max', e.target.value || null)}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500">
                          <option value="">—</option>
                          {['PMC', 'AGC', 'PMS', 'PRESELECT', 'BASE'].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Consommation Auxiliaire — lecture seule (saisie par l'opérateur) */}
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-800 text-center text-xs font-bold text-slate-300 uppercase tracking-wider py-2 border-b border-slate-700">
                    Consommation Auxiliaire en Charge (kWh)
                  </div>
                  <div className="p-3 space-y-2">
                    {((cptForm.conso_aux_cycles as ConsoAuxCycle[]) || []).length === 0 ? (
                      <p className="text-xs text-slate-600 text-center py-2">Aucun cycle couplage/découplage saisi</p>
                    ) : (
                      ((cptForm.conso_aux_cycles as ConsoAuxCycle[]) || []).map((c, i) => (
                        <div key={i} className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-500 mb-0.5">Compteur couplage {i + 1}</label>
                            <div className="bg-slate-800/50 border border-slate-700 rounded px-2 py-1.5 text-white text-xs text-center">
                              {c.couplage != null ? Number(c.couplage).toFixed(3) : '—'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-0.5">Compteur découplage {i + 1}</label>
                            <div className="bg-slate-800/50 border border-slate-700 rounded px-2 py-1.5 text-white text-xs text-center">
                              {c.decouplage != null ? Number(c.decouplage).toFixed(3) : '—'}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    <div className="pt-2 border-t border-slate-800">
                      <label className="block text-xs text-slate-500 mb-0.5">Consommation en charge totale (calculée, MWh)</label>
                      <div className="bg-slate-800/50 border border-slate-700 rounded px-2 py-1.5 text-amber-400 text-xs font-bold text-center">
                        {(() => { const t = consoAuxTotal(cptForm.conso_aux_cycles); return t != null ? t.toFixed(3) : '—'; })()}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-600 text-center pb-2">Saisi par l'opérateur</p>
                </div>

                {/* Table 00h / 24h */}
                <div className="border border-slate-700 rounded-lg overflow-hidden">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-800 border-b border-slate-600">
                        <th className="text-left px-3 py-2 text-slate-400 font-medium">Désignation</th>
                        <th className="text-center px-3 py-2 text-slate-400 font-medium w-32">00h00</th>
                        <th className="text-center px-3 py-2 text-slate-400 font-medium w-32">24h00</th>
                        <th className="text-center px-3 py-2 text-slate-400 font-medium w-24">Diff.</th>
                      </tr>
                    </thead>
                    <tbody>
                      <CptSectionRow title="Compteurs Combustibles" />
                      <CptRow label="Comp. Gaz"    nameA="gaz_00h_nm3"  nameB="gaz_24h_nm3"  a={cptForm.gaz_00h_nm3}  b={cptForm.gaz_24h_nm3}  set={fc} unit="Nm³" />
                      <CptRow label="Comp. Gasoil" nameA="gasoil_00h_l" nameB="gasoil_24h_l" a={cptForm.gasoil_00h_l} b={cptForm.gasoil_24h_l} set={fc} unit="L" readOnly />

                      <CptSectionRow title="Démarrages & Déclenchements" />
                      <CptRow label="Dém. Manuel"   nameA="dem_manuel_00h"    nameB="dem_manuel_24h"    a={cptForm.dem_manuel_00h}    b={cptForm.dem_manuel_24h}    set={fc} isInt />
                      <CptRow label="Dém. Total"    nameA="dem_total_00h"     nameB="dem_total_24h"     a={cptForm.dem_total_00h}     b={cptForm.dem_total_24h}     set={fc} isInt />
                      <CptRow label="Dém. Rapide"   nameA="dem_rapide_00h"    nameB="dem_rapide_24h"    a={cptForm.dem_rapide_00h}    b={cptForm.dem_rapide_24h}    set={fc} isInt />
                      <CptRow label="Allumage"      nameA="allumage_00h"      nameB="allumage_24h"      a={cptForm.allumage_00h}      b={cptForm.allumage_24h}      set={fc} isInt />
                      <CptRow label="Déclenchement" nameA="declenchement_00h" nameB="declenchement_24h" a={cptForm.declenchement_00h} b={cptForm.declenchement_24h} set={fc} isInt />

                      <CptSectionRow title="Heures de Fonctionnement" />
                      <CptRow label="H. de flamme"  nameA="h_flamme_00h" nameB="h_flamme_24h" a={cptForm.h_flamme_00h} b={cptForm.h_flamme_24h} set={fc} unit="h" />
                      <CptRow label="H. PMS"        nameA="h_pms_00h"    nameB="h_pms_24h"    a={cptForm.h_pms_00h}    b={cptForm.h_pms_24h}    set={fc} unit="h" />
                      <CptRow label="H. fct en Gaz" nameA="h_gaz_00h"    nameB="h_gaz_24h"    a={cptForm.h_gaz_00h}    b={cptForm.h_gaz_24h}    set={fc} unit="h" />
                      <CptRow label="H. fct Gasoil" nameA="h_gasoil_00h" nameB="h_gasoil_24h" a={cptForm.h_gasoil_00h} b={cptForm.h_gasoil_24h} set={fc} unit="h" />

                      <CptSectionRow title="Énergie Active & Réactive" />
                      <CptRow label="Énergie active"  nameA="energie_active_00h"  nameB="energie_active_24h"  a={cptForm.energie_active_00h}  b={cptForm.energie_active_24h}  set={fc} unit="MWh" />
                      <CptRow label="Réactif fourni"  nameA="reactif_fourni_00h"  nameB="reactif_fourni_24h"  a={cptForm.reactif_fourni_00h}  b={cptForm.reactif_fourni_24h}  set={fc} unit="MVArh" />
                      <CptRow label="Réactif absorbé" nameA="reactif_absorbe_00h" nameB="reactif_absorbe_24h" a={cptForm.reactif_absorbe_00h} b={cptForm.reactif_absorbe_24h} set={fc} unit="MVArh" />
                      <CptRow label="Auxiliaires"     nameA="auxiliaires_00h"     nameB="auxiliaires_24h"     a={cptForm.auxiliaires_00h}     b={cptForm.auxiliaires_24h}     set={fc} unit="MWh" />
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer save / modify */}
              <div className="flex justify-end gap-3 px-4 py-3 border-t border-slate-700">
                {cptLocked ? (
                  <button onClick={() => setCptConfirm('modify')}
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors">
                    <Pencil size={14} /> Modifier les compteurs
                  </button>
                ) : (
                  <>
                    <button onClick={() => { setCptForm({ ...(compteursData ?? {}), conso_aux_cycles: normalizeConsoAuxCycles(compteursData) }); if (compteursData?.id) setCptLocked(true); }}
                      className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
                      <RotateCcw size={13} /> Annuler
                    </button>
                    <button onClick={() => setCptConfirm('save')} disabled={saveCptMut.isPending || !canCreate}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-medium px-5 py-2 rounded-lg text-sm transition-colors">
                      <Save size={14} /> {saveCptMut.isPending ? 'Enregistrement...' : 'Enregistrer les compteurs'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {journee && pageTab === 'saisie' && (
          <>
            {/* Heure + Chef de Bloc */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-0.5">Heure du relevé</label>
                <input type="datetime-local" value={form.heure_releve} onChange={e => f('heure_releve', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-0.5">Chef de Bloc</label>
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

            {/* Formulaire */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">

                {/* ── Colonne 1 : Conditions + Réfrigération + Huile ── */}
                <div className="space-y-2">
                  <SectHead t="Conditions Ambiantes & TG" />
                  <F label="Temp. ambiante CTIM"        name="temp_ambiante_ctim"    value={form.temp_ambiante_ctim}    set={f} unit="°C" />
                  <F label="Press. atm. AFPAP"           name="pression_atm_afpap"    value={form.pression_atm_afpap}    set={f} unit="mmHg" />
                  <F label="Humidité RHUM"               name="humidite_rhum"          value={form.humidite_rhum}          set={f} unit="%" />
                  <F label="ΔP filtre totale TFDP"       name="dp_filtre_totale_tfdp" value={form.dp_filtre_totale_tfdp} set={f} unit="mmH₂O" />
                  <F label="ΔP admis. comp. CSDP"        name="dp_admis_comp_csdp"    value={form.dp_admis_comp_csdp}    set={f} unit="mmH₂O" />
                  <F label="ΔP admission AFPCS"          name="dp_admission_afpcs"    value={form.dp_admission_afpcs}    set={f} unit="mmH₂O" />
                  <F label="Temp. tunnel TTIB-1"         name="temp_tunnel_ttib1"     value={form.temp_tunnel_ttib1}     set={f} unit="°C" />
                  <F label="Temp. air atomisation"       name="temp_air_atomisation"  value={form.temp_air_atomisation}  set={f} unit="°C" />
                  <F label="Vitesse turbine"             name="vitesse_turbine_rpm"   value={form.vitesse_turbine_rpm}   set={f} unit="RPM" />
                  <F label="Position TMGV"               name="position_tmgv_deg"     value={form.position_tmgv_deg}     set={f} unit="°" />
                  <F label="Position IGV"                name="position_igv_deg"      value={form.position_igv_deg}      set={f} unit="°" />
                  <F label="Tension ligne"               name="tension_ligne_kv"      value={form.tension_ligne_kv}      set={f} unit="kV" />
                  <SectHead t="Circuit Réfrigération" />
                  <F label="Temp. entrée aéro-réf WTAD"   name="temp_entree_aeroref_wtad"  value={form.temp_entree_aeroref_wtad}  set={f} unit="°C" />
                  <F label="Temp. sortie aéro-réf WTAD"   name="temp_sortie_aeroref_wtad"  value={form.temp_sortie_aeroref_wtad}  set={f} unit="°C" />
                  <F label="Temp. patte turbine 1 WTTL-1" name="temp_patte_turbine1_wttl1" value={form.temp_patte_turbine1_wttl1} set={f} unit="°C" />
                  <F label="Temp. patte turbine 2 WTTL-2" name="temp_patte_turbine2_wttl2" value={form.temp_patte_turbine2_wttl2} set={f} unit="°C" />
                  <SectHead t="Huile de Graissage" />
                  <F label="Niveau bac à huile"              name="niveau_bac_huile_mm"      value={hu.niveau_bac_huile_mm}      set={(n,v)=>g('huile',n,v)} unit="mm" />
                  <F label="Pression QAP 3"                  name="pression_qap3_bar"        value={hu.pression_qap3_bar}        set={(n,v)=>g('huile',n,v)} unit="bar" />
                  <F label="Pression palier n°5 QGP"         name="pression_palier5_qgp"     value={hu.pression_palier5_qgp}     set={(n,v)=>g('huile',n,v)} unit="bar" />
                  <F label="Temp. collecteur LTTH"           name="temp_collecteur_ltth"     value={hu.temp_collecteur_ltth}     set={(n,v)=>g('huile',n,v)} unit="°C" />
                  <F label="Temp. cuve 1 LTOT1"              name="temp_cuve1_ltot1"         value={hu.temp_cuve1_ltot1}         set={(n,v)=>g('huile',n,v)} unit="°C" />
                  <F label="Temp. cuve 2 LTOT2"              name="temp_cuve2_ltot2"         value={hu.temp_cuve2_ltot2}         set={(n,v)=>g('huile',n,v)} unit="°C" />
                  <F label="Temp. butée LTBT1-D"             name="temp_butee_ltbt1d"        value={hu.temp_butee_ltbt1d}        set={(n,v)=>g('huile',n,v)} unit="°C" />
                  <F label="T° retour palier n°1 LTB1-D"     name="temp_palier1_ltb1d"       value={hu.temp_palier1_ltb1d}       set={(n,v)=>g('huile',n,v)} unit="°C" />
                  <F label="T° retour palier n°2 LTB2-D"     name="temp_palier2_ltb2d"       value={hu.temp_palier2_ltb2d}       set={(n,v)=>g('huile',n,v)} unit="°C" />
                  <F label="T° retour palier n°3 LTB3-D"     name="temp_palier3_ltb3d"       value={hu.temp_palier3_ltb3d}       set={(n,v)=>g('huile',n,v)} unit="°C" />
                  <F label="T° retour palier n°4 LTTG1-D"    name="temp_palier4_lttg1d"      value={hu.temp_palier4_lttg1d}      set={(n,v)=>g('huile',n,v)} unit="°C" />
                  <F label="T° retour palier n°5 LTG2-D"     name="temp_palier5_ltg2d"       value={hu.temp_palier5_ltg2d}       set={(n,v)=>g('huile',n,v)} unit="°C" />
                  <F label="Press. pompe HP attelée HQP11"   name="press_pompe_hp_attelee"   value={hu.press_pompe_hp_attelee}   set={(n,v)=>g('huile',n,v)} unit="bar" />
                  <F label="Press. pompe HP électrique HQP12" name="press_pompe_hp_elec"     value={hu.press_pompe_hp_elec}      set={(n,v)=>g('huile',n,v)} unit="bar" />
                </div>

                {/* ── Colonne 2 : Générateur + Air Alternateur + Vibration ── */}
                <div className="space-y-2">
                  <SectHead t="Générateur" />
                  <F label="Puissance active"          name="puissance_active_mw"      value={ge.puissance_active_mw}      set={(n,v)=>g('generateur',n,v)} unit="MW" />
                  <F label="Puissance réactive"        name="puissance_reactive_mvar"  value={ge.puissance_reactive_mvar}  set={(n,v)=>g('generateur',n,v)} unit="MVAr" />
                  <F label="Fréquence"                 name="frequence_hz"             value={ge.frequence_hz}             set={(n,v)=>g('generateur',n,v)} unit="Hz" />
                  <F label="Cos φ"                    name="cos_phi"                  value={ge.cos_phi}                  set={(n,v)=>g('generateur',n,v)} />
                  <F label="Tension alternateur DVX"  name="tension_alt_dvx_kv"       value={ge.tension_alt_dvx_kv}       set={(n,v)=>g('generateur',n,v)} unit="kV" />
                  <F label="Tension SVLX"             name="tension_svlx_kv"          value={ge.tension_svlx_kv}          set={(n,v)=>g('generateur',n,v)} unit="kV" />
                  <F label="Tension excitation"       name="tension_excitation_v"     value={ge.tension_excitation_v}     set={(n,v)=>g('generateur',n,v)} unit="V" />
                  <F label="Courant excitation"       name="courant_excitation_a"     value={ge.courant_excitation_a}     set={(n,v)=>g('generateur',n,v)} unit="A" />
                  <SectHead t="Air Alternateur" />
                  <F label="Temp air froid A GCA-1"      name="temp_air_froid_a_gca1"    value={ge.temp_air_froid_a_gca1}    set={(n,v)=>g('generateur',n,v)} unit="°C" />
                  <F label="Temp air froid B GCA-2"      name="temp_air_froid_b_gca2"    value={ge.temp_air_froid_b_gca2}    set={(n,v)=>g('generateur',n,v)} unit="°C" />
                  <F label="Temp air chaud C GHA-1"      name="temp_air_chaud_c_gha1"    value={ge.temp_air_chaud_c_gha1}    set={(n,v)=>g('generateur',n,v)} unit="°C" />
                  <F label="Temp air chaud D GHA-2"      name="temp_air_chaud_d_gha2"    value={ge.temp_air_chaud_d_gha2}    set={(n,v)=>g('generateur',n,v)} unit="°C" />
                  {[['e_gst1','E GST-1'],['f_gst2','F GST-2'],['g_gst3','G GST-3'],['h_gst4','H GST-4'],
                    ['i_gst5','I GST-5'],['j_gst6','J GST-6'],['k_gst7','K GST-7'],['l_gst8','L GST-8'],['m_gst9','M GST-9']].map(([k,lbl]) => (
                    <F key={k} label={`Temp stator ${lbl}`} name={`temp_stator_${k}`} value={ge[`temp_stator_${k}`]} set={(n,v)=>g('generateur',n,v)} unit="°C" />
                  ))}
                  <F label="Temp air excitation N GEXT"  name="temp_air_excitation_gext" value={ge.temp_air_excitation_gext} set={(n,v)=>g('generateur',n,v)} unit="°C" />
                  <SectHead t="Vibration" />
                  {[['palier1_bb1','Palier n°1 BB-1'],['palier1_bb2','Palier n°1 BB-2'],['palier2_bb3','Palier n°2 BB-3'],
                    ['palier2_bb4','Palier n°2 BB-4'],['palier3_bb5','Palier n°3 BB-5'],['palier4_bb10','Palier n°4 BB-10'],
                    ['palier4_bb11','Palier n°4 BB-11'],['palier1_bb12','Palier n°1 BB-12'],['vibration_maxi','Vibration maxi BB max']].map(([k,lbl]) => (
                    <F key={k} label={lbl} name={k} value={vi[k]} set={(n,v)=>g('vibrations',n,v)} unit="mm/s" />
                  ))}
                </div>

                {/* ── Colonne 3 : Métal Blanc + Inter-Roue + Circuit Gaz ── */}
                <div className="space-y-2">
                  <SectHead t="Température Métal Blanc" />
                  <F label="Patin de butée (B) BTTA 1_2"  name="btta1_2"    value={mb.btta1_2}    set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Patin de butée (C) BTTA 1_5"  name="btta1_5"    value={mb.btta1_5}    set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Patin de butée (D) BTTA 1_8"  name="btta1_8"    value={mb.btta1_8}    set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Contre butée (E) BTTI 1_2"    name="btti1_2"    value={mb.btti1_2}    set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Contre butée (F) BTTI 1_5"    name="btti1_5"    value={mb.btti1_5}    set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Contre butée (G) BTTI 1_9"    name="btti1_9"    value={mb.btti1_9}    set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Palier n°1 (H) BTJ 1_1"       name="btj1_1"     value={mb.btj1_1}     set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Palier n°1 (I) BTJ 1_2"       name="btj1_2"     value={mb.btj1_2}     set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Palier n°2 (J) BTJ 2_1"       name="btj2_1"     value={mb.btj2_1}     set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Palier n°2 (K) BTJ 2_2"       name="btj2_2"     value={mb.btj2_2}     set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Palier n°3 (L) BTJ 3_1"       name="btj3_1"     value={mb.btj3_1}     set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Palier n°3 (M) BTJ 3_2"       name="btj3_2"     value={mb.btj3_2}     set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Palier n°4 (N) BTGJ 1_1"      name="btgj1_1_p4" value={mb.btgj1_1_p4} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Palier n°5 (O) BTGJ 1_1"      name="btgj1_1_p5" value={mb.btgj1_1_p5} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <SectHead t="Température Inter-Roue" />
                  <F label="Face avant 1ère roue TTWS1FI1"   name="ttws1fi1" value={mb.ttws1fi1} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Face avant 1ère roue TTWS1FI2"   name="ttws1fi2" value={mb.ttws1fi2} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Face arrière 1ère roue TTWS101"  name="ttws1_01" value={mb.ttws1_01} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Face arrière 1ère roue TTWS102"  name="ttws1_02" value={mb.ttws1_02} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Face avant 2ème roue TTWS2F01"   name="ttws2f01" value={mb.ttws2f01} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Face avant 2ème roue TTWS2F02"   name="ttws2f02" value={mb.ttws2f02} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Face arrière 2ème roue TTWS2A01" name="ttws2a01" value={mb.ttws2a01} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Face arrière 2ème roue TTWS2A02" name="ttws2a02" value={mb.ttws2a02} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Face avant 3ème roue TTWS3F01"   name="ttws3f01" value={mb.ttws3f01} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Face avant 3ème roue TTWS3F02"   name="ttws3f02" value={mb.ttws3f02} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Face arrière 3ème roue TTWS3A01" name="ttws3a01" value={mb.ttws3a01} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <F label="Face arrière 3ème roue TTWS3A02" name="ttws3a02" value={mb.ttws3a02} set={(n,v)=>g('metal_blanc',n,v)} unit="°C" />
                  <SectHead t="Circuit Gaz" />
                  <F label="Temp gaz FTG-TKG"        name="temp_gaz_ftg_tkg"       value={form.temp_gaz_ftg_tkg}       set={f} unit="°C" />
                  <F label="Press skid gaz FPGI"     name="press_skid_gaz_fpgi"    value={form.press_skid_gaz_fpgi}    set={f} unit="bar" />
                  <F label="Press avant SRV FGUP"    name="press_avant_srv_fgup"   value={form.press_avant_srv_fgup}   set={f} unit="bar" />
                  <F label="Press inter-vanne FPG2"  name="press_inter_vanne_fpg2" value={form.press_inter_vanne_fpg2} set={f} unit="bar" />
                  <F label="Débit massique FQGM"     name="debit_massique_fqgm"    value={form.debit_massique_fqgm}    set={f} unit="kg/s" />
                  <F label="Signal de référence FSR" name="signal_reference_fsr"   value={form.signal_reference_fsr}   set={f} unit="%" />
                </div>

                {/* ── Colonne 4 : Compresseur + Échappement ── */}
                <div className="space-y-2">
                  <SectHead t="Compresseur Axial" />
                  <F label="Press refoulement CPD"   name="press_refoul_cpd"       value={form.press_refoul_cpd}       set={f} unit="bar" />
                  <F label="Temp entrée com CTIFR"   name="temp_entree_comp_ctifr" value={form.temp_entree_comp_ctifr} set={f} unit="°C" />
                  <F label="Temp sortie CTD"         name="temp_sortie_ctd"        value={form.temp_sortie_ctd}        set={f} unit="°C" />
                  <F label="Débit massique"          name="debit_massique_comp"    value={form.debit_massique_comp}    set={f} unit="kg/s" />
                  <SectHead t="Température d'Échappement" />
                  <F label="Temp moyenne TTXM"       name="ttxm_moyenne"  value={ec.ttxm_moyenne}  set={(n,v)=>g('echappement',n,v)} unit="°C" />
                  <F label="Ecart admissible TTXSPL" name="ttxspl_ecart"  value={ec.ttxspl_ecart}  set={(n,v)=>g('echappement',n,v)} unit="°C" />
                  <F label="Ecart n°1 TTXSP1"        name="ttxsp1"        value={ec.ttxsp1}        set={(n,v)=>g('echappement',n,v)} unit="°C" />
                  <F label="Ecart n°2 TTXSP2"        name="ttxsp2"        value={ec.ttxsp2}        set={(n,v)=>g('echappement',n,v)} unit="°C" />
                  <F label="Ecart n°3 TTXSP3"        name="ttxsp3"        value={ec.ttxsp3}        set={(n,v)=>g('echappement',n,v)} unit="°C" />
                  {Array.from({length:24},(_,i)=>i+1).map(n => (
                    <F key={n} label={`Thermocouple TTXD_${n}`} name={`ttxd_${String(n).padStart(2,'0')}`} value={ec[`ttxd_${String(n).padStart(2,'0')}`]} set={(k,v)=>g('echappement',k,v)} unit="°C" />
                  ))}
                </div>

              </div>
              <SaveBtn />
            </div>

            {/* Liste relevés saisis */}
            {releves && releves.length > 0 && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg">
                <div className="px-4 py-3 border-b border-slate-700">
                  <h3 className="text-sm font-medium text-white">Relevés saisis — {releves.length} / {SLOT_HOURS.length}</h3>
                </div>
                <div className="divide-y divide-slate-800">
                  {releves.map((r: any) => (
                    <div key={r.id} className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                      selectedHour === getTunisHour(r.heure_releve) ? 'bg-amber-500/5' : ''
                    }`}>
                      <span className="font-mono text-amber-400 text-sm w-14 flex-shrink-0">{formatTunisHM(r.heure_releve)}</span>
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <span className="text-slate-400">T amb: <span className="text-white">{r.temp_ambiante_ctim ?? '—'}°C</span></span>
                        <span className="text-slate-400">RPM: <span className="text-white">{r.vitesse_turbine_rpm ?? '—'}</span></span>
                        <span className="text-slate-400">MW: <span className="text-white">{r.generateur?.puissance_active_mw ?? '—'}</span></span>
                        <span className="text-slate-400">Spread: <span className="text-white">{r.echappement?.spread_calcule ?? '—'}</span></span>
                      </div>
                      <span className="text-xs text-slate-500 flex-shrink-0">{r.saiseur?.prenom} {r.saiseur?.nom}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* ── Dialogue de confirmation enregistrement compteurs ── */}
      {cptConfirm === 'save' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCptConfirm(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-6 shadow-xl">
            <p className="text-white font-semibold text-base mb-2">Enregistrer les compteurs ?</p>
            <p className="text-slate-400 text-sm mb-6">
              Confirmez-vous l'enregistrement des compteurs journaliers ?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCptConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-colors">
                Non, annuler
              </button>
              <button onClick={handleSaveCpt}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 hover:bg-amber-600 text-slate-900 transition-colors">
                Oui, enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialogue de confirmation modification compteurs ── */}
      {cptConfirm === 'modify' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCptConfirm(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-6 shadow-xl">
            <p className="text-white font-semibold text-base mb-2">Modifier les compteurs ?</p>
            <p className="text-slate-400 text-sm mb-6">
              Les compteurs ont déjà été enregistrés. Voulez-vous les modifier ?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setCptConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-colors">
                Non, annuler
              </button>
              <button onClick={() => { setCptLocked(false); setCptConfirm(null); }}
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
