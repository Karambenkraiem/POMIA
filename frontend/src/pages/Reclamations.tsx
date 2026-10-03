import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reclamationsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { useToast, ToastContainer } from '../components/Toast';
import { Plus, MessageSquare, Search, Lock, Paperclip, X as XIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { Reclamation } from '../types';
import { StatutBadge } from './ReclamationDetail';

const CREATE_ROLES = ['chef_exploitation', 'chef_maintenance', 'chef_centrale', 'md_center_assistant', 'admin'];

export default function Reclamations() {
  const { user } = useAuth();
  const canCreate = CREATE_ROLES.includes(user?.role ?? '');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toasts, show: showToast, dismiss } = useToast();

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [clotureId, setClotureId] = useState<string | null>(null);
  const [motif, setMotif] = useState('');

  const { data: reclamations, isLoading } = useQuery<Reclamation[]>({
    queryKey: ['reclamations'],
    queryFn: reclamationsApi.list,
  });

  const filtered = useMemo(() => {
    if (!reclamations) return reclamations;
    const q = search.trim().toLowerCase();
    if (!q) return reclamations;
    return reclamations.filter((r) => {
      const haystack = `${r.titre} ${r.description} ${r.demandeur?.prenom ?? ''} ${r.demandeur?.nom ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [reclamations, search]);

  const canIntervene = (r: Reclamation) =>
    r.demandeur_id === user?.id || user?.role === 'md_center_assistant' || user?.role === 'admin';

  const createMut = useMutation({
    mutationFn: () => reclamationsApi.create({ titre: titre.trim(), description: description.trim(), fichier }),
    onSuccess: (r: Reclamation) => {
      qc.invalidateQueries({ queryKey: ['reclamations'] });
      setCreateOpen(false);
      setTitre('');
      setDescription('');
      setFichier(null);
      navigate(`/reclamations/${r.id}`);
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Erreur', 'error'),
  });

  const cloturerMut = useMutation({
    mutationFn: () => reclamationsApi.cloturer(clotureId!, motif.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reclamations'] });
      setClotureId(null);
      setMotif('');
      showToast('Réclamation clôturée');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Erreur', 'error'),
  });

  return (
    <div>
      <PageHeader
        title="Réclamations & Assistance"
        subtitle="Signaler un défaut et demander l'assistance du MD Center"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="bg-slate-800 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-white text-sm w-48 focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
              />
            </div>
            {canCreate && (
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                <Plus size={15} /> Nouvelle réclamation
              </button>
            )}
          </div>
        }
      />

      <div className="p-3 sm:p-6">
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          {isLoading && <p className="text-center text-slate-500 py-8 text-xs">Chargement...</p>}
          {!isLoading && (!filtered || filtered.length === 0) && (
            <p className="text-center text-slate-600 py-10 text-xs italic">
              {search ? 'Aucun résultat' : 'Aucune réclamation'}
            </p>
          )}
          <div className="divide-y divide-slate-800">
            {filtered?.map((r) => (
              <div
                key={r.id}
                onClick={() => navigate(`/reclamations/${r.id}`)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate">{r.titre}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {r.demandeur?.prenom} {r.demandeur?.nom} · {format(new Date(r.cree_le), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-slate-500 flex-shrink-0">
                  <MessageSquare size={12} /> {r._count?.commentaires ?? 0}
                </span>
                <StatutBadge statut={r.statut} />
                {r.statut !== 'cloturee' && canIntervene(r) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setClotureId(r.id); setMotif(''); }}
                    className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 rounded-lg px-2.5 py-1 transition-colors"
                  >
                    <Lock size={12} /> Clôturer
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle réclamation">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Titre</label>
            <input
              type="text"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500"
              placeholder="Ex : Vanne de régulation bloquée"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Décrire le défaut et l'assistance demandée..."
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 cursor-pointer w-fit transition-colors">
              <Paperclip size={13} />
              {fichier ? fichier.name : 'Joindre une image ou un PDF'}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
              />
            </label>
            {fichier && (
              <button onClick={() => setFichier(null)} className="text-[11px] text-slate-500 hover:text-red-400 mt-1 flex items-center gap-1">
                <XIcon size={11} /> Retirer
              </button>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-white text-sm px-3 py-1.5">
              Annuler
            </button>
            <button
              onClick={() => createMut.mutate()}
              disabled={!titre.trim() || !description.trim() || createMut.isPending}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-medium px-4 py-1.5 rounded-lg text-sm transition-colors"
            >
              {createMut.isPending ? 'Envoi...' : 'Envoyer'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!clotureId} onClose={() => setClotureId(null)} title="Clôturer la réclamation">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Motif de clôture *</label>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              autoFocus
              className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
              placeholder="Ex : Problème résolu après intervention sur site"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setClotureId(null)} className="text-slate-400 hover:text-white text-sm px-3 py-1.5">
              Annuler
            </button>
            <button
              onClick={() => cloturerMut.mutate()}
              disabled={!motif.trim() || cloturerMut.isPending}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-medium px-4 py-1.5 rounded-lg text-sm transition-colors"
            >
              {cloturerMut.isPending ? 'Clôture...' : 'Clôturer'}
            </button>
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
