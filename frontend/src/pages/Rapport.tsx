import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Printer, BookOpen, Users, Zap,
  Activity, Settings, Bell, Wrench, AlertTriangle,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DateInput from '../components/DateInput';
import { rapportApi } from '../lib/api';
import { useSelectedDate } from '../contexts/SelectedDateContext';
import {
  TRANCHE_LABELS,
  ZONE_LABELS, STATUT_JOURNEE_LABELS,
} from '../types';

const DISCIPLINE_LABELS: Record<string, string> = {
  mec: 'Mécanique', elec: 'Électrique', inst: 'Instrumentation',
  civil: 'Civil', autre: 'Prestation',
};

const fmt = (v: any, d = 1) => (v != null ? Number(v).toFixed(d) : '—');

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

function safeDate(val: any, pattern: string, fallback = '—') {
  if (!val) return fallback;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return fallback;
    return format(d, pattern);
  } catch {
    return fallback;
  }
}

function DefautTable({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-800 border-b border-slate-700 text-slate-400 text-xs">
          <th className="text-left px-4 py-2 font-medium w-32">KKS Équipement</th>
          <th className="text-left px-4 py-2 font-medium">Description</th>
          <th className="text-left px-4 py-2 font-medium w-28">Date déclaration</th>
          <th className="text-left px-4 py-2 font-medium w-28">Date clôture</th>
          <th className="text-left px-4 py-2 font-medium">Commentaires</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {rows.map((d: any) => (
          <tr key={d.id} className="hover:bg-slate-800/30">
            <td className="px-4 py-2.5 text-amber-400 font-mono text-xs align-top whitespace-pre-line">{d.kks_equipement}</td>
            <td className="px-4 py-2.5 text-slate-300 text-sm align-top whitespace-pre-wrap">{d.description}</td>
            <td className="px-4 py-2.5 text-slate-400 text-xs align-top">{safeDate(d.date_declaration, 'dd/MM/yyyy')}</td>
            <td className="px-4 py-2.5 text-slate-400 text-xs align-top">{safeDate(d.date_cloture, 'dd/MM/yyyy')}</td>
            <td className="px-4 py-2.5 text-slate-400 text-xs align-top whitespace-pre-wrap">
              {d.commentaires || '—'}
              {d.commentaires && d.commentaireAuteur && (
                <p className="text-slate-600 text-[10px] mt-0.5 italic">
                  {d.commentaireAuteur.prenom} {d.commentaireAuteur.nom}
                  {d.commentaire_le ? ` · ${safeDate(d.commentaire_le, 'dd/MM HH:mm')}` : ''}
                </p>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OTTable({ rows }: { rows: any[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-800 border-b border-slate-700 text-slate-400 text-xs">
          <th className="text-left px-4 py-2 font-medium w-28">N° OT</th>
          <th className="text-left px-4 py-2 font-medium w-32">KKS</th>
          <th className="text-left px-4 py-2 font-medium">Description de l'intervention</th>
          <th className="text-left px-4 py-2 font-medium w-32">Discipline</th>
          <th className="text-left px-4 py-2 font-medium w-28">État</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {rows.map((ot: any) => (
          <tr key={ot.id} className="hover:bg-slate-800/30">
            <td className="px-4 py-2.5 text-amber-400 font-mono text-xs">{ot.numero_ot ?? '—'}</td>
            <td className="px-4 py-2.5 text-slate-300 font-mono text-xs">{ot.kks_equipement ?? '—'}</td>
            <td className="px-4 py-2.5 text-slate-300">{ot.description}</td>
            <td className="px-4 py-2.5 text-slate-400 text-xs">
              {ot.discipline ? (DISCIPLINE_LABELS[ot.discipline] ?? ot.discipline) : '—'}
            </td>
            <td className="px-4 py-2.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                ot.etat === 'termine' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
              }`}>
                {ot.etat === 'termine' ? 'FIN TRAVAUX' : 'EN COURS'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SectionTitle({ icon: Icon, title, count }: { icon: any; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-slate-800/40">
      <Icon size={14} className="text-amber-400" />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {count !== undefined && (
        <span className="ml-auto text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}

export default function Rapport() {
  const { selectedDate, setSelectedDate } = useSelectedDate();

  const { data, isLoading } = useQuery({
    queryKey: ['rapport', selectedDate],
    queryFn: () => rapportApi.get(selectedDate),
  });

  const journee  = data?.journee;
  const defauts  = data?.defauts ?? [];
  const compteurs = journee?.compteurs;
  const releves   = journee?.releves_bloc ?? [];
  const manouvres = journee?.manouvres ?? [];
  const alarmes   = journee?.alarmes ?? [];
  const ots       = journee?.ordres_travaux ?? [];

  const dateLabel = format(new Date(selectedDate + 'T12:00:00'), 'EEEE dd MMMM yyyy', { locale: fr });

  return (
    <div>
      <PageHeader
        title="Rapport Journalier"
        subtitle="Compte-rendu d'exploitation journalier"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <DateInput value={selectedDate} onChange={setSelectedDate} />
            <button
              onClick={() => window.print()}
              disabled={!journee}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-medium px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              <Printer size={14} /> Imprimer
            </button>
          </div>
        }
      />

      <div className="p-3 sm:p-6 space-y-4">
        {/* En-tête imprimable uniquement */}
        <div className="hidden print:flex items-center justify-between border-b border-slate-700 pb-3 mb-2">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest">POMIA — Site industriel</p>
            <p className="text-lg font-bold text-white">RAPPORT JOURNALIER D'EXPLOITATION</p>
          </div>
          <p className="text-sm font-semibold text-amber-400 capitalize">{dateLabel}</p>
        </div>

        {isLoading && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-10 text-center text-slate-500">
            Chargement...
          </div>
        )}

        {!isLoading && !journee && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-10 text-center">
            <p className="text-slate-400">
              Aucune journée pour le {format(new Date(selectedDate + 'T12:00:00'), 'd MMMM yyyy', { locale: fr })}
            </p>
          </div>
        )}

        {journee && (
          <>
            {/* ── 1. Identification ── */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
              <SectionTitle icon={BookOpen} title="Journée d'Exploitation" />
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-1">Date</p>
                  <p className="text-white font-medium capitalize">{dateLabel}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1">Statut</p>
                  <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${
                    journee.statut === 'transmis'     ? 'bg-green-500/10 text-green-400' :
                    journee.statut === 'valide_quart' ? 'bg-blue-500/10 text-blue-400'  :
                    journee.statut === 'valide_bloc'  ? 'bg-amber-500/10 text-amber-400':
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {STATUT_JOURNEE_LABELS[journee.statut as keyof typeof STATUT_JOURNEE_LABELS]}
                  </span>
                </div>
                {journee.valide_bloc_le && (
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Validé Bloc</p>
                    <p className="text-white">{safeDate(journee.valide_bloc_le, 'dd/MM HH:mm')}</p>
                  </div>
                )}
                {journee.valide_quart_le && (
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Validé Quart</p>
                    <p className="text-white">{safeDate(journee.valide_quart_le, 'dd/MM HH:mm')}</p>
                  </div>
                )}
              </div>
              {journee.consignes_permanentes && (
                <div className="px-4 pb-4">
                  <p className="text-slate-500 text-xs mb-1">Consignes permanentes</p>
                  <p className="text-slate-300 text-sm bg-slate-800 rounded p-2 whitespace-pre-wrap">
                    {journee.consignes_permanentes}
                  </p>
                </div>
              )}
            </div>

            {/* ── 2. Personnel ── */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
              <SectionTitle icon={Users} title="Affectation des Postes" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 border-b border-slate-700 text-slate-400 text-xs">
                      <th className="text-left px-4 py-2 font-medium">Tranche</th>
                      <th className="text-left px-4 py-2 font-medium">Chef de Quart</th>
                      <th className="text-left px-4 py-2 font-medium">Chef de Bloc</th>
                      <th className="text-left px-4 py-2 font-medium">Opérateur 1</th>
                      <th className="text-left px-4 py-2 font-medium">Opérateur 2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(['h00_07h', 'h07_14h', 'h14_20h', 'h20_00h'] as const).map(t => {
                      const p = journee.postes?.find((p: any) => p.tranche === t);
                      const dash = <span className="text-slate-600">—</span>;
                      return (
                        <tr key={t} className="hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 text-amber-400 font-medium text-xs">{TRANCHE_LABELS[t]}</td>
                          <td className="px-4 py-2.5 text-slate-300">{p?.chefQuart  ? `${p.chefQuart.prenom} ${p.chefQuart.nom}` : dash}</td>
                          <td className="px-4 py-2.5 text-slate-300">{p?.chefBloc   ? `${p.chefBloc.prenom} ${p.chefBloc.nom}`   : dash}</td>
                          <td className="px-4 py-2.5 text-slate-300">{p?.operateur1 ? `${p.operateur1.prenom} ${p.operateur1.nom}` : dash}</td>
                          <td className="px-4 py-2.5 text-slate-300">{p?.operateur2 ? `${p.operateur2.prenom} ${p.operateur2.nom}` : dash}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── 3. Compteurs / Production ── */}
            {compteurs && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                <SectionTitle icon={Zap} title="Production & Compteurs Journaliers" />
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      {
                        label: 'Énergie Produite',
                        value: compteurs.energie_active_00h != null && compteurs.energie_active_24h != null
                          ? `${(Number(compteurs.energie_active_24h) - Number(compteurs.energie_active_00h)).toFixed(1)} MWh`
                          : '—',
                        accent: true,
                      },
                      { label: 'Puissance Max', value: compteurs.puissance_max_mw != null ? `${fmt(compteurs.puissance_max_mw)} MW` : '—' },
                      { label: 'Heure Pmax',    value: compteurs.heure_puissance_max ?? '—' },
                      {
                        label: 'Heures Flamme',
                        value: compteurs.h_flamme_00h != null && compteurs.h_flamme_24h != null
                          ? `${(Number(compteurs.h_flamme_24h) - Number(compteurs.h_flamme_00h)).toFixed(1)} h`
                          : '—',
                      },
                    ].map(({ label, value, accent }) => (
                      <div key={label} className="bg-slate-800 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">{label}</p>
                        <p className={`text-base font-bold ${accent ? 'text-amber-400' : 'text-white'}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Conso. Gaz',
                        value: compteurs.gaz_00h_nm3 != null && compteurs.gaz_24h_nm3 != null
                          ? `${(Number(compteurs.gaz_24h_nm3) - Number(compteurs.gaz_00h_nm3)).toFixed(0)} Nm³` : '—' },
                      { label: 'Conso. Gasoil',
                        value: compteurs.gasoil_00h_l != null && compteurs.gasoil_24h_l != null
                          ? `${(Number(compteurs.gasoil_24h_l) - Number(compteurs.gasoil_00h_l)).toFixed(0)} L` : '—' },
                      { label: 'Démarrages',
                        value: compteurs.dem_total_00h != null && compteurs.dem_total_24h != null
                          ? `${compteurs.dem_total_24h - compteurs.dem_total_00h}` : '—' },
                      { label: 'Déclenchements',
                        value: compteurs.declenchement_00h != null && compteurs.declenchement_24h != null
                          ? `${compteurs.declenchement_24h - compteurs.declenchement_00h}` : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-800 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">{label}</p>
                        <p className="text-base font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Ligne 3 : PMS / Aux en charge / Production nette / Aux 24h ── */}
                  {(() => {
                    const energieBrute = compteurs.energie_active_00h != null && compteurs.energie_active_24h != null
                      ? Number(compteurs.energie_active_24h) - Number(compteurs.energie_active_00h) : null;
                    const consoAuxCharge = consoAuxTotal(normalizeConsoAuxCycles(compteurs));
                    const productionNette = energieBrute != null && consoAuxCharge != null
                      ? energieBrute - consoAuxCharge : null;
                    const consoAux24h = compteurs.auxiliaires_00h != null && compteurs.auxiliaires_24h != null
                      ? Number(compteurs.auxiliaires_24h) - Number(compteurs.auxiliaires_00h) : null;
                    const hPms = compteurs.h_pms_00h != null && compteurs.h_pms_24h != null
                      ? Number(compteurs.h_pms_24h) - Number(compteurs.h_pms_00h) : null;

                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-slate-800 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Heures PMS</p>
                          <p className="text-base font-bold text-white">{hPms != null ? `${hPms.toFixed(1)} h` : '—'}</p>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Conso. Aux. en Charge</p>
                          <p className="text-base font-bold text-white">{consoAuxCharge != null ? `${consoAuxCharge.toFixed(3)} MWh` : '—'}</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">Découplage − Couplage (opérateur)</p>
                        </div>
                        <div className="bg-slate-800 border border-amber-500/20 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Production Nette</p>
                          <p className="text-base font-bold text-amber-400">{productionNette != null ? `${productionNette.toFixed(1)} MWh` : '—'}</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">Brute − Aux. en charge</p>
                        </div>
                        <div className="bg-slate-800 rounded-lg p-3">
                          <p className="text-xs text-slate-500 mb-1">Conso. Aux. 24h</p>
                          <p className="text-base font-bold text-white">{consoAux24h != null ? `${consoAux24h.toFixed(1)} MWh` : '—'}</p>
                          <p className="text-[10px] text-slate-600 mt-0.5">Index 24h − Index 00h</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── 5. Manœuvres ── */}
            {(() => {
              const manouvresNonIncident = manouvres.filter((m: any) => m.type_manouvre !== 'incident');
              return (
                <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                  <SectionTitle icon={Settings} title="Manœuvres" count={manouvresNonIncident.length} />
                  {manouvresNonIncident.length === 0 ? (
                    <p className="text-slate-600 text-sm text-center py-5">Aucune manœuvre enregistrée</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800 border-b border-slate-700 text-slate-400 text-xs">
                          <th className="text-left px-4 py-2 font-medium w-20">Heure</th>
                          <th className="text-left px-4 py-2 font-medium">Description</th>
                          <th className="text-left px-4 py-2 font-medium w-32">Saisi par</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {manouvresNonIncident.map((m: any) => (
                          <tr key={m.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2.5 text-amber-400 font-medium text-xs">
                              {safeDate(m.heure_manouvre, 'HH:mm')}
                            </td>
                            <td className="px-4 py-2.5 text-slate-300">{m.description}</td>
                            <td className="px-4 py-2.5 text-slate-400 text-xs">
                              {m.saiseur ? `${m.saiseur.prenom} ${m.saiseur.nom}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })()}

            {/* ── 5b. Incidents ── */}
            {(() => {
              const incidents = manouvres.filter((m: any) => m.type_manouvre === 'incident');
              return (
                <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                  <SectionTitle icon={Activity} title="Incidents" count={incidents.length} />
                  {incidents.length === 0 ? (
                    <p className="text-slate-600 text-sm text-center py-5">Aucun incident enregistré</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800 border-b border-slate-700 text-slate-400 text-xs">
                          <th className="text-left px-4 py-2 font-medium w-20">Heure</th>
                          <th className="text-left px-4 py-2 font-medium">Description</th>
                          <th className="text-left px-4 py-2 font-medium w-32">Saisi par</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {incidents.map((m: any) => (
                          <tr key={m.id} className="hover:bg-slate-800/30">
                            <td className="px-4 py-2.5 text-red-400 font-medium text-xs">
                              {safeDate(m.heure_manouvre, 'HH:mm')}
                            </td>
                            <td className="px-4 py-2.5 text-slate-300">{m.description}</td>
                            <td className="px-4 py-2.5 text-slate-400 text-xs">
                              {m.saiseur ? `${m.saiseur.prenom} ${m.saiseur.nom}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })()}

            {/* ── 6. Alarmes ── */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
              <SectionTitle icon={Bell} title="Alarmes Répétitives" count={alarmes.length} />
              {alarmes.length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-5">Aucune alarme enregistrée</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 border-b border-slate-700 text-slate-400 text-xs">
                      <th className="text-left px-4 py-2 font-medium w-20">Heure</th>
                      <th className="text-left px-4 py-2 font-medium w-32">Tag</th>
                      <th className="text-left px-4 py-2 font-medium">Désignation</th>
                      <th className="text-left px-4 py-2 font-medium w-24">Origine</th>
                      <th className="text-left px-4 py-2 font-medium w-20">Répétitive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {alarmes.map((a: any) => (
                      <tr key={a.id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 text-amber-400 font-medium text-xs">
                          {safeDate(a.heure, 'HH:mm')}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 font-mono text-xs">{a.tag ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-300">{a.designation}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">{a.origine}</td>
                        <td className="px-4 py-2.5">
                          {a.repetitive && (
                            <span className="text-xs bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full">Oui</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── 7a. Travaux Curatifs ── */}
            {(() => {
              const curatifs = ots.filter((o: any) => o.type_maintenance === 'curatif');
              return (
                <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                  <SectionTitle icon={Wrench} title="Travaux Curatifs" count={curatifs.length} />
                  {curatifs.length === 0 ? (
                    <p className="text-slate-600 text-sm text-center py-5">Aucun travail curatif pour cette journée</p>
                  ) : (
                    <OTTable rows={curatifs} />
                  )}
                </div>
              );
            })()}

            {/* ── 7b. Travaux Préventifs ── */}
            {(() => {
              const preventifs = ots.filter((o: any) => o.type_maintenance === 'preventif');
              return (
                <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                  <SectionTitle icon={Wrench} title="Travaux Préventifs" count={preventifs.length} />
                  {preventifs.length === 0 ? (
                    <p className="text-slate-600 text-sm text-center py-5">Aucun travail préventif pour cette journée</p>
                  ) : (
                    <OTTable rows={preventifs} />
                  )}
                </div>
              );
            })()}

            {/* ── 8a. Défauts — TG ── */}
            {(() => {
              const rows = defauts.filter((d: any) => d.zone === 'tg');
              return (
                <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                  <SectionTitle icon={AlertTriangle} title="Matériels Défectueux — TG" count={rows.length} />
                  {rows.length === 0
                    ? <p className="text-slate-600 text-sm text-center py-5">Aucun défaut TG actif</p>
                    : <DefautTable rows={rows} />}
                </div>
              );
            })()}

            {/* ── 8b. Défauts — SITE ── */}
            {(() => {
              const rows = defauts.filter((d: any) => d.zone === 'site');
              return (
                <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                  <SectionTitle icon={AlertTriangle} title="Matériels Défectueux — SITE" count={rows.length} />
                  {rows.length === 0
                    ? <p className="text-slate-600 text-sm text-center py-5">Aucun défaut SITE actif</p>
                    : <DefautTable rows={rows} />}
                </div>
              );
            })()}

            {/* ── 8c. Défauts — Points de Réserve ── */}
            {(() => {
              const rows = defauts.filter((d: any) => d.zone === 'auxiliaires');
              return (
                <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                  <SectionTitle icon={AlertTriangle} title="Points de Réserve Retenus" count={rows.length} />
                  {rows.length === 0
                    ? <p className="text-slate-600 text-sm text-center py-5">Aucun point de réserve actif</p>
                    : <DefautTable rows={rows} />}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
