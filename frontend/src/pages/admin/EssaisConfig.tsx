import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { essaisApi } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { Plus, Pencil, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { FREQUENCE_ESSAI_LABELS, TYPE_RELEVE_ESSAI_LABELS } from '../../types';
import type { EssaiConfig, FrequenceEssai, TypeReleveEssai } from '../../types';

const FREQUENCES: FrequenceEssai[] = ['journalier', 'hebdomadaire', 'mensuelle', 'semestrielle', 'annuelle'];
const TYPES_RELEVE: TypeReleveEssai[] = ['valeur', 'potentiometre', 'niveaumetre', 'selection'];
const JOURS_SEMAINE = [
  { v: 1, label: 'Lundi' },
  { v: 2, label: 'Mardi' },
  { v: 3, label: 'Mercredi' },
  { v: 4, label: 'Jeudi' },
  { v: 5, label: 'Vendredi' },
  { v: 6, label: 'Samedi' },
  { v: 0, label: 'Dimanche' },
];

type ReleveForm = { nom: string; type: TypeReleveEssai; unite: string; options: string };
const EMPTY_RELEVE: ReleveForm = { nom: '', type: 'valeur', unite: '', options: '' };
const EMPTY_FORM = { nom: '', frequence: 'journalier' as FrequenceEssai, joursSemaine: [] as number[], actif: true, releves: [] as ReleveForm[] };

export default function EssaisConfig() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: essais, isLoading } = useQuery({ queryKey: ['essais-config'], queryFn: essaisApi.list });

  const saveMut = useMutation({
    mutationFn: (data: any) => editId ? essaisApi.update(editId, data) : essaisApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['essais-config'] }); setShowModal(false); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => essaisApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['essais-config'] }); setConfirmDeleteId(null); },
  });

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(e: EssaiConfig) {
    setEditId(e.id);
    setForm({
      nom: e.nom,
      frequence: e.frequence,
      joursSemaine: e.jours_semaine || [],
      actif: e.actif,
      releves: e.releves.map(r => ({
        nom: r.nom,
        type: r.type,
        unite: r.unite || '',
        options: (r.options || []).join(', '),
      })),
    });
    setShowModal(true);
  }

  function toggleJour(v: number) {
    setForm((f: any) => ({
      ...f,
      joursSemaine: f.joursSemaine.includes(v) ? f.joursSemaine.filter((d: number) => d !== v) : [...f.joursSemaine, v],
    }));
  }

  function addReleve() {
    setForm((f: any) => ({ ...f, releves: [...f.releves, { ...EMPTY_RELEVE }] }));
  }

  function updateReleve(i: number, patch: Partial<ReleveForm>) {
    setForm((f: any) => ({ ...f, releves: f.releves.map((r: ReleveForm, idx: number) => idx === i ? { ...r, ...patch } : r) }));
  }

  function removeReleve(i: number) {
    setForm((f: any) => ({ ...f, releves: f.releves.filter((_: ReleveForm, idx: number) => idx !== i) }));
  }

  function moveReleve(i: number, dir: -1 | 1) {
    setForm((f: any) => {
      const j = i + dir;
      if (j < 0 || j >= f.releves.length) return f;
      const releves = [...f.releves];
      [releves[i], releves[j]] = [releves[j], releves[i]];
      return { ...f, releves };
    });
  }

  function handleSave() {
    const releves = form.releves.map((r: ReleveForm) => ({
      nom: r.nom.trim(),
      type: r.type,
      unite: r.unite.trim() || null,
      options: r.type === 'selection' ? r.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
    }));
    saveMut.mutate({
      nom: form.nom.trim(),
      frequence: form.frequence,
      jours_semaine: form.joursSemaine,
      actif: form.actif,
      releves,
    });
  }

  const canSave = form.nom.trim() && form.releves.length > 0
    && form.releves.every((r: ReleveForm) => r.nom.trim() && (r.type !== 'selection' || r.options.trim()))
    && (form.frequence !== 'hebdomadaire' || form.joursSemaine.length > 0);

  return (
    <div>
      <PageHeader
        title="Paramétrage des Essais"
        subtitle="Essais périodiques déclenchés automatiquement à la création de la journée"
        actions={
          <button onClick={openCreate}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-3 py-1.5 rounded-lg text-sm">
            <Plus size={14} /> Nouvel essai
          </button>
        }
      />

      <div className="p-3 sm:p-6">
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['Nom', 'Fréquence', 'Statut', 'Dernière exécution', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Chargement...</td></tr>}
                {!isLoading && (!essais || essais.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600 text-xs italic">Aucun essai configuré</td></tr>
                )}
                {essais?.map((e: EssaiConfig) => (
                  <tr key={e.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-slate-200 font-medium">{e.nom}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {FREQUENCE_ESSAI_LABELS[e.frequence]}
                      {e.frequence === 'hebdomadaire' && e.jours_semaine && e.jours_semaine.length > 0 && (
                        <span className="block text-xs text-slate-500">
                          {e.jours_semaine.map(v => JOURS_SEMAINE.find(j => j.v === v)?.label).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${e.actif ? 'bg-green-400/10 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                        {e.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                      {e.derniere_execution ? new Date(e.derniere_execution).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(e)} className="text-slate-500 hover:text-amber-400 transition-colors"><Pencil size={13} /></button>
                        <button onClick={() => setConfirmDeleteId(e.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? "Modifier l'essai" : 'Nouvel essai'} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Nom de l'essai *</label>
              <input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Fréquence *</label>
              <select value={form.frequence} onChange={e => setForm({ ...form, frequence: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
                {FREQUENCES.map(f => <option key={f} value={f}>{FREQUENCE_ESSAI_LABELS[f]}</option>)}
              </select>
            </div>
          </div>

          {form.frequence === 'hebdomadaire' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Jour(s) de la semaine *</label>
              <div className="flex gap-2 flex-wrap">
                {JOURS_SEMAINE.map(j => (
                  <button key={j.v} type="button" onClick={() => toggleJour(j.v)}
                    className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
                      form.joursSemaine.includes(j.v)
                        ? 'bg-amber-500 border-amber-500 text-slate-900'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/50'
                    }`}>
                    {j.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="actif" checked={form.actif} onChange={e => setForm({ ...form, actif: e.target.checked })} className="accent-amber-500" />
            <label htmlFor="actif" className="text-sm text-slate-300 cursor-pointer">Essai actif (déclenché automatiquement)</label>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-300">Relevés à saisir</p>
              <button onClick={addReleve} className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-xs">
                <Plus size={13} /> Ajouter un relevé
              </button>
            </div>

            {form.releves.length === 0 && (
              <p className="text-xs text-slate-600 italic py-2">Aucun relevé — ajoutez-en au moins un.</p>
            )}

            <div className="space-y-2">
              {form.releves.map((r: ReleveForm, i: number) => (
                <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col flex-shrink-0">
                      <button type="button" onClick={() => moveReleve(i, -1)} disabled={i === 0}
                        title="Monter" className="text-slate-500 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed leading-none">
                        <ChevronUp size={14} />
                      </button>
                      <button type="button" onClick={() => moveReleve(i, 1)} disabled={i === form.releves.length - 1}
                        title="Descendre" className="text-slate-500 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed leading-none">
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <input value={r.nom} onChange={e => updateReleve(i, { nom: e.target.value })}
                      placeholder="Nom du relevé"
                      className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500" />
                    <select value={r.type} onChange={e => updateReleve(i, { type: e.target.value as TypeReleveEssai })}
                      className="bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500">
                      {TYPES_RELEVE.map(t => <option key={t} value={t}>{TYPE_RELEVE_ESSAI_LABELS[t]}</option>)}
                    </select>
                    <button onClick={() => removeReleve(i)} className="text-slate-500 hover:text-red-400"><X size={15} /></button>
                  </div>
                  {r.type === 'selection' ? (
                    <input value={r.options} onChange={e => updateReleve(i, { options: e.target.value })}
                      placeholder="Options séparées par une virgule (ex: OK, NOK)"
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500 placeholder:text-slate-600" />
                  ) : (
                    <input value={r.unite} onChange={e => updateReleve(i, { unite: e.target.value })}
                      placeholder="Unité (optionnel, ex: bar, °C)"
                      className="w-40 bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500 placeholder:text-slate-600" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {saveMut.error && (
            <p className="text-red-400 text-sm">{(saveMut.error as any)?.response?.data?.error || 'Erreur'}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm">Annuler</button>
            <button onClick={handleSave} disabled={!canSave || saveMut.isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium py-2 rounded-lg text-sm disabled:opacity-50">
              {saveMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Supprimer l'essai" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">Confirmer la suppression de cet essai et de tout son historique ?</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDeleteId(null)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm">Annuler</button>
            <button onClick={() => confirmDeleteId && deleteMut.mutate(confirmDeleteId)} disabled={deleteMut.isPending}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg text-sm disabled:opacity-50">
              {deleteMut.isPending ? 'Suppression...' : 'Supprimer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
