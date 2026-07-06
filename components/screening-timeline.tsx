'use client';

import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, Brain, Heart, MapPin, Pill } from 'lucide-react';
import type { AgentHandoff } from '@/lib/types';

interface ScreeningTimelineProps {
  steps: AgentHandoff[];
  compact?: boolean;
}

const agentIcons = {
  triage: Activity,
  diagnose: Brain,
  prescribe: Pill,
  refer: MapPin,
  asha: Heart,
  emergency: AlertTriangle,
};

const agentColors = {
  triage: {
    bg: 'bg-emerald-500',
    border: 'border-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  diagnose: {
    bg: 'bg-blue-500',
    border: 'border-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
  },
  prescribe: {
    bg: 'bg-purple-500',
    border: 'border-purple-500',
    text: 'text-purple-600 dark:text-purple-400',
  },
  refer: {
    bg: 'bg-amber-500',
    border: 'border-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
  asha: {
    bg: 'bg-rose-500',
    border: 'border-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
  },
  emergency: {
    bg: 'bg-red-500',
    border: 'border-red-500',
    text: 'text-red-600 dark:text-red-400',
  },
};

export function ScreeningTimeline({ steps, compact = false }: ScreeningTimelineProps) {
  return (
    <div className={cn('relative', !compact && 'pl-8')}>
      {!compact && (
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />
      )}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const agentType = step.agent.toLowerCase() as keyof typeof agentIcons;
          const Icon = agentIcons[agentType] || Activity;
          const colors = agentColors[agentType] || agentColors.triage;

          return (
            <div key={index} className="relative flex gap-4">
              {!compact && (
                <div className="absolute -left-8 mt-1">
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-white',
                      colors.bg
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                </div>
              )}
              <div className="flex-1 rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {compact && (
                      <Icon className={cn('h-4 w-4', colors.text)} />
                    )}
                    <span className={cn('font-medium capitalize', !compact && colors.text)}>
                      {step.agent}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{step.timestamp}</span>
                </div>
                <div className="mt-2 space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Input: </span>
                    <span>{step.input}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Output: </span>
                    <span className="font-medium">{step.output}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
