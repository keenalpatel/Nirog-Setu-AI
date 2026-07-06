'use client';

import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, Brain, Heart, MapPin, Pill, Shield } from 'lucide-react';
import type { AgentType } from '@/lib/types';

interface AgentStatusCardProps {
  agent: AgentType;
  status: 'active' | 'idle' | 'error';
  lastUsed: string;
  totalRuns: number;
  successRate: number;
  currentTask?: string;
}

const agentConfig = {
  triage: {
    name: 'Triage Agent',
    description: 'Classifies severity and routes patients',
    icon: Activity,
    color: 'emerald',
  },
  diagnose: {
    name: 'Diagnose Agent',
    description: 'Provides differential diagnosis with confidence',
    icon: Brain,
    color: 'blue',
  },
  prescribe: {
    name: 'Prescribe Agent',
    description: 'Suggests treatment based on ICMR guidelines',
    icon: Pill,
    color: 'purple',
  },
  refer: {
    name: 'Refer Agent',
    description: 'Finds nearest hospitals with bed availability',
    icon: MapPin,
    color: 'amber',
  },
  asha: {
    name: 'ASHA Agent',
    description: 'Notifies and coordinates with ASHA workers',
    icon: Heart,
    color: 'rose',
  },
  emergency: {
    name: 'Emergency Agent',
    description: 'Triggers SOS and ambulance dispatch',
    icon: AlertTriangle,
    color: 'red',
  },
};

const statusColors = {
  active: {
    bg: 'bg-emerald-500/10',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  idle: {
    bg: 'bg-slate-500/10',
    dot: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
  },
  error: {
    bg: 'bg-destructive/10',
    dot: 'bg-destructive',
    text: 'text-destructive',
  },
};

export function AgentStatusCard({
  agent,
  status,
  lastUsed,
  totalRuns,
  successRate,
  currentTask,
}: AgentStatusCardProps) {
  const config = agentConfig[agent];
  const StatusIcon = config.icon;
  const statusStyle = statusColors[status];

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={cn('rounded-lg p-2.5', statusStyle.bg)}>
          <StatusIcon className={cn('h-5 w-5', statusStyle.text)} />
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-medium', statusStyle.text)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
          <div className="relative flex h-2 w-2">
            {status === 'active' && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            )}
            <span className={cn('relative inline-flex rounded-full h-2 w-2', statusStyle.dot)} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="font-semibold">{config.name}</h3>
        <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
      </div>

      {currentTask && status === 'active' && (
        <div className="mt-3 p-2 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground">Current task:</p>
          <p className="text-sm font-medium truncate">{currentTask}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-lg font-semibold">{totalRuns.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Runs</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-lg font-semibold">{successRate}%</p>
          <p className="text-xs text-muted-foreground">Success</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-2">
          <p className="text-xs font-medium">{lastUsed}</p>
          <p className="text-xs text-muted-foreground">Last Used</p>
        </div>
      </div>
    </div>
  );
}

export function AgentStatusGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}
