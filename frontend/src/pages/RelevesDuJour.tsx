import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { relevesApi, journeesApi } from '../lib/api';
import { useSelectedDate } from '../contexts/SelectedDateContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DateInput from '../components/DateInput';
import TimeInput from '../components/TimeInput';
import { getTunisHour, tunisLocalToISOString } from '../lib/tz';

const SLOT_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

// ─── Structure feuille opérateur ────────────────────────────────────────────
type FRow = { label: string; unit: string; get: (r: any) => any };
type FSection = { title: string; rows: FRow[] };

const OP_SECTIONS: FSection[] = [
  {
    title: 'EAU DE REFROIDISSEMENT',
    rows: [
      { label: 'Choix de la pompe',              unit: '—',   get: r => r?.choix_pompe },
      { label: 'Pres. de refoulement pompe',      unit: 'bar', get: r => r?.pression_refoul_pompe_bar },
      { label: 'Nbre de ventilateur en service',  unit: 'n°',  get: r => r?.nb_ventilateurs_service },
      { label: 'Temp. entrée réf. WTAD1',         unit: '°C',  get: r => r?.temp_entree_ref_wtad1 },
      { label: 'Temp. sortie réf. WTAD',          unit: '°C',  get: r => r?.temp_sortie_ref_wtad2 },
      { label: 'Pres. retour eau de réf.',        unit: 'bar', get: r => r?.pression_retour_eau_ref },
      { label: 'Pres. sortie eau de réf. Alt.',   unit: 'bar', get: r => r?.pression_sortie_ref_alt },
      { label: "Niveau réservoir d'expansion",    unit: '—',   get: r => r?.niveau_reservoir_expansion },
    ],
  },
  {
    title: 'SKID GAZ',
    rows: [
      { label: 'Température gaz FTG-TKG', unit: '°C',  get: r => r?.temp_gaz_ftg_tkg },
      { label: 'Pression gaz FPGI',        unit: 'bar', get: r => r?.pression_gaz_fpgi_bar },
      { label: 'ΔP filtre',                unit: 'bar', get: r => r?.dp_filtre_gaz_bar },
    ],
  },
  {
    title: 'SKID GASOIL',
    rows: [
      { label: 'Pression entrée skid', unit: 'bar', get: r => r?.pression_entree_skid },
      { label: 'ΔP filtre',            unit: 'bar', get: r => r?.dp_filtre_gasoil_bar },
    ],
  },
  {
    title: 'HUILE DE GRAISSAGE',
    rows: [
      { label: "Niveau d'huile du réservoir",    unit: '—', get: r => r?.niveau_huile_reservoir },
      { label: 'Choix du filtre à huile',         unit: '—', get: r => r?.choix_filtre_huile },
      { label: "Choix du réfrigérant d'huile",    unit: '—', get: r => r?.choix_refrigerant_huile },
    ],
  },
  {
    title: "AIR D'ATOMISATION",
    rows: [
      { label: "Pression d'air d'atomisation", unit: 'bar', get: r => r?.pression_air_atomisation },
    ],
  },
  {
    title: 'FILTRE À AIR',
    rows: [
      { label: 'ΔP totale filtre', unit: 'kPa', get: r => r?.dp_totale_filtre_kpa },
      { label: 'ΔP pré-filtre',    unit: 'kPa', get: r => r?.dp_pre_filtre_kpa },
      { label: 'ΔP filtre',        unit: 'kPa', get: r => r?.dp_filtre_kpa },
    ],
  },
  {
    title: 'COMPRESSEURS ERVOR',
    rows: [
      { label: 'Pression Air Comprimée', unit: 'bar', get: r => r?.pression_air_comprime_bar },
    ],
  },
  {
    title: 'CONTRÔLE TP',
    rows: [
      { label: 'Température huile',       unit: '°C', get: r => r?.temp_huile_tp },
      { label: 'Température Enroulement', unit: '°C', get: r => r?.temp_enroulement_tp },
      { label: 'Niveau conservateur',     unit: '—',  get: r => r?.niv_conservateur_tp },
      { label: 'Choix de ventilateur',    unit: '—',  get: r => r?.choix_ventilateur_tp },
      { label: 'Parafoudres phase R',     unit: 'UN', get: r => r?.detecteurs_gaz?.para_r },
      { label: 'Parafoudres phase S',     unit: 'UN', get: r => r?.detecteurs_gaz?.para_s },
      { label: 'Parafoudres phase T',     unit: 'UN', get: r => r?.detecteurs_gaz?.para_t },
    ],
  },
  {
    title: 'CONTRÔLE TS',
    rows: [
      { label: 'Température huile',      unit: '°C', get: r => r?.temp_huile_ts },
      { label: 'Température enroulement', unit: '°C', get: r => r?.temp_enroulement_ts },
      { label: 'Niveau conservateur',    unit: '—',  get: r => r?.niv_conservateur_ts },
    ],
  },
  {
    title: 'SÉCURITÉ INCENDIE ET AUTRES',
    rows: [
      { label: 'Pression du circuit',    unit: 'bar', get: r => r?.pression_circuit_incendie },
      { label: 'Niveau gasoil PPE',      unit: '%',   get: r => r?.niveau_gasoil_ppe_pct },
      { label: 'Pompe jockey',           unit: '—',   get: r => r?.pompe_jockey },
      { label: 'Paratonerre réservoir',  unit: 'UN',  get: r => r?.detecteurs_gaz?.paratonerre },
    ],
  },
  {
    title: 'GROUPE ÉLECTROGÈNE',
    rows: [
      { label: 'Compteur gasoil',           unit: 'L',   get: r => r?.compteur_gasoil_ge_l },
      { label: 'Compteur énergie',           unit: 'kWh', get: r => r?.compteur_energie_ge_kwh },
      { label: 'Stock gasoil',               unit: 'L',   get: r => r?.stock_gasoil_l },
      { label: "T° huile de graissage",      unit: '°C',  get: r => r?.temp_huile_graissage_ge },
      { label: 'Pression huile de graissage', unit: 'bar', get: r => r?.pression_huile_graissage_ge },
      { label: 'T° eau primaire',            unit: '°C',  get: r => r?.temp_eau_primaire_ge },
      { label: 'T° eau secondaire',          unit: '°C',  get: r => r?.temp_eau_secondaire_ge },
      { label: 'Pression air de démarrage',  unit: 'bar', get: r => r?.pression_air_demarrage_ge },
      { label: 'Nb heures de marche',        unit: 'h',   get: r => r?.nb_heures_marche_ge },
    ],
  },
  {
    title: 'DÉTECTEURS GAZ',
    rows: [
      ...[1,2,3,4,5,6].map(n => ({ label: `45 HA ${n}`, unit: '—', get: (r: any) => r?.detecteurs_gaz?.[`ha_${n}`] })),
      ...[1,2,3,4,5,6].map(n => ({ label: `45 HT ${n}`, unit: '—', get: (r: any) => r?.detecteurs_gaz?.[`ht_${n}`] })),
    ],
  },
];

