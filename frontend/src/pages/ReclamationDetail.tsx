import { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reclamationsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Attachment from '../components/Attachment';
import { useToast, ToastContainer } from '../components/Toast';
import { ArrowLeft, Lock, Send, Paperclip, X as XIcon } from 'lucide-react';
import { format } from 'date-fns';
import type { Reclamation, StatutReclamation } from '../types';
import { STATUT_RECLAMATION_LABELS } from '../types';

const STATUT_STYLES: Record<StatutReclamation, string> = {
  ouverte: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  en_cours: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  cloturee: 'bg-green-500/15 text-green-400 border-green-500/30',
};

export function StatutBadge({ statut }: { statut: StatutReclamation }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUT_STYLES[statut]}`}>
      {STATUT_RECLAMATION_LABELS[statut]}
    </span>
  );
}

export default function ReclamationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toasts, show: showToast, dismiss } = useToast();
  const [reponse, setReponse] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clotureOpen, setClotureOpen] = useState(false);
  const [motif, setMotif] = useState('');

  const { data: detail, isLoading } = useQuery<Reclamation>({
    queryKey: ['reclamation', id],
    queryFn: () => reclamationsApi.get(id!),
    enabled: !!id,
    refetchInterval: 5000,
  });

  const commenterMut = useMutation({
    mutationFn: () => reclamationsApi.commenter(id!, reponse.trim(), fichier),
    onSuccess: () => {
      setReponse('');
      setFichier(null);
      qc.invalidateQueries({ queryKey: ['reclamation', id] });
      qc.invalidateQueries({ queryKey: ['reclamations'] });
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Erreur', 'error'),
  });

  const cloturerMut = useMutation({
    mutationFn: () => reclamationsApi.cloturer(id!, motif.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reclamation', id] });
      qc.invalidateQueries({ queryKey: ['reclamations'] });
      setClotureOpen(false);
      setMotif('');
      showToast('Réclamation clôturée');
    },
    onError: (err: any) => showToast(err?.response?.data?.error || 'Erreur', 'error'),
  });

  const canIntervene = !!detail && (detail.demandeur_id === user?.id || user?.role === 'md_center_assistant' || user?.role === 'admin');

  return (
    <div>
      <PageHeader
        title={detail?.titre || 'Réclamation'}
        subtitle={detail ? `Par ${detail.demandeur?.prenom} ${detail.demandeur?.nom} · ${format(new Date(detail.cree_le), 'dd/MM/yyyy HH:mm')}` : undefined}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/reclamations')}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={15} /> Retour
            </button>
            {detail && <StatutBadge statut={detail.statut} />}
            {detail && detail.statut !== 'cloturee' && canIntervene && (
              <button
                onClick={() => setClotureOpen(true)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Lock size={13} /> Clôturer
              </button>
            )}
          </div>
        }
      />

      <div className="p-3 sm:p-6 max-w-3xl mx-auto">
        {isLoading && <p className="text-center text-slate-500 py-8 text-xs">Chargement...</p>}
        {!isLoading && !detail && (
          <p className="text-center text-slate-600 py-10 text-xs italic">Réclamation introuvable</p>
        )}

        {detail && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 space-y-2">
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{detail.description}</p>
              {detail.piece_jointe_nom && (
                <Attachment
                  url={reclamationsApi.pieceJointeUrl(detail.id)}
                  nom={detail.piece_jointe_nom}
                  type={detail.piece_jointe_type}
                />
              )}
            </div>

            <div className="px-4 py-3 space-y-2 min-h-[8rem]">
              {(detail.commentaires ?? []).map((c) => {
                const isAssistant = c.auteur?.role === 'md_center_assistant';
                return (
                  <div key={c.id} className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm space-y-1.5 ${isAssistant ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-800 text-slate-100'}`}>
                      <p className="text-[11px] font-medium mb-0.5 opacity-70">{c.auteur?.prenom} {c.auteur?.nom}</p>
                      {c.contenu && <p className="whitespace-pre-wrap break-words">{c.contenu}</p>}
                      {c.piece_jointe_nom && (
                        <Attachment
                          url={reclamationsApi.commentairePieceJointeUrl(c.id)}
                          nom={c.piece_jointe_nom}
                          type={c.piece_jointe_type}
                        />
                      )}
                      <p className="text-[10px] mt-1 opacity-50">{format(new Date(c.cree_le), 'dd/MM HH:mm')}</p>
                    </div>
                  </div>
                );
              })}
              {(detail.commentaires ?? []).length === 0 && (
                <p className="text-center text-slate-600 text-xs italic py-3">Aucune réponse pour le moment</p>
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-800">
              {detail.statut === 'cloturee' ? (
                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 space-y-1">
                  <p className="flex items-center gap-2">
                    <Lock size={13} /> Clôturée par {detail.clotureur?.prenom} {detail.clotureur?.nom} le{' '}
                    {detail.cloture_le && format(new Date(detail.cloture_le), 'dd/MM/yyyy HH:mm')}
                  </p>
                  {detail.motif_cloture && (
                    <p className="text-slate-300 pl-5">Motif : {detail.motif_cloture}</p>
                  )}
                </div>
              ) : canIntervene ? (
                <div className="space-y-1.5">
                  {fichier && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 w-fit">
                      <Paperclip size={11} /> {fichier.name}
                      <button onClick={() => setFichier(null)} className="hover:text-red-400">
                        <XIcon size={11} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setFichier(e.target.files?.[0] ?? null)}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      title="Joindre une image ou un PDF"
                      className="text-slate-400 hover:text-amber-400 flex-shrink-0 transition-colors"
                    >
                      <Paperclip size={16} />
                    </button>
                    <input
                      type="text"
                      value={reponse}
                      onChange={(e) => setReponse(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (reponse.trim() || fichier)) commenterMut.mutate(); }}
                      placeholder="Écrire une réponse..."
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => commenterMut.mutate()}
                      disabled={(!reponse.trim() && !fichier) || commenterMut.isPending}
                      className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 rounded-lg w-9 h-9 flex items-center justify-center flex-shrink-0 transition-colors"
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">En attente de réponse du MD Center.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal open={clotureOpen} onClose={() => setClotureOpen(false)} title="Clôturer la réclamation">
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
            <button onClick={() => setClotureOpen(false)} className="text-slate-400 hover:text-white text-sm px-3 py-1.5">
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
