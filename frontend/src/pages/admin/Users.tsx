import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, authApi } from '../../lib/api';
import PageHeader from '../../components/PageHeader';
import Modal from '../../components/Modal';
import { Plus, Pencil, UserX, ChevronUp, ChevronDown, ChevronsUpDown, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABELS } from '../../types';
import type { User, Role } from '../../types';

const ROLES: Role[] = ['operateur', 'chef_bloc', 'chef_quart', 'chef_exploitation', 'chef_centrale', 'chef_maintenance', 'directeur', 'guest', 'statistique', 'md_center_assistant', 'admin'];
const ROLE_ORDER: Record<Role, number> = { operateur: 0, chef_bloc: 1, chef_quart: 2, chef_exploitation: 3, chef_centrale: 4, chef_maintenance: 5, directeur: 6, guest: 7, statistique: 8, md_center_assistant: 9, admin: 10 };
const EMPTY_FORM = { role: 'operateur' as Role };

type SortCol = 'nom' | 'matricule' | 'role' | 'actif';

export default function Users() {
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'nom', dir: 'asc' });

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const sortedUsers = useMemo(() => {
    if (!users) return [];
    return [...users].sort((a: User, b: User) => {
      let cmp = 0;
      if (sort.col === 'nom') cmp = `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr');
      else if (sort.col === 'matricule') cmp = a.matricule.localeCompare(b.matricule, 'fr');
      else if (sort.col === 'role') cmp = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
      else if (sort.col === 'actif') cmp = (b.actif ? 1 : 0) - (a.actif ? 1 : 0);
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [users, sort]);

  function toggleSort(col: SortCol) {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
  }

  function SortIcon({ col }: { col: SortCol }) {
    if (sort.col !== col) return <ChevronsUpDown size={11} className="text-slate-600 ml-1 inline" />;
    return sort.dir === 'asc'
      ? <ChevronUp size={11} className="text-amber-400 ml-1 inline" />
      : <ChevronDown size={11} className="text-amber-400 ml-1 inline" />;
  }

  const saveMut = useMutation({
    mutationFn: (data: any) => editUser ? usersApi.update(editUser.id, data) : usersApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowModal(false); setEditUser(null); setForm(EMPTY_FORM); },
  });

  function confirmSave() {
    setShowConfirm(false);
    saveMut.mutate(form);
  }

  const deactivateMut = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const { data: demoStatus } = useQuery({
    queryKey: ['demo-status'],
    queryFn: authApi.demoStatus,
    enabled: isAdmin,
  });

  const toggleDemoMut = useMutation({
    mutationFn: (enabled: boolean) => authApi.setDemoStatus(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demo-status'] }),
  });

  function openEdit(u: User) {
    setEditUser(u);
    setForm({ nom: u.nom, prenom: u.prenom, role: u.role, actif: u.actif });
    setShowModal(true);
  }

  const ROLE_COLORS: Record<Role, string> = {
    operateur: 'bg-slate-700 text-slate-300',
    chef_bloc: 'bg-blue-400/10 text-blue-400',
    chef_quart: 'bg-purple-400/10 text-purple-400',
    chef_exploitation: 'bg-amber-400/10 text-amber-400',
    chef_centrale: 'bg-teal-400/10 text-teal-400',
    chef_maintenance: 'bg-orange-400/10 text-orange-400',
    directeur: 'bg-indigo-400/10 text-indigo-400',
    guest: 'bg-slate-500/10 text-slate-400',
    statistique: 'bg-cyan-400/10 text-cyan-400',
    md_center_assistant: 'bg-slate-500/10 text-slate-400',
    admin: 'bg-red-400/10 text-red-400',
  };

  return (
    <div>
      <PageHeader
        title="Gestion des Utilisateurs"
        subtitle="Comptes du personnel autorisé"
        actions={
          <>
            {isAdmin && (
              <button
                onClick={() => toggleDemoMut.mutate(!demoStatus?.enabled)}
                disabled={toggleDemoMut.isPending || demoStatus === undefined}
                title="Affiche/masque le panneau d'accès rapide sur la page de connexion"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors ${
                  demoStatus?.enabled
                    ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {demoStatus?.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                Mode démo {demoStatus?.enabled ? 'activé' : 'désactivé'}
              </button>
            )}
            <button onClick={() => { setEditUser(null); setForm(EMPTY_FORM); setShowModal(true); }}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium px-3 py-1.5 rounded-lg text-sm">
              <Plus size={14} /> Nouvel utilisateur
            </button>
          </>
        }
      />

      <div className="p-3 sm:p-6">
        <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {([['matricule', 'Matricule'], ['nom', 'Nom Prénom'], ['role', 'Rôle'], ['actif', 'Statut']] as [SortCol, string][]).map(([col, lbl]) => (
                  <th key={col} onClick={() => toggleSort(col)}
                    className="px-4 py-3 text-left text-xs text-slate-400 font-medium cursor-pointer hover:text-white select-none whitespace-nowrap">
                    {lbl}<SortIcon col={col} />
                  </th>
                ))}
                <th className="px-4 py-3 text-xs text-slate-400 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Chargement...</td></tr>}
              {sortedUsers.map((u: User) => (
                <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-amber-400">{u.matricule}</td>
                  <td className="px-4 py-3 text-slate-200">{u.prenom} {u.nom}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.actif ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                      {u.actif ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)} className="text-slate-500 hover:text-amber-400 transition-colors"><Pencil size={13} /></button>
                      {u.actif && (
                        <button onClick={() => deactivateMut.mutate(u.id)} title="Désactiver" className="text-slate-500 hover:text-red-400 transition-colors"><UserX size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditUser(null); }} title={editUser ? 'Modifier utilisateur' : 'Nouvel utilisateur'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Prénom *</label>
              <input value={form.prenom || ''} onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Nom *</label>
              <input value={form.nom || ''} onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>
          {!editUser && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Matricule *</label>
              <input value={form.matricule || ''} onChange={(e) => setForm({ ...form, matricule: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
            </div>
          )}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Rôle *</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500">
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">{editUser ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe *'}</label>
            <input type="password" value={form.password || ''} onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editUser ? '••••••••' : 'Minimum 6 caractères'}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500" />
          </div>
          {editUser && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="actif" checked={form.actif ?? true} onChange={(e) => setForm({ ...form, actif: e.target.checked })} className="accent-amber-500" />
              <label htmlFor="actif" className="text-sm text-slate-300 cursor-pointer">Compte actif</label>
            </div>
          )}
          {saveMut.error && (
            <p className="text-red-400 text-sm">{(saveMut.error as any)?.response?.data?.error || 'Erreur'}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowModal(false); setEditUser(null); }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm">Annuler</button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={saveMut.isPending || !form.prenom || !form.nom || (!editUser && (!form.matricule || !form.password))}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium py-2 rounded-lg text-sm disabled:opacity-50">
              {saveMut.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showConfirm} onClose={() => setShowConfirm(false)} title="Confirmer" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            {editUser
              ? <>Confirmer la modification de l'utilisateur <span className="text-white font-medium">{form.prenom} {form.nom}</span> ?</>
              : <>Confirmer la création de l'utilisateur <span className="text-white font-medium">{form.prenom} {form.nom}</span> ({form.matricule}) avec le rôle <span className="text-white font-medium">{ROLE_LABELS[form.role as Role]}</span> ?</>}
          </p>
          {editUser && form.password && (
            <p className="text-xs text-amber-400">Le mot de passe de ce compte sera également modifié.</p>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowConfirm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm">Annuler</button>
            <button
              onClick={confirmSave}
              disabled={saveMut.isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium py-2 rounded-lg text-sm disabled:opacity-50">
              {saveMut.isPending ? 'Enregistrement...' : 'Confirmer'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