// ─── Structure feuille Chef de Bloc ─────────────────────────────────────────
type BRow = { label: string; unit: string; get: (r: any) => any };
type BSection = { title: string; rows: BRow[] };

const BLOC_SECTIONS: BSection[] = [
  {
    title: 'CONDITIONS AMBIANTES & TURBINE',
    rows: [
      { label: 'Temp. ambiante CTIM',         unit: '°C',    get: r => r?.temp_ambiante_ctim },
      { label: 'Press. atmosphérique AFPAP',  unit: 'mmHg',  get: r => r?.pression_atm_afpap },
      { label: 'Humidité RHUM',               unit: '%',     get: r => r?.humidite_rhum },
      { label: 'ΔP filtre totale TFDP',       unit: 'mmH₂O', get: r => r?.dp_filtre_totale_tfdp },
      { label: 'ΔP admis. comp. CSDP',        unit: 'mmH₂O', get: r => r?.dp_admis_comp_csdp },
      { label: 'ΔP admission AFPCS',          unit: 'mmH₂O', get: r => r?.dp_admission_afpcs },
      { label: 'Temp. tunnel TTIB-1',         unit: '°C',    get: r => r?.temp_tunnel_ttib1 },
      { label: 'Temp. air atomisation',       unit: '°C',    get: r => r?.temp_air_atomisation },
      { label: 'Vitesse turbine',             unit: 'RPM',   get: r => r?.vitesse_turbine_rpm },
      { label: 'Position TMGV',              unit: 'Deg',   get: r => r?.position_tmgv_deg },
      { label: 'Position IGV',               unit: 'Deg',   get: r => r?.position_igv_deg },
      { label: 'Tension ligne',              unit: 'kV',    get: r => r?.tension_ligne_kv },
    ],
  },
  {
    title: 'CIRCUIT RÉFRIGÉRATION',
    rows: [
      { label: 'Temp. eau entrée aéro-réf WTAD', unit: '°C', get: r => r?.temp_entree_aeroref_wtad },
      { label: 'Temp. eau sortie aéro-réf WTAD', unit: '°C', get: r => r?.temp_sortie_aeroref_wtad },
      { label: 'Temp. patte turbine 1(G) WTTL-1', unit: '°C', get: r => r?.temp_patte_turbine1_wttl1 },
      { label: 'Temp. patte turbine 2(D) WTTL-2', unit: '°C', get: r => r?.temp_patte_turbine2_wttl2 },
    ],
  },
  {
    title: 'HUILE DE GRAISSAGE',
    rows: [
      { label: 'Niveau bac à huile',              unit: 'mm',  get: r => r?.huile?.niveau_bac_huile_mm },
      { label: 'Pression QAP 3',                  unit: 'bar', get: r => r?.huile?.pression_qap3_bar },
      { label: 'Pression palier n°5 QGP',         unit: 'bar', get: r => r?.huile?.pression_palier5_qgp },
      { label: 'Temp. collecteur LTTH',           unit: '°C',  get: r => r?.huile?.temp_collecteur_ltth },
      { label: 'Temp. cuve à huile 1 LTOT1',     unit: '°C',  get: r => r?.huile?.temp_cuve1_ltot1 },
      { label: 'Temp. cuve à huile 2 LTOT2',     unit: '°C',  get: r => r?.huile?.temp_cuve2_ltot2 },
      { label: 'Temp. butée LTBT1-D',            unit: '°C',  get: r => r?.huile?.temp_butee_ltbt1d },
      { label: 'T° retour palier n°1 LTB1-D',   unit: '°C',  get: r => r?.huile?.temp_palier1_ltb1d },
      { label: 'T° retour palier n°2 LTB2-D',   unit: '°C',  get: r => r?.huile?.temp_palier2_ltb2d },
      { label: 'T° retour palier n°3 LTB3-D',   unit: '°C',  get: r => r?.huile?.temp_palier3_ltb3d },
      { label: 'T° retour palier n°4 LTTG1-D',  unit: '°C',  get: r => r?.huile?.temp_palier4_lttg1d },
      { label: 'T° retour palier n°5 LTG2-D',   unit: '°C',  get: r => r?.huile?.temp_palier5_ltg2d },
      { label: 'Press. pompe HP attelée HQP11',  unit: 'bar', get: r => r?.huile?.press_pompe_hp_attelee },
      { label: 'Press. pompe HP électrique HQP12', unit: 'bar', get: r => r?.huile?.press_pompe_hp_elec },
    ],
  },
  {
    title: 'GÉNÉRATEUR',
    rows: [
      { label: 'Puissance active DVATT',       unit: 'MW',   get: r => r?.generateur?.puissance_active_mw },
      { label: 'Puissance réactive DVAR',      unit: 'MVAr', get: r => r?.generateur?.puissance_reactive_mvar },
      { label: 'Fréquence DF',                 unit: 'Hz',   get: r => r?.generateur?.frequence_hz },
      { label: 'COS φ DPF',                   unit: '—',    get: r => r?.generateur?.cos_phi },
      { label: 'Tension alternateur DVX',      unit: 'kV',   get: r => r?.generateur?.tension_alt_dvx_kv },
      { label: 'Tension ligne SVLX',           unit: 'kV',   get: r => r?.generateur?.tension_svlx_kv },
      { label: 'Tension excitation',           unit: 'V',    get: r => r?.generateur?.tension_excitation_v },
      { label: 'Courant excitation',           unit: 'A',    get: r => r?.generateur?.courant_excitation_a },
      { label: 'T° air froid A GCA1',          unit: '°C',   get: r => r?.generateur?.temp_air_froid_a_gca1 },
      { label: 'T° air froid B GCA2',          unit: '°C',   get: r => r?.generateur?.temp_air_froid_b_gca2 },
      { label: 'T° air chaud C GHA1',          unit: '°C',   get: r => r?.generateur?.temp_air_chaud_c_gha1 },
      { label: 'T° air chaud D GHA2',          unit: '°C',   get: r => r?.generateur?.temp_air_chaud_d_gha2 },
      ...['e_gst1','f_gst2','g_gst3','h_gst4','i_gst5','j_gst6','k_gst7','l_gst8','m_gst9'].map(k => ({
        label: `T° stator ${k.toUpperCase()}`, unit: '°C', get: (r: any) => r?.generateur?.[`temp_stator_${k}`],
      })),
      { label: 'T° air excitation GEXT',      unit: '°C',   get: r => r?.generateur?.temp_air_excitation_gext },
    ],
  },
  {
    title: 'COMPRESSEUR & SKID GAZ',
    rows: [
      { label: 'Press. refoul. CPD',         unit: 'bar',  get: r => r?.press_refoul_cpd },
      { label: 'Temp. entrée comp. CTIFR',   unit: '°C',   get: r => r?.temp_entree_comp_ctifr },
      { label: 'Temp. sortie CTD',           unit: '°C',   get: r => r?.temp_sortie_ctd },
      { label: 'Débit massique comp.',       unit: 'kg/s', get: r => r?.debit_massique_comp },
      { label: 'Temp. gaz FTG-TKG',          unit: '°C',   get: r => r?.temp_gaz_ftg_tkg },
      { label: 'Press. skid gaz FPGI',       unit: 'bar',  get: r => r?.press_skid_gaz_fpgi },
      { label: 'Press. avant SRV FGUP',      unit: 'bar',  get: r => r?.press_avant_srv_fgup },
      { label: 'Press. inter vanne FPG2',    unit: 'bar',  get: r => r?.press_inter_vanne_fpg2 },
      { label: 'Débit massique FQGm',        unit: 'kg/s', get: r => r?.debit_massique_fqgm },
      { label: 'Signal référence FSR',       unit: '%',    get: r => r?.signal_reference_fsr },
    ],
  },
  {
    title: 'VIBRATIONS',
    rows: [
      { label: 'Palier 1 BB1',    unit: 'mm/s', get: r => r?.vibrations?.palier1_bb1 },
      { label: 'Palier 1 BB2',    unit: 'mm/s', get: r => r?.vibrations?.palier1_bb2 },
      { label: 'Palier 2 BB3',    unit: 'mm/s', get: r => r?.vibrations?.palier2_bb3 },
      { label: 'Palier 2 BB4',    unit: 'mm/s', get: r => r?.vibrations?.palier2_bb4 },
      { label: 'Palier 3 BB5',    unit: 'mm/s', get: r => r?.vibrations?.palier3_bb5 },
      { label: 'Palier 4 BB10',   unit: 'mm/s', get: r => r?.vibrations?.palier4_bb10 },
      { label: 'Palier 4 BB11',   unit: 'mm/s', get: r => r?.vibrations?.palier4_bb11 },
      { label: 'Palier 1 BB12',   unit: 'mm/s', get: r => r?.vibrations?.palier1_bb12 },
      { label: 'Vibration maxi',  unit: 'mm/s', get: r => r?.vibrations?.vibration_maxi },
    ],
  },
  {
    title: 'ÉCHAPPEMENT',
    rows: [
      { label: 'TTXM moyenne',  unit: '°C', get: r => r?.echappement?.ttxm_moyenne },
      { label: 'TTXSPL écart',  unit: '°C', get: r => r?.echappement?.ttxspl_ecart },
      { label: 'TTXSP1',        unit: '°C', get: r => r?.echappement?.ttxsp1 },
      { label: 'TTXSP2',        unit: '°C', get: r => r?.echappement?.ttxsp2 },
      { label: 'TTXSP3',        unit: '°C', get: r => r?.echappement?.ttxsp3 },
      ...Array.from({length:24},(_,i)=>String(i+1).padStart(2,'0')).map(n => ({
        label: `TTXD-${n}`, unit: '°C', get: (r: any) => r?.echappement?.[`ttxd_${n}`],
      })),
      { label: 'Spread calculé', unit: '°C', get: r => r?.echappement?.spread_calcule },
    ],
  },
  {
    title: 'MÉTAL BLANC',
    rows: [
      ...['btta1_2','btta1_5','btta1_8','btti1_2','btti1_5','btti1_9',
          'btj1_1','btj1_2','btj2_1','btj2_2','btj3_1','btj3_2','btgj1_1_p4','btgj1_1_p5',
          'ttws1fi1','ttws1fi2','ttws1_01','ttws1_02',
          'ttws2f01','ttws2f02','ttws2a01','ttws2a02',
          'ttws3f01','ttws3f02','ttws3a01','ttws3a02'].map(k => ({
        label: k.toUpperCase(), unit: '°C', get: (r: any) => r?.metal_blanc?.[k],
      })),
    ],
  },
];

