import { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  color?: 'amber' | 'green' | 'red' | 'blue' | 'slate';
  sub?: string;
}

const colorMap = {
  amber: 'text-amber-400',
  green: 'text-green-400',
  red: 'text-red-400',
  blue: 'text-blue-400',
  slate: 'text-slate-300',
};

export default function StatCard({ label, value, unit, icon, color = 'amber', sub }: Props) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${colorMap[color]}`}>
            {value}
            {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
          </p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
    </div>
  );
}
