import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/api';
import { ROLE_LABELS } from '../types';
import type { Role } from '../types';
import { Zap } from 'lucide-react';
import AppDownloadQR from '../components/AppDownloadQR';

interface DemoUser {
  matricule: string;
  nom: string;
  prenom: string;
  role: Role;
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: demoUsers } = useQuery<DemoUser[]>({
    queryKey: ['demo-users'],
    queryFn: authApi.demoUsers,
    retry: false,
  });

  const doLogin = async (m: string, p: string) => {
    setError('');
    setLoading(true);
    try {
      await login(m, p);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    doLogin(matricule, password);
  };

  const quickLogin = (u: DemoUser) => {
    doLogin(u.matricule, u.role === 'guest' ? '00000' : '123456');
  };

  const showDemoPanel = !!demoUsers?.length;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className={`flex flex-col-reverse lg:flex-row items-center gap-6 w-full justify-center ${showDemoPanel ? 'max-w-3xl' : 'max-w-sm'}`}>
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500 rounded-xl mb-4">
              <Zap size={28} className="text-slate-900" />
            </div>
            <h1 className="text-2xl font-bold text-white">POMIA</h1>
            <p className="text-slate-400 text-sm mt-1">Supervision, maintenance & rondes industrielles</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-700 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Matricule</label>
              <input
                type="text"
                value={matricule}
                onChange={(e) => setMatricule(e.target.value)}
                placeholder="ex: ADMIN001"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                required
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-semibold py-2.5 rounded-lg transition-colors"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => doLogin('00000', '00000')}
            disabled={loading}
            className="w-full mt-3 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 text-sm py-2 rounded-lg border border-slate-700 transition-colors"
          >
            Accès invité rapide
          </button>

          <p className="text-center text-slate-600 text-xs mt-4">
            Accès réservé au personnel autorisé
          </p>

          <AppDownloadQR />
        </div>

        {showDemoPanel && (
          <div className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-amber-400/80 uppercase tracking-wide mb-3">Accès rapide — démonstration</p>
            <div className="space-y-1.5 max-h-[60vh] lg:max-h-[70vh] overflow-y-auto">
              {demoUsers!.map((u) => (
                <button
                  key={u.matricule}
                  onClick={() => quickLogin(u)}
                  disabled={loading}
                  className="w-full flex items-center justify-between gap-2 bg-slate-800 hover:bg-slate-700 rounded-lg px-3 py-2 text-left transition-colors disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-white truncate">{u.prenom} {u.nom}</span>
                    <span className="block text-xs text-slate-500">{ROLE_LABELS[u.role]}</span>
                  </span>
                  <span className="text-[10px] font-mono text-amber-400 flex-shrink-0">{u.matricule}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
