import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, ReactNode } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SelectedDateProvider } from './contexts/SelectedDateContext';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-300 gap-4">
        <p className="text-red-400 font-semibold">Erreur inattendue</p>
        <p className="text-sm text-slate-500">{(this.state.error as Error).message}</p>
        <button onClick={() => this.setState({ error: null })} className="text-xs text-amber-400 underline">Réessayer</button>
      </div>
    );
    return this.props.children;
  }
}
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Journee from './pages/Journee';
import RelevesChefBloc from './pages/RelevesChefBloc';
import RelevesOperateur from './pages/RelevesOperateur';
import Manouvres from './pages/Manouvres';
import Alarmes from './pages/Alarmes';
import OrdresTravaux from './pages/OrdresTravaux';
import MaterielsDefectueux from './pages/MaterielsDefectueux';
import RelevesDuJour from './pages/RelevesDuJour';
import Rapport from './pages/Rapport';
import Profil from './pages/Profil';
import Users from './pages/admin/Users';
import Seuils from './pages/admin/Seuils';
import ActivityLogs from './pages/admin/ActivityLogs';
import AnalyseDiagnostic from './pages/AnalyseDiagnostic';
import RechercheManoeuvres from './pages/RechercheManoeuvres';
import Statistique from './pages/Statistique';
import Essai from './pages/Essai';
import EssaiHistorique from './pages/EssaiHistorique';
import EssaisConfig from './pages/admin/EssaisConfig';
import Consignes from './pages/Consignes';
import Reclamations from './pages/Reclamations';
import ReclamationDetail from './pages/ReclamationDetail';
import InstallPrompt from './components/InstallPrompt';
import AndroidBackButton from './components/AndroidBackButton';
import UpdateBanner from './components/UpdateBanner';
import InactivityLogout from './components/InactivityLogout';
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchInterval: 30_000 } },
});

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user || !['admin', 'chef_exploitation'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AnalyseRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user || !['chef_quart', 'chef_exploitation', 'directeur', 'admin'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function StatistiqueRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user || !['statistique', 'admin'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function ConsigneRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user || !['operateur', 'chef_bloc', 'chef_quart', 'chef_exploitation', 'chef_centrale', 'admin'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function ReclamationRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user || user.role === 'guest') {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <AuthProvider>
      <SelectedDateProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="journee" element={<Journee />} />
              <Route path="releves-bloc" element={<RelevesChefBloc />} />
              <Route path="releves-op" element={<RelevesOperateur />} />
              <Route path="manouvres" element={<Manouvres />} />
              <Route path="alarmes" element={<Alarmes />} />
              <Route path="ordres-travaux" element={<OrdresTravaux />} />
              <Route path="defauts" element={<MaterielsDefectueux />} />
              <Route path="releves-jour" element={<RelevesDuJour />} />
              <Route path="rapport" element={<Rapport />} />
              <Route path="profil" element={<Profil />} />
              <Route path="admin/users" element={<AdminRoute><Users /></AdminRoute>} />
              <Route path="admin/seuils" element={<AdminRoute><Seuils /></AdminRoute>} />
              <Route path="admin/logs" element={<AdminRoute><ActivityLogs /></AdminRoute>} />
              <Route path="analyse" element={<AnalyseRoute><AnalyseDiagnostic /></AnalyseRoute>} />
              <Route path="analyse/recherche" element={<AnalyseRoute><RechercheManoeuvres /></AnalyseRoute>} />
              <Route path="statistique" element={<StatistiqueRoute><Statistique /></StatistiqueRoute>} />
              <Route path="essai" element={<Essai />} />
              <Route path="essai/:essaiId" element={<EssaiHistorique />} />
              <Route path="admin/essais" element={<AdminRoute><EssaisConfig /></AdminRoute>} />
              <Route path="consignes" element={<ConsigneRoute><Consignes /></ConsigneRoute>} />
              <Route path="reclamations" element={<ReclamationRoute><Reclamations /></ReclamationRoute>} />
              <Route path="reclamations/:id" element={<ReclamationRoute><ReclamationDetail /></ReclamationRoute>} />
            </Route>
          </Routes>
          <InstallPrompt />
          <AndroidBackButton />
          <UpdateBanner />
          <InactivityLogout />
        </BrowserRouter>
      </SelectedDateProvider>
      </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
