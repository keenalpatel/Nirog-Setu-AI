'use client';

import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    label?: string;
  };
  icon: LucideIcon;
  color?: 'primary' | 'secondary' | 'destructive' | 'warning' | 'success';
  description?: string;
}

const colorStyles = {
  primary: {
    bg: 'bg-indigo-500/10',
    icon: 'text-indigo-400',
    bar: 'from-indigo-500 to-purple-500',
  },
  secondary: {
    bg: 'bg-blue-500/10',
    icon: 'text-blue-400',
    bar: 'from-blue-500 to-cyan-500',
  },
  destructive: {
    bg: 'bg-red-500/10',
    icon: 'text-red-400',
    bar: 'from-red-500 to-orange-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    icon: 'text-amber-400',
    bar: 'from-amber-500 to-yellow-500',
  },
  success: {
    bg: 'bg-emerald-500/10',
    icon: 'text-emerald-400',
    bar: 'from-emerald-500 to-teal-500',
  },
};

export function KPICard({
  title,
  value,
  change,
  icon: Icon,
  color = 'primary',
  description,
}: KPICardProps) {
  const styles = colorStyles[color];

  return (
    <div className="glass-card rounded-2xl p-6 transition-all hover:scale-[1.02] glow-card">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('rounded-xl p-3', styles.bg)}>
          <Icon className={cn('h-6 w-6', styles.icon)} />
        </div>
        {change && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-medium',
              change.value >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            <span>{change.value >= 0 ? '+' : ''}{change.value}%</span>
            {change.label && (
              <span className="text-gray-500 font-normal">{change.label}</span>
            )}
          </div>
        )}
      </div>
      <div className="mt-2">
        <h3 className="text-4xl font-bold tracking-tight stat-number font-display">{value}</h3>
        <p className="text-sm text-gray-400 mt-2">{title}</p>
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </div>
      <div className="mt-4 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className={cn('h-full bg-gradient-to-r rounded-full', styles.bar)} style={{ width: '70%' }} />
      </div>
    </div>
  );
}

interface KPICardGridProps {
  children: React.ReactNode;
}

export function KPICardGrid({ children }: KPICardGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {children}
    </div>
  );
}
