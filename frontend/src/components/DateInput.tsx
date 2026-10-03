import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, CalendarCheck } from 'lucide-react';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  markedDates?: string[];
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const POPUP_WIDTH = 256; // w-64
const POPUP_HEIGHT = 300; // hauteur approximative du calendrier
const MARGIN = 8;

export default function DateInput({ value, onChange, className, markedDates }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : new Date();
  const [viewMonth, setViewMonth] = useState(startOfMonth(selected));
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setViewMonth(startOfMonth(selected));
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const dropUp = rect.bottom + POPUP_HEIGHT > window.innerHeight && rect.top > POPUP_HEIGHT;
      const left = Math.max(MARGIN, Math.min(rect.right - POPUP_WIDTH, window.innerWidth - POPUP_WIDTH - MARGIN));
      const top = dropUp ? rect.top - POPUP_HEIGHT - 4 : rect.bottom + 4;
      setCoords({ top, left });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        (!popupRef.current || !popupRef.current.contains(target))
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  const pick = (d: Date) => {
    onChange(format(d, 'yyyy-MM-dd'));
    setOpen(false);
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isViewingToday = value === todayStr;

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={
            className ||
            'flex items-center gap-2 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-white text-sm hover:border-slate-500 focus:outline-none focus:border-amber-500 transition-colors'
          }
        >
          <Calendar size={15} className="text-slate-400" />
          {format(selected, 'dd/MM/yyyy')}
        </button>

        {open && coords && createPortal(
        <div
          ref={popupRef}
          style={{ top: coords.top, left: coords.left, width: POPUP_WIDTH }}
          className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl"
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-white font-medium capitalize">
              {format(viewMonth, 'MMMM yyyy', { locale: fr })}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-500 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const inMonth = isSameMonth(d, viewMonth);
              const isSelected = isSameDay(d, selected);
              const isToday = isSameDay(d, new Date());
              const hasEssai = markedDates?.includes(format(d, 'yyyy-MM-dd'));
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => pick(d)}
                  title={hasEssai ? 'Essai ce jour-là' : undefined}
                  className={`relative text-xs rounded py-1 transition-colors ${
                    isSelected
                      ? 'bg-amber-500 text-slate-900 font-semibold'
                      : isToday
                        ? 'text-amber-400 border border-amber-500/40'
                        : inMonth
                          ? 'text-slate-300 hover:bg-slate-700'
                          : 'text-slate-600 hover:bg-slate-700'
                  }`}
                >
                  {format(d, 'd')}
                  {hasEssai && (
                    <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                      isSelected ? 'bg-slate-900' : 'bg-cyan-400'
                    }`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange(todayStr)}
        disabled={isViewingToday}
        title="Revenir à aujourd'hui"
        className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-600 text-slate-400 hover:text-amber-400 hover:border-amber-500/50 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-slate-600 transition-colors flex-shrink-0"
      >
        <CalendarCheck size={15} />
      </button>
    </div>
  );
}
