import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return { toast, toasts, dismiss };
}

const config: Record<ToastType, { icon: typeof CheckCircle2; bg: string; text: string }> = {
  success: { icon: CheckCircle2, bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
  error: { icon: XCircle, bg: 'bg-red-50 border-red-200', text: 'text-red-700' },
  warning: { icon: AlertCircle, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  info: { icon: Info, bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
};

export function ToastContainer({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const { icon: Icon, bg, text } = config[t.type];
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 rounded-xl border ${bg} ${text} px-4 py-3 shadow-lg animate-slideInRight`}
          >
            <Icon size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// Singleton toast for global access
let externalToast: ((type: ToastType, message: string) => void) | null = null;

export function setToastHandler(fn: (type: ToastType, message: string) => void) {
  externalToast = fn;
}

export function toast(type: ToastType, message: string) {
  if (externalToast) externalToast(type, message);
}

// Component that hooks into the singleton
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toast: toastFn, toasts, dismiss } = useToast();

  useEffect(() => {
    setToastHandler(toastFn);
  }, [toastFn]);

  return (
    <>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </>
  );
}
