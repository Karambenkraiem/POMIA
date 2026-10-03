import { useState, useRef, useEffect, forwardRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { manouvresApi, journeesApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useSelectedDate } from '../contexts/SelectedDateContext';
import PageHeader from '../components/PageHeader';
import DateInput from '../components/DateInput';
import TimeInput from '../components/TimeInput';
import { Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TypeManouvre } from '../types';
import { tunisLocalToISOString, formatTunisHM } from '../lib/tz';

const PHRASES = [
  'Ordre de démarrage',
  'Allumage de flamme 15,9% TNH',
  'FSNL et couplage de groupe',
  'AGC EN SERVICE',
  'Groupe en production',
  'Groupe sur virage et disponible',
  "Ordre d'arrêt TG",
  'Extinction de flamme 25,3% TNH',
  'FSNL',
  'Couplage de groupe et 20 MW',
  'Groupe sur virage',
  'AGC Hors service',
  'AGC Hors service et PMC',
  'AGC Hors service et PMS',
  'Montée en PMS',
  'Montée en PMC',
  'Baisse de charge à PMC',
];

type Tab = 'manoeuvre' | 'incident';

/* ── Autocomplete ── */
const AutoInput = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  onEscape?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  suggestionsList?: string[];
}>(function AutoInput({ value, onChange, onCommit, onEscape, placeholder, autoFocus, suggestionsList = PHRASES }, inputRef) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const suggestions = value.trim()
    ? suggestionsList.filter(p => p.toLowerCase().includes(value.toLowerCase()))
    : [];

  useEffect(() => { setCursor(0); }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length > 0 && open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const chosen = suggestions[cursor];
        onChange(chosen);
        setOpen(false);
        onCommit(chosen);
        return;
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onCommit(value);
      return;
    }
    if (e.key === 'Escape') { setOpen(false); onEscape?.(); }
  }

  return (
    <div ref={ref} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (value.trim()) setOpen(true); }}
        onKeyDown={handleKey}
        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
      />
      {open && suggestions.length > 0 && (
        <ul className="fixed z-[9999] bg-slate-800 border border-amber-500/50 rounded-lg shadow-2xl max-h-56 overflow-y-auto"
          style={{ width: ref.current?.offsetWidth, top: (ref.current?.getBoundingClientRect().bottom ?? 0) + 4, left: ref.current?.getBoundingClientRect().left }}>
          {suggestions.map((s, i) => (
            <li
              key={s}
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); onCommit(s); }}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                i === cursor ? 'bg-amber-500/25 text-amber-300' : 'text-slate-200 hover:bg-slate-700'
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

type RowState = { heure: string; description: string };

export default function Manouvres() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'incident' ? 'incident' : 'manoeuvre');
  const canEditManoeuvre = ['chef_bloc', 'chef_quart', 'chef_exploitation', 'admin'].includes(user?.role ?? '');
  const canEditIncident = ['chef_quart', 'admin'].includes(user?.role ?? '');
  const canEdit = tab === 'manoeuvre' ? canEditManoeuvre : canEditIncident;

  const qc = useQueryClient();
  const { selectedDate, setSelectedDate } = useSelectedDate();
  const [newRow, setNewRow] = useState<RowState>({ heure: format(new Date(), 'HH:mm'), description: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<RowState>({ heure: '', description: '' });
  const newDescRef = useRef<HTMLInputElement>(null);
  const editDescRef = useRef<HTMLInputElement>(null);

  const { data: journees } = useQuery({
    queryKey: ['journees'],
    queryFn: () => journeesApi.list(),
  });
  const journee = journees?.find((j: any) => (j.jour as string).slice(0, 10) === selectedDate);

  const { data: allEntries, isLoading } = useQuery({
    queryKey: ['manouvres', journee?.id],
    queryFn: () => manouvresApi.list(journee!.id),
    enabled: !!journee?.id,
  });

  const entries = allEntries?.filter((m: any) =>
    tab === 'incident' ? m.type_manouvre === 'incident' : m.type_manouvre !== 'incident'
  );

  const newHeureRef = useRef<HTMLInputElement>(null);

  const createMut = useMutation({
    mutationFn: (data: any) => manouvresApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manouvres'] });
      setNewRow(r => ({ ...r, heure: format(new Date(), 'HH:mm'), description: '' }));
      setTimeout(() => newHeureRef.current?.focus(), 50);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => manouvresApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['manouvres'] }); setEditingId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => manouvresApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manouvres'] }),
  });

  function handleAdd(desc?: string) {
    if (!journee) return;
    const description = (desc ?? newRow.description).trim();
    if (!description) return;
    createMut.mutate({
      journee_id: journee.id,
      heure_manouvre: tunisLocalToISOString(`${selectedDate}T${newRow.heure}`),
      description,
      type_manouvre: (tab === 'incident' ? 'incident' : 'exploitation') as TypeManouvre,
      feuille_numero: 1,
    });
  }

  function startEdit(m: any) {
    if (!canEdit) return;
    setEditingId(m.id);
    setEditRow({ heure: formatTunisHM(m.heure_manouvre), description: m.description });
  }

  function handleUpdate(id: string, desc?: string) {
    const description = (desc ?? editRow.description).trim();
    if (!description) return;
    updateMut.mutate({
      id,
      data: {
        heure_manouvre: tunisLocalToISOString(`${selectedDate}T${editRow.heure}`),
        description,
        type_manouvre: (tab === 'incident' ? 'incident' : 'exploitation') as TypeManouvre,
        feuille_numero: 1,
      },
    });
  }

  const isIncident = tab === 'incident';
  const sectionTitle = isIncident ? 'Incidents' : "Manœuvres d'Exploitation";
  const emptyLabel = isIncident ? 'Aucun incident enregistré pour cette journée' : 'Aucune manœuvre enregistrée pour cette journée';

  return (
    <div>
      <PageHeader
        title="Manœuvres & Incidents"
        subtitle="Journal chronologique des manœuvres et incidents"
        actions={
          <div className="flex items-center gap-2">
            <DateInput value={selectedDate} onChange={setSelectedDate} />
            {!!journee?.incidents_count && tab !== 'incident' && (
              <button
                onClick={() => setTab('incident')}
                title={`${journee.incidents_count} incident(s) saisi(s) ce jour`}
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors"
              >
                <AlertTriangle size={12} /> {journee.incidents_count}
              </button>
            )}
          </div>
        }
      />

      <div className="p-3 sm:p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-800">
          {([['manoeuvre', 'Manœuvres'], ['incident', 'Incidents']] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!journee && (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-8 text-center text-slate-400">
            Aucune journée pour le {format(new Date(selectedDate + 'T12:00:00'), 'd MMMM yyyy', { locale: fr })}
          </div>
        )}

        {journee && (
          /* overflow-visible pour que le dropdown autocomplete ne soit pas coupé */
          <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-visible">
            <div className="bg-cyan-500 px-4 py-2.5 rounded-t-lg">
              <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wide italic">
                {sectionTitle}
              </h3>
            </div>

            {isIncident && !canEdit && (
              <p className="text-[11px] text-slate-500 px-4 py-1.5 border-b border-slate-800 italic">
                Lecture seule · seul le chef de quart (ou un administrateur) peut saisir un incident
              </p>
            )}
            {canEdit && (
              <p className="text-[11px] text-slate-500 px-4 py-1.5 border-b border-slate-800 italic">
                Cliquer sur une ligne pour modifier · ↑↓ suggestions · Entrée pour valider
              </p>
            )}

            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-cyan-500/15 border-b border-cyan-500/30">
                  <th className="text-center px-4 py-2 text-cyan-300 font-semibold w-24">Heure</th>
                  <th className="text-left px-4 py-2 text-cyan-300 font-semibold">{sectionTitle}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={3} className="text-center text-slate-500 py-6 text-xs">Chargement...</td>
                  </tr>
                )}
                {!isLoading && (!entries || entries.length === 0) && (
                  <tr>
                    <td colSpan={3} className="text-center text-slate-600 py-8 text-xs italic">
                      {emptyLabel}
                    </td>
                  </tr>
                )}

                {entries?.map((m: any) =>
                  editingId === m.id ? (
                    <tr key={m.id} className="border-b border-amber-500/40 bg-amber-500/5">
                      <td className="px-2 py-1.5 w-24">
                        <TimeInput value={editRow.heure}
                          onChange={v => setEditRow(r => ({ ...r, heure: v }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); editDescRef.current?.focus(); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="w-full bg-slate-800 border border-amber-500/60 rounded px-2 py-1 text-white text-sm font-mono text-center focus:outline-none focus:border-amber-400" />
                      </td>
                      <td className="px-2 py-1.5">
                        <AutoInput
                          ref={editDescRef}
                          value={editRow.description}
                          onChange={v => setEditRow(r => ({ ...r, description: v }))}
                          onCommit={v => handleUpdate(m.id, v)}
                          onEscape={() => setEditingId(null)}
                          suggestionsList={isIncident ? [] : PHRASES}
                          autoFocus
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => setEditingId(null)}
                          className="text-slate-500 hover:text-slate-300 text-xs transition-colors">✕</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={m.id}
                      onClick={() => startEdit(m)}
                      className={`border-b border-slate-800 transition-colors ${canEdit ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}>
                      <td className="text-center px-4 py-3 font-mono text-amber-400 font-bold">
                        {formatTunisHM(m.heure_manouvre)}
                      </td>
                      <td className="px-4 py-3 text-slate-200">{m.description}</td>
                      <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                        {canEdit && (
                          <button onClick={() => deleteMut.mutate(m.id)} disabled={deleteMut.isPending}
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
                    <td className="px-2 py-2 w-24">
                      <TimeInput ref={newHeureRef} value={newRow.heure}
                        onChange={v => setNewRow(r => ({ ...r, heure: v }))}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); newDescRef.current?.focus(); } }}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm font-mono text-center focus:outline-none focus:border-amber-500" />
                    </td>
                    <td className="px-2 py-2">
                      <AutoInput
                        ref={newDescRef}
                        value={newRow.description}
                        onChange={v => setNewRow(r => ({ ...r, description: v }))}
                        onCommit={v => { if (v.trim()) handleAdd(v); }}
                        placeholder={isIncident ? "Saisir l'incident..." : 'Saisir la manœuvre...'}
                        suggestionsList={isIncident ? [] : PHRASES}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => handleAdd()} disabled={!newRow.description.trim() || createMut.isPending}
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
