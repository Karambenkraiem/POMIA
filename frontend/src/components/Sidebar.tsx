import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, BookOpen, ClipboardList, Activity,
  Wrench, Bell, AlertTriangle, Users, Settings, Zap, LogOut, CalendarDays, FileText,
  Sun, Moon, History, ChevronLeft, ChevronRight, ChevronDown, LineChart, BarChart3, ClipboardCheck, Database,
  NotebookPen, LifeBuoy,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { essaisApi } from '../lib/api';
import type { EssaiConfig } from '../types';

type NavItem = { to: string; icon: any; label: string; roles?: string[] };

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/journee', icon: BookOpen, label: 'Journée', roles: ['operateur', 'chef_bloc', 'chef_quart', 'chef_exploitation', 'admin'] },
  { to: '/releves-bloc', icon: Activity, label: 'Relevés Chef Bloc', roles: ['chef_bloc', 'chef_quart', 'admin', 'chef_exploitation'] },
  { to: '/releves-op', icon: ClipboardList, label: 'Saisie Relevés Op.', roles: ['operateur', 'chef_quart', 'admin', 'chef_exploitation'] },
  { to: '/manouvres', icon: Zap, label: 'Manœuvres & Incidents' },
  { to: '/alarmes', icon: Bell, label: 'Alarmes Répétitives' },
  { to: '/ordres-travaux', icon: Wrench, label: 'Ordres de Travaux' },
  { to: '/defauts', icon: AlertTriangle, label: 'Matériels Défectueux' },
  { to: '/releves-jour', icon: CalendarDays, label: 'Visualisation' },
  { to: '/rapport', icon: FileText, label: 'Rapport Journalier' },
  { to: '/analyse', icon: LineChart, label: 'Analyse & Diagnostic', roles: ['chef_quart', 'chef_exploitation', 'directeur', 'admin'] },
  { to: '/statistique', icon: BarChart3, label: 'Statistique', roles: ['statistique', 'admin'] },
  { to: '/consignes', icon: NotebookPen, label: 'Consignes', roles: ['operateur', 'chef_bloc', 'chef_quart', 'chef_exploitation', 'chef_centrale', 'admin'] },
  { to: '/reclamations', icon: LifeBuoy, label: 'Réclamations & Assistance', roles: ['operateur', 'chef_bloc', 'chef_quart', 'chef_exploitation', 'chef_centrale', 'chef_maintenance', 'directeur', 'statistique', 'md_center_assistant', 'admin'] },
];

const adminItems = [
  { to: '/admin/users', icon: Users, label: 'Utilisateurs' },
  { to: '/admin/seuils', icon: Settings, label: 'Seuils d\'alerte' },
  { to: '/admin/logs', icon: History, label: 'Journal d\'activité' },
  { to: '/admin/essais', icon: ClipboardCheck, label: 'Essais (paramétrage)' },
  { to: '/admin/visites', icon: BarChart3, label: 'Visites du site', adminOnly: true },
  { to: '/admin/donnees-demo', icon: Database, label: 'Données fictives', adminOnly: true },
];

const COLLAPSE_KEY = 'pomia_sidebar_collapsed';
const ESSAI_ROLES = ['operateur', 'chef_bloc', 'chef_quart', 'chef_exploitation', 'admin'];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [essaisOpen, setEssaisOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const canSeeEssais = ESSAI_ROLES.includes(user?.role ?? '');
  const { data: essais } = useQuery({
    queryKey: ['essais-config'],
    queryFn: essaisApi.list,
    enabled: canSeeEssais,
  });

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64 md:w-60'} flex-shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col h-screen sticky top-0 print:hidden transition-[width] duration-200`}>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <img src="/logo.png" alt="POMIA Logo" className="w-10 h-10 object-contain flex-shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">POMIA</p>
              <p className="text-slate-400 text-xs truncate">Supervision industrielle</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Déplier le menu' : 'Réduire le menu'}
          className="hidden md:flex items-center justify-center text-slate-500 hover:text-white flex-shrink-0 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-0.5">
          {navItems.filter(({ roles }) => !roles || roles.includes(user?.role ?? '')).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${collapsed ? 'justify-center' : ''} ${
                  isActive
                    ? 'bg-blue-500/15 text-blue-300 font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon size={15} />
              {!collapsed && label}
            </NavLink>
          ))}

          {canSeeEssais && (
            collapsed ? (
              <NavLink to="/essai" title="Essais"
                className={({ isActive }) =>
                  `flex items-center justify-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                    isActive ? 'bg-blue-500/15 text-blue-300 font-medium' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`
                }>
                <ClipboardCheck size={15} />
              </NavLink>
            ) : (
              <div>
                <button onClick={() => setEssaisOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                  <span className="flex items-center gap-3">
                    <ClipboardCheck size={15} />
                    Essais
                  </span>
                  <ChevronDown size={13} className={`transition-transform ${essaisOpen ? 'rotate-180' : ''}`} />
                </button>
                {essaisOpen && (
                  <div className="ml-6 space-y-0.5 mt-0.5">
                    <NavLink to="/essai" end onClick={onClose}
                      className={({ isActive }) =>
                        `block px-3 py-1.5 rounded text-xs transition-colors ${
                          isActive ? 'bg-blue-500/15 text-blue-300 font-medium' : 'text-slate-500 hover:text-white hover:bg-slate-800'
                        }`
                      }>
                      Aujourd'hui
                    </NavLink>
                    {essais?.map((e: EssaiConfig) => (
                      <NavLink key={e.id} to={`/essai/${e.id}`} onClick={onClose}
                        className={({ isActive }) =>
                          `block px-3 py-1.5 rounded text-xs truncate transition-colors ${
                            isActive ? 'bg-blue-500/15 text-blue-300 font-medium' : 'text-slate-500 hover:text-white hover:bg-slate-800'
                          }`
                        }>
                        {e.nom}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {(user?.role === 'admin' || user?.role === 'chef_exploitation') && (
          <div className="mt-4">
            {!collapsed && <p className="px-3 text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Administration</p>}
            <div className="space-y-0.5">
              {adminItems.filter((i) => !i.adminOnly || user?.role === 'admin').map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${collapsed ? 'justify-center' : ''} ${
                      isActive
                        ? 'bg-blue-500/15 text-blue-300 font-medium'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon size={15} />
                  {!collapsed && label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-slate-700 px-3 py-3">
        <NavLink to="/profil" onClick={onClose} title={collapsed ? 'Mon profil' : undefined}
          className={`flex items-center gap-2 mb-2 -mx-1 px-1 py-1 rounded hover:bg-slate-800 transition-colors ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-slate-900 font-bold text-xs flex-shrink-0">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.prenom} {user?.nom}</p>
              <p className="text-slate-400 text-xs">{user?.matricule}</p>
            </div>
          )}
        </NavLink>
        <div className={`flex items-center mb-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            className="flex items-center gap-2 text-slate-400 hover:text-amber-400 text-xs transition-colors px-1"
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            {!collapsed && (theme === 'dark' ? 'Mode clair' : 'Mode sombre')}
          </button>
        </div>
        <button
          onClick={logout}
          title={collapsed ? 'Déconnexion' : undefined}
          className={`flex items-center gap-2 text-slate-400 hover:text-red-400 text-xs transition-colors w-full px-1 ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={13} />
          {!collapsed && 'Déconnexion'}
        </button>
      </div>
    </aside>
  );
}
