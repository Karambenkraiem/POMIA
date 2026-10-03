import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { defautsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const SECTIONS = [
  { key: 'site',        label: 'SITE' },
  { key: 'tg',          label: 'TG' },
  { key: 'auxiliaires', label: 'Points de Réserve Retenus' },
] as const;

type ZoneKey = 'site' | 'tg' | 'auxiliaires';

type RowState = {
  kks_equipement: string;
  description: string;
  date_declaration: string;
  date_cloture: string;
  commentaires: string;
};

const today = format(new Date(), 'yyyy-MM-dd');
const EMPTY_ROW: RowState = {
  kks_equipement: '',
  description: '',
  date_declaration: today,
  date_cloture: '',
  commentaires: '',
};

function fmtDate(val: string | null | undefined) {
  if (!val) return '—';
  try { return format(new Date(val.split('T')[0] + 'T12:00:00'), 'dd/MM/yyyy'); }
  catch { return val; }
}

export default function MaterielsDefectueux() {
  const { user } = useAuth();
  const canEditFields = ['chef_quart', 'chef_exploitation', 'admin'].includes(user?.role ?? '');
  const canEditCommentaires = ['chef_quart', 'chef_exploitation', 'admin', 'chef_maintenance'].includes(user?.role ?? '');
  const canEdit = canEditCommentaires;
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<ZoneKey>('site');
  const [newRow, setNewRow] = useState<RowState>(EMPTY_ROW);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<RowState>(EMPTY_ROW);

  /* refs — nouvelle ligne */
  const newKksRef  = useRef<HTMLInputElement>(null);
  const newDescRef = useRef<HTMLTextAreaElement>(null);
  const newDeclRef = useRef<HTMLInputElement>(null);
  const newCloRef  = useRef<HTMLInputElement>(null);
  const newComRef  = useRef<HTMLTextAreaElement>(null);

  /* refs — ligne en édition */
  const editDescRef = useRef<HTMLTextAreaElement>(null);
  const editDeclRef = useRef<HTMLInputElement>(null);
  const editCloRef  = useRef<HTMLInputElement>(null);
  const editComRef  = useRef<HTMLTextAreaElement>(null);

  const { data: allDefauts, isLoading } = useQuery({
    queryKey: ['defauts'],
    queryFn: () => defautsApi.list({ actif: 'true' }),
  });

  const filtered = (allDefauts ?? []).filter((d: any) => d.zone === activeTab);

  const createMut = useMutation({
    mutationFn: (data: any) => defautsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['defauts'] });
      setNewRow({ ...EMPTY_ROW, date_declaration: format(new Date(), 'yyyy-MM-dd') });
      setTimeout(() => newKksRef.current?.focus(), 50);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => defautsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['defauts'] }); setEditingId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => defautsApi.update(id, { actif: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['defauts'] }),
  });

  function handleAdd() {
    if (!newRow.kks_equipement.trim() || !newRow.description.trim()) return;
    createMut.mutate({
      kks_equipement: newRow.kks_equipement.trim(),
      description: newRow.description.trim(),
      zone: activeTab,
      date_declaration: newRow.date_declaration,
      date_cloture: newRow.date_cloture || null,
      commentaires: newRow.commentaires.trim() || null,
      statut: newRow.date_cloture ? 'cloture' : 'ouvert',
      actif: true,
    });
  }

  function startEdit(d: any) {
    if (!canEdit) return;
    setEditingId(d.id);
    setEditRow({
      kks_equipement: d.kks_equipement ?? '',
      description: d.description ?? '',
      date_declaration: d.date_declaration ? d.date_declaration.split('T')[0] : today,
      date_cloture: d.date_cloture ? d.date_cloture.split('T')[0] : '',
      commentaires: d.commentaires ?? '',
    });
  }

  function handleUpdate(id: string) {
    if (!editRow.kks_equipement.trim() || !editRow.description.trim()) return;
    updateMut.mutate({
      id,
      data: {
        kks_equipement: editRow.kks_equipement.trim(),
        description: editRow.description.trim(),
        zone: activeTab,
        date_declaration: editRow.date_declaration,
        date_cloture: editRow.date_cloture || null,
        commentaires: editRow.commentaires.trim() || null,
        statut: editRow.date_cloture ? 'cloture' : 'ouvert',
        actif: true,
      },
    });
  }

  const inputCls    = 'w-full bg-slate-800 border border-amber-500/60 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-400';
  const newInputCls = 'w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600';
  const taCls       = 'resize-none overflow-hidden leading-snug';

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  useEffect(() => {
    if (!editingId) return;
    setTimeout(() => {
      if (editDescRef.current) autoResize(editDescRef.current);
      if (editComRef.current)  autoResize(editComRef.current);
    }, 0);
  }, [editingId]);

  const section = SECTIONS.find(s => s.key === activeTab)!;

  return (
    <div>
      <PageHeader
        title="Matériels Défectueux & Réserves"
        subtitle="Matériels défectueux et points de réserves retenus"
      />

      <div className="p-3 sm:p-6">
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-visible">

          {/* ── Onglets ── */}
          <div className="flex border-b border-slate-700">
            {SECTIONS.map(({ key, label }) => (
              <button key={key}
                onClick={() => {
                  setActiveTab(key);
                  setEditingId(null);
                  setNewRow({ ...EMPTY_ROW, date_declaration: format(new Date(), 'yyyy-MM-dd') });
                }}
                className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                  activeTab === key
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── En-tête cyan ── */}
          <div className="bg-cyan-500 px-4 py-2.5">
            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wide italic">
              {section.label}
            </h3>
          </div>

          {canEdit && (
            <p className="text-[11px] text-slate-500 px-4 py-1.5 border-b border-slate-800 italic">
              {canEditFields
                ? 'Cliquer sur une ligne pour modifier · Entrée pour naviguer · Shift+Entrée pour aller à la ligne · Entrée sur Commentaires pour valider'
                : 'Cliquer sur une ligne pour saisir les commentaires · Entrée pour valider'}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse" style={{ minWidth: '900px' }}>
              <thead>
                <tr className="bg-cyan-500/15 border-b border-cyan-500/30">
                  <th className="text-center px-3 py-2 text-cyan-300 font-semibold w-28">KKS Équipement</th>
                  <th className="text-left   px-3 py-2 text-cyan-300 font-semibold w-60">Description</th>
                  <th className="text-center px-3 py-2 text-cyan-300 font-semibold w-32">Date de déclaration</th>
                  <th className="text-center px-3 py-2 text-cyan-300 font-semibold w-32">Date clôture</th>
                  <th className="text-left   px-3 py-2 text-cyan-300 font-semibold w-60">Commentaires</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={6} className="text-center text-slate-500 py-6 text-xs">Chargement...</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-600 py-8 text-xs italic">
                      Aucune entrée enregistrée pour cette section
                    </td>
                  </tr>
                )}

                {filtered.map((d: any) =>
                  editingId === d.id ? (
                    <tr key={d.id} className="border-b border-amber-500/40 bg-amber-500/5">
                      <td className="px-2 py-1.5 w-28">
                        <input type="text" value={editRow.kks_equipement}
                          autoFocus={canEditFields}
                          disabled={!canEditFields}
                          placeholder="KKS"
                          onChange={e => setEditRow(r => ({ ...r, kks_equipement: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); editDescRef.current?.focus(); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={`${canEditFields ? inputCls : 'w-full bg-slate-800/30 border border-slate-700 rounded px-2 py-1 text-slate-500 text-sm font-mono text-center cursor-not-allowed'}`} />
                      </td>
                      <td className="px-2 py-1.5 w-60">
                        <textarea ref={editDescRef} value={editRow.description} rows={1}
                          disabled={!canEditFields}
                          placeholder="Description..."
                          onChange={e => { setEditRow(r => ({ ...r, description: e.target.value })); autoResize(e.target); }}
                          onInput={e => autoResize(e.currentTarget)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editDeclRef.current?.focus(); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={`${canEditFields ? inputCls : 'w-full bg-slate-800/30 border border-slate-700 rounded px-2 py-1 text-slate-500 text-sm cursor-not-allowed'} ${taCls}`} />
                      </td>
                      <td className="px-2 py-1.5 w-32">
                        <input ref={editDeclRef} type="date" value={editRow.date_declaration}
                          disabled={!canEditFields}
                          onChange={e => setEditRow(r => ({ ...r, date_declaration: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); editCloRef.current?.focus(); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={canEditFields ? inputCls : 'w-full bg-slate-800/30 border border-slate-700 rounded px-2 py-1 text-slate-500 text-sm cursor-not-allowed'} />
                      </td>
                      <td className="px-2 py-1.5 w-32">
                        <input ref={editCloRef} type="date" value={editRow.date_cloture}
                          disabled={!canEditFields}
                          onChange={e => setEditRow(r => ({ ...r, date_cloture: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); editComRef.current?.focus(); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={canEditFields ? inputCls : 'w-full bg-slate-800/30 border border-slate-700 rounded px-2 py-1 text-slate-500 text-sm cursor-not-allowed'} />
                      </td>
                      <td className="px-2 py-1.5 w-60">
                        <textarea ref={editComRef} value={editRow.commentaires} rows={1}
                          autoFocus={!canEditFields}
                          placeholder="Commentaires..."
                          onChange={e => { setEditRow(r => ({ ...r, commentaires: e.target.value })); autoResize(e.target); }}
                          onInput={e => autoResize(e.currentTarget)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUpdate(d.id); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={`${inputCls} ${taCls}`} />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => setEditingId(null)}
                          className="text-slate-500 hover:text-slate-300 text-xs transition-colors">✕</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={d.id}
                      onClick={() => startEdit(d)}
                      className={`border-b border-slate-800 transition-colors ${canEdit ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}>
                      <td className="text-center px-3 py-3 font-mono text-amber-400 font-bold text-xs whitespace-pre-line align-top">
                        {d.kks_equipement}
                      </td>
                      <td className="px-3 py-3 text-slate-200 text-sm align-top whitespace-pre-wrap w-60">{d.description}</td>
                      <td className="text-center px-3 py-3 text-slate-300 text-xs align-top">{fmtDate(d.date_declaration)}</td>
                      <td className="text-center px-3 py-3 text-slate-300 text-xs align-top">{fmtDate(d.date_cloture)}</td>
                      <td className="px-3 py-3 text-slate-400 text-xs align-top whitespace-pre-wrap w-60">{d.commentaires || '—'}</td>
                      <td className="px-2 py-3 text-center align-top" onClick={e => e.stopPropagation()}>
                        {canEditFields && (
                          <button onClick={() => deleteMut.mutate(d.id)} disabled={deleteMut.isPending}
                            className="text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                )}

                {/* ── Nouvelle ligne ── */}
                {canEditFields && (
                  <tr className="border-t-2 border-amber-500/30 bg-slate-800/40">
                    <td className="px-2 py-2 w-28">
                      <input ref={newKksRef} type="text" value={newRow.kks_equipement}
                        placeholder="KKS"
                        onChange={e => setNewRow(r => ({ ...r, kks_equipement: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newDescRef.current?.focus(); } }}
                        className={`${newInputCls} font-mono text-center text-amber-400`} />
                    </td>
                    <td className="px-2 py-2 w-60">
                      <textarea ref={newDescRef} value={newRow.description} rows={1}
                        placeholder="Description du défaut..."
                        onChange={e => { setNewRow(r => ({ ...r, description: e.target.value })); autoResize(e.target); }}
                        onInput={e => autoResize(e.currentTarget)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); newDeclRef.current?.focus(); }
                        }}
                        className={`${newInputCls} ${taCls}`} />
                    </td>
                    <td className="px-2 py-2 w-32">
                      <input ref={newDeclRef} type="date" value={newRow.date_declaration}
                        onChange={e => setNewRow(r => ({ ...r, date_declaration: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newCloRef.current?.focus(); } }}
                        className={newInputCls} />
                    </td>
                    <td className="px-2 py-2 w-32">
                      <input ref={newCloRef} type="date" value={newRow.date_cloture}
                        onChange={e => setNewRow(r => ({ ...r, date_cloture: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newComRef.current?.focus(); } }}
                        className={newInputCls} />
                    </td>
                    <td className="px-2 py-2 w-60">
                      <textarea ref={newComRef} value={newRow.commentaires} rows={1}
                        placeholder="Commentaires..."
                        onChange={e => { setNewRow(r => ({ ...r, commentaires: e.target.value })); autoResize(e.target); }}
                        onInput={e => autoResize(e.currentTarget)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd(); }
                        }}
                        className={`${newInputCls} ${taCls}`} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={handleAdd}
                        disabled={!newRow.kks_equipement.trim() || !newRow.description.trim() || createMut.isPending}
                        className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-bold px-3 py-1.5 rounded text-xs transition-colors">
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
    </div>
  );
}
