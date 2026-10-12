import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 size={size} className="animate-spin text-emerald-500" />
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
      <Loader2 size={40} className="animate-spin text-emerald-500" />
      <p className="text-sm text-gray-500">Loading...</p>
    </div>
  );
}

export function EmptyState({ icon, title, message }: { icon?: React.ReactNode; title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-3 text-gray-300">{icon}</div>}
      <h3 className="text-base font-medium text-gray-600">{title}</h3>
      {message && <p className="mt-1 text-sm text-gray-400 max-w-sm">{message}</p>}
    </div>
  );
}
