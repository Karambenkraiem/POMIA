import { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 md:px-6 md:py-4 border-b border-slate-800 bg-slate-900/50">
      <div className="min-w-0">
        <h1 className="text-base md:text-lg font-semibold text-white leading-tight">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-slate-400 mt-0.5 leading-tight">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
