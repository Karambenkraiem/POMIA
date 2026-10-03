import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journeesApi, postesApi, usersApi } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { Plus, Pencil, CheckCircle, ChevronDown, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import DateInput from '../components/DateInput';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { STATUT_JOURNEE_LABELS, TRANCHE_LABELS } from '../types';
import type { TrancheHoraire } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedDate } from '../contexts/SelectedDateContext';
import { useToast, ToastContainer } from '../components/Toast';

const TRANCHES: TrancheHoraire[] = ['h00_07h', 'h07_14h', 'h14_20h', 'h20_00h'];

const TRANCHE_TIMES: Record<TrancheHoraire, { debut: string; fin: string }> = {
  h00_07h: { debut: '00:00', fin: '07:00' },
  h07_14h: { debut: '07:00', fin: '14:00' },
  h14_20h: { debut: '14:00', fin: '20:00' },
  h20_00h: { debut: '20:00', fin: '00:00' },
};

export default function Journee() {
  const { user } = useAuth();
  const { toasts, show: showToast, dismiss } = useToast();
  const qc = useQueryClient();
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [showPosteModal, setShowPosteModal] = useState(false);
  const [editingPoste, setEditingPoste] = useState<any | null>(null);
  const [posteForm, setPosteForm] = useState<any>({ tranche: 'h07_14h' });
  const [showValiderConfirm, setShowValiderConfirm] = useState(false);

  const { data: journees } = useQuery({ queryKey: ['journees'], queryFn: () => journeesApi.list() });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const selectedJournee = journees?.find((j: any) => (j.jour as string).slice(0, 10) === selectedDate);

  const { data: journeeDetail, isLoading } = useQuery({
    queryKey: ['journee', selectedJournee?.id],
    queryFn: () => journeesApi.get(selectedJournee!.id),
    enabled: !!selectedJournee?.id,
  });

  const createJourneeMut = useMutation({
    mutationFn: () => journeesApi.create({ jour: selectedDate }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['journees'] }),
  });

  const addPosteMut = useMutation({
    mutationFn: (data: any) => postesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['journee'] }); setShowPosteModal(false); },
  });

  const updatePosteMut = useMutation({
    mutationFn: (data: any) => postesApi.update(editingPoste.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['journee'] }); setShowPosteModal(false); setEditingPoste(null); },
  });

  const validerQuartMut = useMutation({
    mutationFn: (id: string) => journeesApi.validerQuart(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journee'] });
      qc.invalidateQueries({ queryKey: ['journees'] });
      setShowValiderConfirm(false);
      showToast('Journée Validée Merci Beaucoup', 'success');
    },
  });

  const canValiderQuart = ['chef_quart', 'chef_exploitation', 'admin'].includes(user?.role || '');

  const cpt = journeeDetail?.compteurs;
  const REQUIS_OP = [
    'energie_active_00h', 'energie_active_24h',
    'gasoil_00h_l', 'gasoil_24h_l',
  ];
  const REQUIS_BLOC = [
    'gaz_00h_nm3', 'gaz_24h_nm3',
    'h_flamme_00h', 'h_flamme_24h',
    'puissance_max_mw',
  ];
  // La conso. aux. couplage/découplage se saisit désormais via une liste de cycles
  // (conso_aux_cycles) plutôt que deux champs uniques : on exige au moins un cycle complet.
  const hasCompleteAuxCycle = Array.isArray(cpt?.conso_aux_cycles)
    && cpt.conso_aux_cycles.some((c: any) => c?.couplage != null && c?.decouplage != null);
  const manquantsOp   = [
    ...REQUIS_OP.filter(f => !cpt || cpt[f] == null),
    ...(hasCompleteAuxCycle ? [] : ['conso_aux_cycles']),
  ];
  const manquantsBloc = REQUIS_BLOC.filter(f => !cpt || cpt[f] == null);
  const compteursOk   = manquantsOp.length === 0 && manquantsBloc.length === 0;

  const LABELS: Record<string, string> = {
    energie_active_00h: 'Énergie active 00h', energie_active_24h: 'Énergie active 24h',
    conso_aux_cycles: 'Conso. aux. couplage/découplage',
    gasoil_00h_l: 'Gasoil 00h', gasoil_24h_l: 'Gasoil 24h',
    gaz_00h_nm3: 'Gaz 00h', gaz_24h_nm3: 'Gaz 24h',
    h_flamme_00h: 'H. flamme 00h', h_flamme_24h: 'H. flamme 24h',
    puissance_max_mw: 'Puissance max',
  };
  const tooltipValidation = compteursOk ? '' : [
    ...(manquantsOp.length   ? [`Opérateur : ${manquantsOp.map(f => LABELS[f]).join(', ')}`]   : []),
    ...(manquantsBloc.length ? [`Chef Bloc : ${manquantsBloc.map(f => LABELS[f]).join(', ')}`] : []),
  ].join('\n');
  const canManageJournee = ['chef_quart', 'chef_exploitation', 'admin'].includes(user?.role || '');
  const canEditPoste = ['chef_quart', 'admin'].includes(user?.role || '');

  function openAddPoste() {
    setEditingPoste(null);
    setPosteForm({ tranche: 'h07_14h' });
    setShowPosteModal(true);
  }

  function openEditPoste(poste: any) {
    setEditingPoste(poste);
    setPosteForm({
      tranche: poste.tranche,
      chef_quart_id: poste.chef_quart_id || '',
      chef_bloc_id: poste.chef_bloc_id || '',
      operateur1_id: poste.operateur1_id || '',
      operateur2_id: poste.operateur2_id || '',
    });
    setShowPosteModal(true);
  }

  function handleAddPoste() {
    if (!journeeDetail) return;
    const dateStr = format(new Date(journeeDetail.jour), 'yyyy-MM-dd');
    const { debut: debutTime, fin: finTime } = TRANCHE_TIMES[posteForm.tranche as TrancheHoraire];
    const debut = new Date(`${dateStr}T${debutTime}:00`);
    let fin = new Date(`${dateStr}T${finTime}:00`);
    if (posteForm.tranche === 'h20_00h') fin = new Date(`${dateStr}T23:59:59`);
    addPosteMut.mutate({ ...posteForm, journee_id: journeeDetail.id, debut, fin });
  }

  function handleSavePoste() {
    if (editingPoste) {
      updatePosteMut.mutate({
        chef_quart_id: posteForm.chef_quart_id || null,
        chef_bloc_id: posteForm.chef_bloc_id || null,
        operateur1_id: posteForm.operateur1_id || null,
        operateur2_id: posteForm.operateur2_id || null,
      });
    } else {
      handleAddPoste();
    }
  }

  return (
    <div>
      <PageHeader title="Gestion de la Journée" subtitle="Journal d'exploitation quotidien" />

      <div className="p-3 sm:p-6">
        <div className="flex gap-4 mb-6">
          <DateInput value={selectedDate} onChange={setSelectedDate} />
          {!selectedJournee && canManageJournee && (
            <button
              onClick={() => createJourneeMut.mutate()}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Plus size={15} /> Créer la journée
            </button>
          )}
        </div>

        {!selectedJournee && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center">
            <p className="text-slate-400">Aucune journée pour le {format(new Date(selectedDate + 'T12:00:00'), 'd MMMM yyyy', { locale: fr })}</p>
          </div>
        )}

        {selectedJournee && (
          <div className="space-y-4">
            {/* En-tête journée */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    {format(new Date(selectedJournee.jour.split('T')[0] + 'T12:00:00'), "EEEE d MMMM yyyy", { locale: fr })}
                    {!!selectedJournee.incidents_count && (
                      <Link
                        to="/manouvres?tab=incident"
                        title={`${selectedJournee.incidents_count} incident(s) saisi(s) ce jour`}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
                      >
                        <AlertTriangle size={12} /> {selectedJournee.incidents_count} incident{selectedJournee.incidents_count > 1 ? 's' : ''}
                      </Link>
                    )}
                  </h2>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1 ${
                    selectedJournee.statut === 'transmis' ? 'bg-green-500/10 text-green-400' :
                    selectedJournee.statut === 'valide_quart' ? 'bg-blue-500/10 text-blue-400' :
                    selectedJournee.statut === 'valide_bloc' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {STATUT_JOURNEE_LABELS[selectedJournee.statut as keyof typeof STATUT_JOURNEE_LABELS]}
                  </span>
                </div>
                <div className="flex gap-2">
                  {canValiderQuart && ['en_cours', 'valide_bloc'].includes(selectedJournee.statut) && (
                    <div className="relative group">
                      <button
                        onClick={() => compteursOk && setShowValiderConfirm(true)}
                        disabled={!compteursOk || validerQuartMut.isPending}
                        className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                          compteursOk
                            ? 'bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 cursor-pointer'
                            : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <CheckCircle size={14} /> Valider la journée
                      </button>
                      {!compteursOk && (
                        <div className="absolute right-0 top-full mt-1.5 z-10 hidden group-hover:block w-72 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl text-xs text-slate-300 whitespace-pre-line">
                          <p className="font-semibold text-red-400 mb-1">Compteurs incomplets :</p>
                          {tooltipValidation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Postes */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <h3 className="text-sm font-medium text-white">Postes (4 tranches)</h3>
                {canManageJournee && (
                  <button
                    onClick={openAddPoste}
                    className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs transition-colors"
                  >
                    <Plus size={13} /> Ajouter
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-800">
                {TRANCHES.map((tranche) => {
                  const poste = journeeDetail?.postes?.find((p: any) => p.tranche === tranche);
                  return (
                    <div key={tranche} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${poste ? 'bg-green-400' : 'bg-slate-600'}`} />
                        <span className="text-sm text-slate-300">{TRANCHE_LABELS[tranche]}</span>
                      </div>
                      {poste ? (
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span>CQ: {poste.chefQuart ? `${poste.chefQuart.prenom} ${poste.chefQuart.nom}` : '—'}</span>
                          <span>CB: {poste.chefBloc ? `${poste.chefBloc.prenom} ${poste.chefBloc.nom}` : '—'}</span>
                          <span>Op1: {poste.operateur1 ? `${poste.operateur1.prenom}` : '—'}</span>
                          <span>Op2: {poste.operateur2 ? `${poste.operateur2.prenom}` : '—'}</span>
                          {canEditPoste && (
                            <button onClick={() => openEditPoste(poste)} title="Modifier l'équipe"
                              className="text-slate-500 hover:text-amber-400 transition-colors">
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">Non configuré</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            {selectedJournee._count && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Relevés Bloc', value: selectedJournee._count.releves_bloc },
                  { label: 'Manœuvres', value: selectedJournee._count.manouvres },
                  { label: 'Alarmes', value: selectedJournee._count.alarmes },
                  { label: 'OT', value: selectedJournee._count.ordres_travaux },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-400">{value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Poste */}
      <Modal open={showPosteModal} onClose={() => { setShowPosteModal(false); setEditingPoste(null); }} title={editingPoste ? "Modifier l'équipe du poste" : 'Ajouter un poste'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Tranche</label>
            <select
              value={posteForm.tranche}
              onChange={(e) => setPosteForm({ ...posteForm, tranche: e.target.value })}
              disabled={!!editingPoste}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {TRANCHES.map((t) => <option key={t} value={t}>{TRANCHE_LABELS[t]}</option>)}
            </select>
          </div>
          {(['chef_quart_id', 'chef_bloc_id', 'operateur1_id', 'operateur2_id'] as const).map((field) => (
            <div key={field}>
              <label className="block text-sm text-slate-400 mb-1">
                {field === 'chef_quart_id' ? 'Chef de Quart' : field === 'chef_bloc_id' ? 'Chef de Bloc' : field === 'operateur1_id' ? 'Opérateur 1' : 'Opérateur 2'}
              </label>
              <select
                value={posteForm[field] || ''}
                onChange={(e) => setPosteForm({ ...posteForm, [field]: e.target.value || null })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">— Non assigné —</option>
                {users?.filter((u: any) =>
                  field === 'chef_quart_id' ? u.role === 'chef_quart' :
                  field === 'chef_bloc_id'  ? u.role === 'chef_bloc'  :
                  u.role === 'operateur'
                ).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.prenom} {u.nom} ({u.matricule})</option>
                ))}
              </select>
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowPosteModal(false); setEditingPoste(null); }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm transition-colors">Annuler</button>
            <button
              onClick={handleSavePoste}
              disabled={addPosteMut.isPending || updatePosteMut.isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium py-2 rounded-lg text-sm transition-colors"
            >
              {(addPosteMut.isPending || updatePosteMut.isPending) ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Dialogue de confirmation validation journée ── */}
      {showValiderConfirm && selectedJournee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowValiderConfirm(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm p-6 shadow-xl">
            <p className="text-white font-semibold text-base mb-2">Valider la journée ?</p>
            <p className="text-slate-400 text-sm mb-6">
              Confirmez-vous la validation de la journée du{' '}
              <span className="text-white font-medium">
                {format(new Date(selectedJournee.jour.split('T')[0] + 'T12:00:00'), "d MMMM yyyy", { locale: fr })}
              </span> ?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowValiderConfirm(false)}
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 transition-colors">
                Non, annuler
              </button>
              <button
                onClick={() => validerQuartMut.mutate(selectedJournee.id)}
                disabled={validerQuartMut.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white transition-colors">
                {validerQuartMut.isPending ? 'Validation...' : 'Oui, valider'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
