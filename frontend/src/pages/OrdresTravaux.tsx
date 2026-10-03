import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { otApi, journeesApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedDate } from '../contexts/SelectedDateContext';
import PageHeader from '../components/PageHeader';
import DateInput from '../components/DateInput';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DISCIPLINES = [
  { value: 'mec',  label: 'Mécanique' },
  { value: 'elec', label: 'Électrique' },
  { value: 'inst', label: 'Instrumentation' },
  { value: 'autre', label: 'Prestation' },
];

type TabType = 'curatif' | 'preventif';
type RowState = { numero_ot: string; kks_equipement: string; description: string; discipline: string };
const EMPTY_ROW: RowState = { numero_ot: '', kks_equipement: '', description: '', discipline: '' };

export default function OrdresTravaux() {
  const { user } = useAuth();
  const canEdit = ['chef_bloc', 'chef_quart', 'chef_exploitation', 'admin'].includes(user?.role ?? '');
  const qc = useQueryClient();
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [activeTab, setActiveTab] = useState<TabType>('curatif');
  const [newRow, setNewRow] = useState<RowState>(EMPTY_ROW);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<RowState>(EMPTY_ROW);

  /* refs — new row */
  const newNumRef  = useRef<HTMLInputElement>(null);
  const newKksRef  = useRef<HTMLInputElement>(null);
  const newDescRef = useRef<HTMLInputElement>(null);
  const newDiscRef = useRef<HTMLSelectElement>(null);

  /* refs — edit row */
  const editKksRef  = useRef<HTMLInputElement>(null);
  const editDescRef = useRef<HTMLInputElement>(null);
  const editDiscRef = useRef<HTMLSelectElement>(null);

  const { data: journees } = useQuery({
    queryKey: ['journees'],
    queryFn: () => journeesApi.list(),
  });
  const journee = journees?.find((j: any) => (j.jour as string).slice(0, 10) === selectedDate);

  const { data: ots, isLoading } = useQuery({
    queryKey: ['ots', journee?.id],
    queryFn: () => otApi.list(journee!.id),
    enabled: !!journee?.id,
  });

  const filtered = (ots ?? []).filter((ot: any) => ot.type_maintenance === activeTab);

  const createMut = useMutation({
    mutationFn: (data: any) => otApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ots'] });
      setNewRow(EMPTY_ROW);
      setTimeout(() => newNumRef.current?.focus(), 50);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => otApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ots'] }); setEditingId(null); },
  });

  const etatMut = useMutation({
    mutationFn: ({ id, etat }: { id: string; etat: string }) => otApi.update(id, { etat }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ots'] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => otApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ots'] }),
  });

  function handleAdd() {
    if (!journee || !newRow.description.trim()) return;
    createMut.mutate({
      journee_id: journee.id,
      type_maintenance: activeTab,
      etat: 'en_cours',
      numero_ot: newRow.numero_ot.trim() || null,
      kks_equipement: newRow.kks_equipement.trim() || null,
      description: newRow.description.trim(),
      discipline: newRow.discipline || null,
    });
  }

  function startEdit(ot: any) {
    if (!canEdit) return;
    setEditingId(ot.id);
    setEditRow({
      numero_ot: ot.numero_ot ?? '',
      kks_equipement: ot.kks_equipement ?? '',
      description: ot.description ?? '',
      discipline: ot.discipline ?? '',
    });
  }

  function handleUpdate(id: string) {
    if (!editRow.description.trim()) return;
    const currentOt = (ots ?? []).find((o: any) => o.id === id);
    updateMut.mutate({
      id,
      data: {
        type_maintenance: activeTab,
        etat: currentOt?.etat ?? 'en_cours',
        numero_ot: editRow.numero_ot.trim() || null,
        kks_equipement: editRow.kks_equipement.trim() || null,
        description: editRow.description.trim(),
        discipline: editRow.discipline || null,
      },
    });
  }

  const inputCls = 'w-full bg-slate-800 border border-amber-500/60 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-400';
  const newInputCls = 'w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600';

  return (
    <div>
      <PageHeader
        title="Ordres de Travaux"
        subtitle="Suivi des interventions de maintenance"
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

            {/* ── Onglets ── */}
            <div className="flex border-b border-slate-700">
              {([
                { key: 'curatif',   label: 'Maintenance Curative' },
                { key: 'preventif', label: 'Maintenance Préventive' },
              ] as { key: TabType; label: string }[]).map(({ key, label }) => (
                <button key={key}
                  onClick={() => { setActiveTab(key); setEditingId(null); setNewRow(EMPTY_ROW); }}
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
                {activeTab === 'curatif' ? 'Maintenance Curative' : 'Maintenance Préventive'}
              </h3>
            </div>

            {canEdit && (
              <p className="text-[11px] text-slate-500 px-4 py-1.5 border-b border-slate-800 italic">
                Cliquer sur une ligne pour modifier · Entrée pour naviguer entre les champs · Entrée sur Discipline pour valider
              </p>
            )}

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-cyan-500/15 border-b border-cyan-500/30">
                  <th className="text-center px-3 py-2 text-cyan-300 font-semibold w-28">N° OT</th>
                  <th className="text-center px-3 py-2 text-cyan-300 font-semibold w-36">KKS Équipement</th>
                  <th className="text-left   px-3 py-2 text-cyan-300 font-semibold">Description de l'intervention</th>
                  <th className="text-center px-3 py-2 text-cyan-300 font-semibold w-40">Discipline</th>
                  <th className="text-center px-3 py-2 text-cyan-300 font-semibold w-32">État</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-6 text-xs">Chargement...</td></tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-600 py-8 text-xs italic">
                      Aucun OT enregistré pour cette journée
                    </td>
                  </tr>
                )}

                {filtered.map((ot: any) =>
                  editingId === ot.id ? (
                    <tr key={ot.id} className="border-b border-amber-500/40 bg-amber-500/5">
                      <td className="px-2 py-1.5 w-28">
                        <input type="text" value={editRow.numero_ot} autoFocus
                          placeholder="N° OT"
                          onChange={e => setEditRow(r => ({ ...r, numero_ot: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); editKksRef.current?.focus(); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={`${inputCls} text-amber-400 font-mono text-center`} />
                      </td>
                      <td className="px-2 py-1.5 w-36">
                        <input ref={editKksRef} type="text" value={editRow.kks_equipement}
                          placeholder="KKS"
                          onChange={e => setEditRow(r => ({ ...r, kks_equipement: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); editDescRef.current?.focus(); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={inputCls} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input ref={editDescRef} type="text" value={editRow.description}
                          placeholder="Description..."
                          onChange={e => setEditRow(r => ({ ...r, description: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); editDiscRef.current?.focus(); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={inputCls} />
                      </td>
                      <td className="px-2 py-1.5 w-40">
                        <select ref={editDiscRef} value={editRow.discipline}
                          onChange={e => setEditRow(r => ({ ...r, discipline: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); handleUpdate(ot.id); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className={inputCls}>
                          <option value="">—</option>
                          {DISCIPLINES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          (ots ?? []).find((o: any) => o.id === ot.id)?.etat === 'termine'
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-blue-500/15 text-blue-400'
                        }`}>
                          {(ots ?? []).find((o: any) => o.id === ot.id)?.etat === 'termine' ? 'FIN TRAVAUX' : 'EN COURS'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => setEditingId(null)}
                          className="text-slate-500 hover:text-slate-300 text-xs transition-colors">✕</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={ot.id}
                      onClick={() => startEdit(ot)}
                      className={`border-b border-slate-800 transition-colors ${canEdit ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}>
                      <td className="text-center px-3 py-3 font-mono text-amber-400 font-bold text-xs">{ot.numero_ot || '—'}</td>
                      <td className="text-center px-3 py-3 text-slate-300 text-xs">{ot.kks_equipement || '—'}</td>
                      <td className="px-3 py-3 text-slate-200">{ot.description}</td>
                      <td className="text-center px-3 py-3 text-slate-300 text-xs">
                        {DISCIPLINES.find(d => d.value === ot.discipline)?.label || '—'}
                      </td>
                      <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                        {canEdit ? (
                          <button
                            onClick={() => etatMut.mutate({
                              id: ot.id,
                              etat: ot.etat === 'termine' ? 'en_cours' : 'termine',
                            })}
                            disabled={etatMut.isPending}
                            className={`text-xs px-2 py-1 rounded-full font-semibold transition-colors disabled:opacity-40 ${
                              ot.etat === 'termine'
                                ? 'bg-green-500/15 text-green-400 hover:bg-green-500/30'
                                : 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/30'
                            }`}>
                            {ot.etat === 'termine' ? 'FIN TRAVAUX' : 'EN COURS'}
                          </button>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            ot.etat === 'termine'
                              ? 'bg-green-500/15 text-green-400'
                              : 'bg-blue-500/15 text-blue-400'
                          }`}>
                            {ot.etat === 'termine' ? 'FIN TRAVAUX' : 'EN COURS'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                        {canEdit && (
                          <button onClick={() => deleteMut.mutate(ot.id)} disabled={deleteMut.isPending}
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
                    <td className="px-2 py-2 w-28">
                      <input ref={newNumRef} type="text" value={newRow.numero_ot}
                        placeholder="N° OT"
                        onChange={e => setNewRow(r => ({ ...r, numero_ot: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newKksRef.current?.focus(); } }}
                        className={`${newInputCls} text-amber-400 font-mono text-center`} />
                    </td>
                    <td className="px-2 py-2 w-36">
                      <input ref={newKksRef} type="text" value={newRow.kks_equipement}
                        placeholder="KKS"
                        onChange={e => setNewRow(r => ({ ...r, kks_equipement: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newDescRef.current?.focus(); } }}
                        className={newInputCls} />
                    </td>
                    <td className="px-2 py-2">
                      <input ref={newDescRef} type="text" value={newRow.description}
                        placeholder="Description de l'intervention..."
                        onChange={e => setNewRow(r => ({ ...r, description: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newDiscRef.current?.focus(); } }}
                        className={newInputCls} />
                    </td>
                    <td className="px-2 py-2 w-40">
                      <select ref={newDiscRef} value={newRow.discipline}
                        onChange={e => setNewRow(r => ({ ...r, discipline: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500">
                        <option value="">— Discipline —</option>
                        {DISCIPLINES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="text-xs px-2 py-1 rounded-full font-semibold bg-blue-500/15 text-blue-400">
                        EN COURS
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={handleAdd}
                        disabled={!newRow.description.trim() || createMut.isPending}
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
