import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error';

interface ToastState {
  message: string;
  type: ToastType;
  id: number;
}

let _counter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++_counter;
    setToasts(prev => [...prev, { message, type, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}

export function ToastContainer({ toasts, dismiss }: {
  toasts: ReturnType<typeof useToast>['toasts'];
  dismiss: (id: number) => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => setVisible(false), 3000);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, []);

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      } ${
        isSuccess
          ? 'bg-green-900/90 border-green-500/40 text-green-300'
          : 'bg-red-900/90 border-red-500/40 text-red-300'
      }`}
    >
      {isSuccess
        ? <CheckCircle size={16} className="flex-shrink-0 text-green-400" />
        : <XCircle size={16} className="flex-shrink-0 text-red-400" />}
      <span>{toast.message}</span>
      <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
        <X size={13} />
      </button>
    </div>
  );
}
