import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { consignesApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import { Trash2, Pencil, Check, X as XIcon, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import type { Consigne } from '../types';

const EDIT_ROLES = ['chef_exploitation', 'chef_quart', 'admin'];

export default function Consignes() {
  const { user } = useAuth();
  const canEdit = EDIT_ROLES.includes(user?.role ?? '');
  const qc = useQueryClient();
  const [texte, setTexte] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTexte, setEditTexte] = useState('');
  const newRef = useRef<HTMLInputElement>(null);

  const { data: consignes, isLoading } = useQuery<Consigne[]>({
    queryKey: ['consignes'],
    queryFn: consignesApi.list,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['consignes'] });

  const createMut = useMutation({
    mutationFn: (data: any) => consignesApi.create(data),
    onSuccess: () => { invalidate(); setTexte(''); setTimeout(() => newRef.current?.focus(), 50); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => consignesApi.update(id, data),
    onSuccess: () => { invalidate(); setEditingId(null); },
  });

  const relancerMut = useMutation({
    mutationFn: (id: string) => consignesApi.relancer(id),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => consignesApi.remove(id),
    onSuccess: invalidate,
  });

  function handleAdd() {
    if (!texte.trim()) return;
    createMut.mutate({ texte: texte.trim() });
  }

  function startEdit(c: Consigne) {
    if (!canEdit) return;
    setEditingId(c.id);
    setEditTexte(c.texte);
  }

  function handleUpdate(id: string) {
    if (!editTexte.trim()) return;
    updateMut.mutate({ id, data: { texte: editTexte.trim() } });
  }

  function toggleTerminee(c: Consigne) {
    if (!canEdit) return;
    updateMut.mutate({ id: c.id, data: { terminee: !c.terminee } });
  }

  return (
    <div>
      <PageHeader title="Consignes" subtitle="Consignes du chef d'exploitation et du chef de quart" />

      <div className="p-3 sm:p-6">
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="bg-cyan-500 px-4 py-2.5">
            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wide italic">Consignes</h3>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-cyan-500/15 border-b border-cyan-500/30">
                <th className="text-center px-4 py-2 text-cyan-300 font-semibold w-32 whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-2 text-cyan-300 font-semibold whitespace-nowrap">Consigne</th>
                <th className="text-left px-4 py-2 text-cyan-300 font-semibold w-40 whitespace-nowrap">Créé par</th>
                <th className="text-center px-4 py-2 text-cyan-300 font-semibold w-24 whitespace-nowrap">Terminée</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="text-center text-slate-500 py-6 text-xs">Chargement...</td></tr>
              )}
              {!isLoading && (!consignes || consignes.length === 0) && (
                <tr><td colSpan={5} className="text-center text-slate-600 py-8 text-xs italic">Aucune consigne</td></tr>
              )}

              {consignes?.map((c) => (
                <tr key={c.id} className={`border-b border-slate-800 ${c.terminee ? 'opacity-60' : ''}`}>
                  <td className="text-center px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                    {format(new Date(c.date), 'dd/MM/yyyy HH:mm')}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === c.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          autoFocus
                          value={editTexte}
                          onChange={(e) => setEditTexte(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); handleUpdate(c.id); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 bg-slate-800 border border-amber-500/60 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-400"
                        />
                        <button onClick={() => handleUpdate(c.id)} className="text-green-400 hover:text-green-300">
                          <Check size={15} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-300">
                          <XIcon size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className={c.terminee ? 'text-slate-500 line-through' : 'text-slate-200'}>{c.texte}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                    {c.auteur?.prenom} {c.auteur?.nom}
                  </td>
                  <td className="text-center px-4 py-3">
                    <button
                      onClick={() => toggleTerminee(c)}
                      disabled={!canEdit}
                      className={`w-5 h-5 rounded flex items-center justify-center border transition-colors mx-auto ${
                        c.terminee ? 'bg-green-500 border-green-500 text-slate-900' : 'border-slate-600 text-transparent'
                      } ${canEdit ? 'cursor-pointer hover:border-green-400' : 'cursor-default'}`}
                    >
                      <Check size={13} />
                    </button>
                  </td>
                  <td className="px-2 py-3 text-center">
                    {canEdit && editingId !== c.id && (
                      <div className="flex items-center justify-center gap-2">
                        {c.terminee ? (
                          <button onClick={() => relancerMut.mutate(c.id)} title="Relancer"
                            className="text-slate-500 hover:text-amber-400 transition-colors">
                            <RotateCcw size={13} />
                          </button>
                        ) : (
                          <button onClick={() => startEdit(c)} title="Modifier"
                            className="text-slate-600 hover:text-amber-400 transition-colors">
                            <Pencil size={13} />
                          </button>
                        )}
                        <button onClick={() => deleteMut.mutate(c.id)} title="Supprimer"
                          className="text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {canEdit && (
                <tr className="border-t-2 border-amber-500/30 bg-slate-800/40">
                  <td className="px-4 py-2 text-center text-slate-600 text-xs">—</td>
                  <td className="px-2 py-2">
                    <input
                      ref={newRef}
                      type="text"
                      value={texte}
                      onChange={(e) => setTexte(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                      placeholder="Nouvelle consigne..."
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                    />
                  </td>
                  <td colSpan={2} />
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={handleAdd}
                      disabled={!texte.trim() || createMut.isPending}
                      className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-bold px-3 py-1.5 rounded text-xs transition-colors"
                    >
                      {createMut.isPending ? '...' : '+'}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
