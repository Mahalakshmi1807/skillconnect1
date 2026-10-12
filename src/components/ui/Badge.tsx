import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'purple';
}

const variants: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
  gray: 'bg-gray-100 text-gray-600',
  purple: 'bg-purple-100 text-purple-700',
};

export function Badge({ children, variant = 'gray' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'gray'> = {
    pending: 'yellow',
    accepted: 'green',
    rejected: 'red',
    completed: 'blue',
    cancelled: 'gray',
    'in_progress': 'yellow',
    Scheduled: 'blue',
    'In Progress': 'yellow',
    Done: 'green',
    Cancelled: 'gray',
  };
  const display = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant={map[status] ?? 'gray'}>{display}</Badge>;
}
