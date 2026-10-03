import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { defautsApi } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import { Pencil, Check, X } from 'lucide-react';
import type { SeuilAlarme } from '../../types';

export default function Seuils() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const { data: seuils, isLoading } = useQuery({ queryKey: ['seuils'], queryFn: defautsApi.listSeuils });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => defautsApi.updateSeuil(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seuils'] }); setEditId(null); },
  });

  function startEdit(s: SeuilAlarme) {
    setEditId(s.id);
    setEditForm({ valeur_min: s.valeur_min ?? '', valeur_max: s.valeur_max ?? '', actif: s.actif });
  }

  return (
    <div>
      <PageHeader title="Seuils d'Alerte" subtitle="Paramètres de surveillance GE 9001E" />

      <div className="p-3 sm:p-6">
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {['Paramètre', 'Description', 'Min', 'Max', 'Unité', 'Actif', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Chargement...</td></tr>}
              {seuils?.map((s: SeuilAlarme) => (
                <tr key={s.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-amber-400">{s.parametre}</td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{s.description || '—'}</td>
                  <td className="px-4 py-3">
                    {editId === s.id ? (
                      <input type="number" value={editForm.valeur_min} onChange={(e) => setEditForm({ ...editForm, valeur_min: e.target.value })}
                        className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-500" />
                    ) : (
                      <span className="text-slate-300">{s.valeur_min ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === s.id ? (
                      <input type="number" value={editForm.valeur_max} onChange={(e) => setEditForm({ ...editForm, valeur_max: e.target.value })}
                        className="w-20 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-500" />
                    ) : (
                      <span className="text-slate-300">{s.valeur_max ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{s.unite || '—'}</td>
                  <td className="px-4 py-3">
                    {editId === s.id ? (
                      <input type="checkbox" checked={editForm.actif} onChange={(e) => setEditForm({ ...editForm, actif: e.target.checked })} className="accent-amber-500" />
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.actif ? 'bg-green-400/10 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                        {s.actif ? 'Oui' : 'Non'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === s.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => updateMut.mutate({ id: s.id, data: editForm })} className="text-green-400 hover:text-green-300"><Check size={14} /></button>
                        <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-white"><X size={14} /></button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(s)} className="text-slate-500 hover:text-amber-400 transition-colors"><Pencil size={13} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}
