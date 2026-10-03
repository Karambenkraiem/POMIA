import { useState, useRef, useMemo, forwardRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alarmesApi, journeesApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedDate } from '../contexts/SelectedDateContext';
import PageHeader from '../components/PageHeader';
import DateInput from '../components/DateInput';
import { Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

/* ── Champ texte avec ref externe ── */
const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput(props, ref) {
    return <input ref={ref} {...props} />;
  }
);

type RowState = { tag: string; designation: string; equipement: string; premiere_apparition: string };
const EMPTY_ROW: RowState = { tag: '', designation: '', equipement: '', premiere_apparition: '' };

type SortCol = 'tag' | 'designation' | 'equipement' | 'premiere_apparition';

export default function Alarmes() {
  const { user } = useAuth();
  const canEdit = ['chef_quart', 'chef_exploitation', 'admin'].includes(user?.role ?? '');
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [newRow, setNewRow] = useState<RowState>({ ...EMPTY_ROW, premiere_apparition: today });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<RowState>(EMPTY_ROW);
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' } | null>(null);

  /* refs — nouvelle ligne */
  const newTagRef  = useRef<HTMLInputElement>(null);
  const newDescRef = useRef<HTMLInputElement>(null);
  const newEquipRef = useRef<HTMLInputElement>(null);

  /* refs — ligne en édition */
  const editDescRef = useRef<HTMLInputElement>(null);
  const editEquipRef = useRef<HTMLInputElement>(null);

  /* ref pour éviter la double-copie */
  const hasCopied = useRef<string | null>(null);

  const { data: journees } = useQuery({
    queryKey: ['journees'],
    queryFn: () => journeesApi.list(),
  });
  const journee = journees?.find((j: any) => (j.jour as string).slice(0, 10) === selectedDate);

  /* journée précédente */
  const prevDateStr = format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd');
  const prevJournee = journees?.find((j: any) => (j.jour as string).slice(0, 10) === prevDateStr);

  const { data: alarmes, isLoading } = useQuery({
    queryKey: ['alarmes', journee?.id],
    queryFn: () => alarmesApi.list(journee!.id),
    enabled: !!journee?.id,
  });

  const sortedAlarmes = useMemo(() => {
    if (!alarmes) return alarmes;
    if (!sort) return alarmes;
    const { col, dir } = sort;
    return [...alarmes].sort((a: any, b: any) => {
      const va = a[col] ?? '';
      const vb = b[col] ?? '';
      const cmp = String(va).localeCompare(String(vb), 'fr');
      return dir === 'asc' ? cmp : -cmp;
    });
  }, [alarmes, sort]);

  function toggleSort(col: SortCol) {
    setSort(s => s?.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sort?.col !== col) return <ChevronsUpDown size={11} className="text-slate-600 ml-1 inline" />;
    return sort.dir === 'asc'
      ? <ChevronUp size={11} className="text-amber-400 ml-1 inline" />
      : <ChevronDown size={11} className="text-amber-400 ml-1 inline" />;
  }

  /* alarmes de la veille */
  const { data: prevAlarmes } = useQuery({
    queryKey: ['alarmes', prevJournee?.id],
    queryFn: () => alarmesApi.list(prevJournee!.id),
    enabled: !!prevJournee?.id,
  });

  /* ── Copie automatique des alarmes de la veille ── */
  useEffect(() => {
    if (!journee?.id || !prevJournee?.id) return;
    if (alarmes === undefined || prevAlarmes === undefined) return;
    if (alarmes.length > 0) return;
    if (prevAlarmes.length === 0) return;
    if (hasCopied.current === journee.id) return;
    hasCopied.current = journee.id;

    (async () => {
      for (const a of prevAlarmes) {
        await alarmesApi.create({
          journee_id: journee.id,
          tag: a.tag,
          designation: a.designation,
          equipement: a.equipement || null,
          repetitive: true,
          origine: a.origine || 'HMI',
          premiere_apparition: a.premiere_apparition || null,
        });
      }
      qc.invalidateQueries({ queryKey: ['alarmes', journee.id] });
    })();
  }, [journee?.id, prevJournee?.id, alarmes, prevAlarmes]);

  const createMut = useMutation({
    mutationFn: (data: any) => alarmesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alarmes'] });
      setNewRow({ ...EMPTY_ROW, premiere_apparition: today });
      setTimeout(() => newTagRef.current?.focus(), 50);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => alarmesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['alarmes'] }); setEditingId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => alarmesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alarmes'] }),
  });

  function handleAdd() {
    if (!journee || !newRow.designation.trim()) return;
    createMut.mutate({
      journee_id: journee.id,
      tag: newRow.tag.trim() || null,
      designation: newRow.designation.trim(),
      equipement: newRow.equipement.trim() || null,
      repetitive: true,
      origine: 'HMI',
      premiere_apparition: newRow.premiere_apparition || null,
    });
  }

  function startEdit(a: any) {
    if (!canEdit) return;
    setEditingId(a.id);
    setEditRow({
      tag: a.tag ?? '',
      designation: a.designation ?? '',
      equipement: a.equipement ?? '',
      premiere_apparition: a.premiere_apparition ? format(new Date(a.premiere_apparition), 'yyyy-MM-dd') : '',
    });
  }

  function handleUpdate(id: string) {
    if (!editRow.designation.trim()) return;
    const current = (alarmes ?? []).find((a: any) => a.id === id);
    updateMut.mutate({
      id,
      data: {
        tag: editRow.tag.trim() || null,
        designation: editRow.designation.trim(),
        equipement: editRow.equipement.trim() || null,
        repetitive: current?.repetitive ?? true,
        origine: current?.origine ?? 'HMI',
        premiere_apparition: editRow.premiere_apparition || null,
      },
    });
  }

  const inputCls = 'w-full bg-slate-800 border border-amber-500/60 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-400';
  const newInputCls = 'w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600';

  return (
    <div>
      <PageHeader
        title="Alarmes Répétitives"
        subtitle="Registre des alarmes répétitives de la journée"
        actions={
          <DateInput value={selectedDate} onChange={setSelectedDate} />
        }
      />

      <div className="p-3 sm:p-6">
        {!journee && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
            Aucune journée pour le {format(new Date(selectedDate + 'T12:00:00'), 'd MMMM yyyy', { locale: fr })}
          </div>
        )}

        {journee && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-visible">

            {/* ── En-tête cyan ── */}
            <div className="bg-cyan-500 px-4 py-2.5 rounded-t-lg">
              <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wide italic">
                Alarmes Répétitives
              </h3>
            </div>

            {canEdit && (
              <p className="text-[11px] text-slate-500 px-4 py-1.5 border-b border-slate-800 italic">
                Cliquer sur une ligne pour modifier · Entrée pour naviguer · Entrée sur Désignation pour valider
              </p>
            )}

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-cyan-500/15 border-b border-cyan-500/30">
                  <th onClick={() => toggleSort('tag')}
                    className="text-center px-4 py-2 text-cyan-300 font-semibold w-36 cursor-pointer hover:text-white select-none whitespace-nowrap">
                    TG<SortIcon col="tag" />
                  </th>
                  <th onClick={() => toggleSort('designation')}
                    className="text-left px-4 py-2 text-cyan-300 font-semibold cursor-pointer hover:text-white select-none whitespace-nowrap">
                    Désignation<SortIcon col="designation" />
                  </th>
                  <th onClick={() => toggleSort('equipement')}
                    className="text-left px-4 py-2 text-cyan-300 font-semibold w-44 cursor-pointer hover:text-white select-none whitespace-nowrap">
                    Équipement<SortIcon col="equipement" />
                  </th>
                  <th onClick={() => toggleSort('premiere_apparition')}
                    className="text-center px-4 py-2 text-cyan-300 font-semibold w-40 cursor-pointer hover:text-white select-none whitespace-nowrap">
                    1re apparition<SortIcon col="premiere_apparition" />
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-6 text-xs">Chargement...</td></tr>
                )}
                {!isLoading && (!alarmes || alarmes.length === 0) && (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-600 py-8 text-xs italic">
                      Aucune alarme enregistrée pour cette journée
                    </td>
                  </tr>
                )}

                {sortedAlarmes?.map((a: any) =>
                  editingId === a.id ? (
                    <tr key={a.id} className="border-b border-amber-500/40 bg-amber-500/5">
                      <td className="px-2 py-1.5 w-36">
                        <input type="text" value={editRow.tag} autoFocus
                          placeholder="TG"
                          onChange={e => setEditRow(r => ({ ...r, tag: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); editDescRef.current?.focus(); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={`${inputCls} font-mono text-center text-amber-400`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input ref={editDescRef} type="text" value={editRow.designation}
                          placeholder="Désignation..."
                          onChange={e => setEditRow(r => ({ ...r, designation: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); editEquipRef.current?.focus(); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={inputCls} />
                      </td>
                      <td className="px-2 py-1.5 w-44">
                        <input ref={editEquipRef} type="text" value={editRow.equipement}
                          placeholder="Équipement..."
                          onChange={e => setEditRow(r => ({ ...r, equipement: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); handleUpdate(a.id); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={inputCls} />
                      </td>
                      <td className="px-2 py-1.5 w-40">
                        <input type="date" value={editRow.premiere_apparition}
                          onChange={e => setEditRow(r => ({ ...r, premiere_apparition: e.target.value }))}
                          className={`${inputCls} text-center`} />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => setEditingId(null)}
                          className="text-slate-500 hover:text-slate-300 text-xs transition-colors">✕</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={a.id}
                      onClick={() => startEdit(a)}
                      className={`border-b border-slate-800 transition-colors ${canEdit ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}>
                      <td className="text-center px-4 py-3 font-mono text-amber-400 font-bold text-xs">{a.tag || '—'}</td>
                      <td className="px-4 py-3 text-slate-200">{a.designation}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{a.equipement || '—'}</td>
                      <td className="text-center px-4 py-3 font-mono text-xs text-slate-400">
                        {a.premiere_apparition ? format(new Date(a.premiere_apparition), 'dd/MM/yyyy') : '—'}
                      </td>
                      <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                        {canEdit && (
                          <button onClick={() => deleteMut.mutate(a.id)} disabled={deleteMut.isPending}
                            className="text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                )}

                {/* ── Nouvelle ligne ── */}
                {canEdit && (
                  <tr className="border-t-2 border-amber-500/30 bg-slate-800/40">
                    <td className="px-2 py-2 w-36">
                      <input ref={newTagRef} type="text" value={newRow.tag}
                        placeholder="TG"
                        onChange={e => setNewRow(r => ({ ...r, tag: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newDescRef.current?.focus(); } }}
                        className={`${newInputCls} font-mono text-center text-amber-400`} />
                    </td>
                    <td className="px-2 py-2">
                      <input ref={newDescRef} type="text" value={newRow.designation}
                        placeholder="Désignation de l'alarme..."
                        onChange={e => setNewRow(r => ({ ...r, designation: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newEquipRef.current?.focus(); } }}
                        className={newInputCls} />
                    </td>
                    <td className="px-2 py-2 w-44">
                      <input ref={newEquipRef} type="text" value={newRow.equipement}
                        placeholder="Équipement..."
                        onChange={e => setNewRow(r => ({ ...r, equipement: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                        className={newInputCls} />
                    </td>
                    <td className="px-2 py-2 w-40">
                      <input type="date" value={newRow.premiere_apparition}
                        onChange={e => setNewRow(r => ({ ...r, premiere_apparition: e.target.value }))}
                        className={newInputCls} />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={handleAdd}
                        disabled={!newRow.designation.trim() || createMut.isPending}
                        className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-900 font-bold px-3 py-1.5 rounded text-xs transition-colors">
                        {createMut.isPending ? '...' : '+'}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
