import { BarChart3 } from 'lucide-react';
import PageHeader from '../components/PageHeader';

export default function Statistique() {
  return (
    <div>
      <PageHeader title="Statistique" subtitle="Indicateurs et statistiques de la centrale" />
      <div className="p-3 sm:p-6">
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-10 text-center">
          <BarChart3 className="mx-auto mb-3 text-slate-600" size={32} />
          <p className="text-slate-300 font-medium">Page en construction</p>
          <p className="text-slate-500 text-sm mt-1">Cette section sera bientôt disponible.</p>
        </div>
      </div>
    </div>
  );
}