// ─── Page principale ─────────────────────────────────────────────────────────
type ChartTarget = { label: string; unit: string; get: (r: any) => any; source: 'op' | 'bloc' };

export default function RelevesDuJour() {
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [activeTab, setActiveTab] = useState<'op' | 'bloc'>('op');
  const [chartTarget, setChartTarget] = useState<ChartTarget | null>(null);
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  function openChart(row: FRow | BRow, source: 'op' | 'bloc') {
    setChartTarget({ ...row, source });
    setRangeFrom(`${selectedDate}T00:00`);
    setRangeTo(`${selectedDate}T23:59`);
  }

  const apiSource = chartTarget?.source === 'bloc' ? 'bloc' : 'operateur';
  const fromISO = rangeFrom ? tunisLocalToISOString(rangeFrom) : '';
  const toISO = rangeTo ? tunisLocalToISOString(rangeTo) : '';
  const { data: chartRows, isLoading: chartLoading } = useQuery({
    queryKey: ['releves-plage', apiSource, fromISO, toISO],
    queryFn: () => relevesApi.range(apiSource, fromISO, toISO),
    enabled: !!chartTarget && !!fromISO && !!toISO,
  });
  const chartData = chartTarget
    ? (chartRows || [])
        .map((r: any) => ({
          date: format(new Date(r.heure_releve), 'dd/MM HH:mm', { locale: fr }),
          value: Number(chartTarget.get(r)),
        }))
        .filter((p: any) => p.value != null && !Number.isNaN(p.value))
    : [];

  const { data: journees } = useQuery({
    queryKey: ['journees'],
    queryFn: () => journeesApi.list(),
  });
  const journee = journees?.find((j: any) => (j.jour as string).slice(0, 10) === selectedDate);

  const { data: jourData, isLoading } = useQuery({
    queryKey: ['releves-jour', selectedDate],
    queryFn: () => relevesApi.listJour(selectedDate),
    enabled: !!journee,
  });

  const opByHour: Record<number, any> = {};
  jourData?.operateur?.forEach((r: any) => {
    opByHour[getTunisHour(r.heure_releve)] = r;
  });

  const bloc: any[] = jourData?.bloc || [];
  const blocByHour: Record<number, any> = {};
  bloc.forEach((r: any) => { blocByHour[getTunisHour(r.heure_releve)] = r; });

  return (
    <div>
      <PageHeader
        title="Visualisation des Relevés"
        subtitle="Consultation détaillée — accessible à tous les profils"
        actions={
          <DateInput value={selectedDate} onChange={setSelectedDate} />
        }
      />

      {/* Onglets */}
      <div className="flex border-b border-slate-700 px-6">
        {([['op', 'Feuille Opérateur'], ['bloc', 'Relevés Chef de Bloc']] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === k ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {lbl}
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-6 space-y-4">
        {!journee && !isLoading && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-500">
            Aucune journée pour le {format(new Date(selectedDate + 'T12:00:00'), 'd MMMM yyyy', { locale: fr })}
          </div>
        )}
        {isLoading && <div className="text-center text-slate-500 py-8">Chargement...</div>}

        {/* ══ FEUILLE OPÉRATEUR ══ */}
        {journee && !isLoading && activeTab === 'op' && (
          <>
          <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
            {/* En-tête */}
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">POMIA — Site industriel</p>
                <p className="text-base font-bold text-white mt-0.5">FEUILLE OPÉRATEUR</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Journée du</p>
                <p className="text-sm font-medium text-amber-400">
                  {format(new Date(selectedDate + 'T12:00:00'), 'dd MMMM yyyy', { locale: fr })}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {jourData?.operateur?.filter((r: any) => r.saisi_par).length ?? 0} / {SLOT_HOURS.length} relevés saisis
                </p>
              </div>
            </div>

            {/* Tableau transposé */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" style={{ minWidth: '900px' }}>
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-600">
                    <th className="sticky left-0 bg-slate-800 z-10 text-left px-3 py-2 text-slate-300 font-semibold border-r border-slate-600 w-52">
                      Désignation
                    </th>
                    <th className="text-center px-2 py-2 text-slate-400 font-medium border-r border-slate-700 w-12">
                      Unité
                    </th>
                    {SLOT_HOURS.map(h => (
                      <th key={h} className="text-center px-1 py-2 font-semibold border-r border-slate-700 w-14 whitespace-nowrap">
                        <span className={opByHour[h]?.saisi_par ? 'text-green-400' : opByHour[h] ? 'text-amber-400/60' : 'text-slate-600'}>
                          {h.toString().padStart(2, '0')}h00
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {OP_SECTIONS.map(section => (
                    <>
                      {/* Ligne de titre de section */}
                      <tr key={section.title} className="bg-slate-700/40">
                        <td colSpan={2 + SLOT_HOURS.length}
                          className="sticky left-0 px-3 py-1.5 text-center font-bold text-amber-300 text-[11px] uppercase tracking-widest border-y border-slate-600">
                          {section.title}
                        </td>
                      </tr>
                      {/* Lignes de données */}
                      {section.rows.map((row, i) => (
                        <tr key={row.label + i}
                          className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                          <td className="sticky left-0 bg-slate-900 z-10 px-3 py-1.5 text-slate-300 border-r border-slate-700 whitespace-nowrap">
                            {row.label}
                          </td>
                          <td className="text-center px-2 py-1.5 text-slate-500 border-r border-slate-700">
                            {row.unit}
                          </td>
                          {SLOT_HOURS.map(h => {
                            const r = opByHour[h];
                            const val = row.get(r);
                            const filled = r?.saisi_par;
                            const hasVal = val != null && val !== '';
                            return (
                              <td key={h} className={`text-center px-1 py-1.5 border-r border-slate-800 ${
                                filled ? 'text-white' : 'text-slate-600'
                              }`}>
                                {hasVal ? (
                                  <button type="button" onClick={() => openChart(row, 'op')}
                                    className="hover:text-amber-400 hover:underline underline-offset-2 transition-colors">
                                    {String(val)}
                                  </button>
                                ) : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                  {/* Ligne saiseur par créneau */}
                  <tr className="bg-slate-800/50 border-t border-slate-600">
                    <td className="sticky left-0 bg-slate-800 z-10 px-3 py-2 text-slate-400 font-medium border-r border-slate-600 text-xs italic">
                      Saisi par
                    </td>
                    <td className="border-r border-slate-700" />
                    {SLOT_HOURS.map(h => {
                      const r = opByHour[h];
                      return (
                        <td key={h} className="text-center px-1 py-2 text-[10px] text-slate-400 border-r border-slate-700">
                          {r?.saiseur?.matricule ?? ''}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Consignes Particulières ── */}
          {SLOT_HOURS.some(h => opByHour[h]?.consignes_particulieres) && (
            <div className="mt-4 border border-slate-700 rounded-lg overflow-hidden">
              <div className="bg-slate-700/40 px-3 py-1.5 border-b border-slate-600">
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-widest">Consignes Particulières</span>
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-600">
                    <th className="text-center px-3 py-2 text-slate-400 font-medium border-r border-slate-700 w-16">Heure</th>
                    <th className="text-left px-3 py-2 text-slate-400 font-medium">Consigne</th>
                    <th className="text-center px-3 py-2 text-slate-400 font-medium border-l border-slate-700 w-28">Saisi par</th>
                  </tr>
                </thead>
                <tbody>
                  {SLOT_HOURS.filter(h => opByHour[h]?.consignes_particulieres).map(h => {
                    const r = opByHour[h];
                    return (
                      <tr key={h} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="text-center px-3 py-2 font-mono text-amber-400 font-bold border-r border-slate-700">
                          {h.toString().padStart(2, '0')}h00
                        </td>
                        <td className="px-3 py-2 text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {r.consignes_particulieres}
                        </td>
                        <td className="text-center px-3 py-2 text-slate-400 border-l border-slate-700">
                          {r.saiseur ? `${r.saiseur.prenom} ${r.saiseur.nom}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </>
        )}

        {/* ══ FEUILLE CHEF DE BLOC ══ */}
        {journee && !isLoading && activeTab === 'bloc' && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">POMIA — Site industriel</p>
                <p className="text-base font-bold text-white mt-0.5">FEUILLE CHEF DE BLOC</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Journée du</p>
                <p className="text-sm font-medium text-amber-400">
                  {format(new Date(selectedDate + 'T12:00:00'), 'dd MMMM yyyy', { locale: fr })}
                </p>
                <p className="text-xs text-slate-500 mt-1">{bloc.length} / {SLOT_HOURS.length} créneaux saisis</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" style={{ minWidth: '900px' }}>
                <thead>
                  <tr className="bg-slate-800 border-b border-slate-600">
                    <th className="sticky left-0 bg-slate-800 z-10 text-left px-3 py-2 text-slate-300 font-semibold border-r border-slate-600 w-52">
                      Désignation du paramètre
                    </th>
                    <th className="text-center px-2 py-2 text-slate-400 font-medium border-r border-slate-700 w-12">
                      Unité
                    </th>
                    {SLOT_HOURS.map(h => (
                      <th key={h} className="text-center px-1 py-2 font-semibold border-r border-slate-700 w-14 whitespace-nowrap">
                        <span className={blocByHour[h] ? 'text-green-400' : 'text-slate-600'}>
                          {h.toString().padStart(2, '0')}h00
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BLOC_SECTIONS.map(section => (
                    <>
                      <tr key={section.title} className="bg-slate-700/40">
                        <td colSpan={2 + SLOT_HOURS.length}
                          className="sticky left-0 px-3 py-1.5 text-center font-bold text-amber-300 text-[11px] uppercase tracking-widest border-y border-slate-600">
                          {section.title}
                        </td>
                      </tr>
                      {section.rows.map((row, i) => (
                        <tr key={row.label + i} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                          <td className="sticky left-0 bg-slate-900 z-10 px-3 py-1.5 text-slate-300 border-r border-slate-700 whitespace-nowrap">
                            {row.label}
                          </td>
                          <td className="text-center px-2 py-1.5 text-slate-500 border-r border-slate-700">
                            {row.unit}
                          </td>
                          {SLOT_HOURS.map(h => {
                            const r = blocByHour[h];
                            const val = row.get(r);
                            const hasVal = val != null && val !== '';
                            return (
                              <td key={h} className={`text-center px-1 py-1.5 border-r border-slate-800 ${r ? 'text-white' : 'text-slate-600'}`}>
                                {hasVal ? (
                                  <button type="button" onClick={() => openChart(row, 'bloc')}
                                    className="hover:text-amber-400 hover:underline underline-offset-2 transition-colors">
                                    {String(val)}
                                  </button>
                                ) : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                  <tr className="bg-slate-800/50 border-t border-slate-600">
                    <td className="sticky left-0 bg-slate-800 z-10 px-3 py-2 text-slate-400 font-medium border-r border-slate-600 text-xs italic">
                      Saisi par
                    </td>
                    <td className="border-r border-slate-700" />
                    {SLOT_HOURS.map(h => {
                      const r = blocByHour[h];
                      return (
                        <td key={h} className="text-center px-1 py-2 text-[10px] text-slate-400 border-r border-slate-700">
                          {r?.saiseur?.matricule ?? ''}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Modal open={!!chartTarget} onClose={() => setChartTarget(null)} title={chartTarget?.label ?? ''} size="xl">
        {chartTarget && (
          <>
            <div className="flex flex-wrap items-end gap-4 mb-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Début</label>
                <div className="flex gap-2">
                  <DateInput value={rangeFrom.slice(0, 10)} onChange={(d) => setRangeFrom(`${d}T${rangeFrom.slice(11) || '00:00'}`)} />
                  <TimeInput value={rangeFrom.slice(11)} onChange={(t) => setRangeFrom(`${rangeFrom.slice(0, 10)}T${t}`)} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Fin</label>
                <div className="flex gap-2">
                  <DateInput value={rangeTo.slice(0, 10)} onChange={(d) => setRangeTo(`${d}T${rangeTo.slice(11) || '23:59'}`)} />
                  <TimeInput value={rangeTo.slice(11)} onChange={(t) => setRangeTo(`${rangeTo.slice(0, 10)}T${t}`)} />
                </div>
              </div>
            </div>

            {chartLoading ? (
              <div className="h-72 flex items-center justify-center text-slate-500 text-sm">Chargement...</div>
            ) : chartData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-slate-500 text-sm">Aucune donnée sur cette période</div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <YAxis domain={['dataMin', 'dataMax']} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#f1f5f9' }}
                    itemStyle={{ color: '#f59e0b' }}
                    formatter={(v: number) => [`${v}${chartTarget.unit && chartTarget.unit !== '—' ? ' ' + chartTarget.unit : ''}`, chartTarget.label]}
                  />
                  <Line type="monotone" dataKey="value" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
