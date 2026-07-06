'use client';

import { Activity, AlertTriangle, Brain, Heart, MapPin, Pill, CheckCircle2, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AgentStatusCard } from '@/components/agents/agent-status-card';
import { use } from 'react';

const agentConfig: Record<string, { name: string; description: string; icon: typeof Activity; color: string; capabilities: string[] }> = {
  triage: {
    name: 'Triage Agent',
    description: 'First point of contact - classifies severity and routes to appropriate agent',
    icon: Activity,
    color: 'emerald',
    capabilities: [
      'Natural language symptom understanding',
      'Severity classification (low/medium/high/critical)',
      'Patient priority queuing',
      'Agent routing decisions',
      'Follow-up scheduling',
    ],
  },
  diagnose: {
    name: 'Diagnose Agent',
    description: 'AI-powered differential diagnosis using WHO/ICMR guidelines',
    icon: Brain,
    color: 'blue',
    capabilities: [
      'Symptom-pattern matching from medical KB',
      'Image analysis (X-rays, skin lesions)',
      'Confidence-scored differential diagnosis',
      'Risk factor assessment',
      'Test recommendations',
    ],
  },
  prescribe: {
    name: 'Prescribe Agent',
    description: 'Treatment protocols based on standard guidelines',
    icon: Pill,
    color: 'purple',
    capabilities: [
      'WHO Essential Medicines protocols',
      'ICMR treatment guidelines',
      'Drug interaction checking',
      'Dosage calculations',
      'DOTS therapy scheduling',
    ],
  },
  refer: {
    name: 'Refer Agent',
    description: 'Hospital finder with real-time bed availability',
    icon: MapPin,
    color: 'amber',
    capabilities: [
      'Geographic hospital search',
      'Real-time bed availability',
      'Specialty matching',
      'Appointment scheduling',
      'Emergency referral protocol',
    ],
  },
  asha: {
    name: 'ASHA Agent',
    description: 'Coordination with community health workers',
    icon: Heart,
    color: 'rose',
    capabilities: [
      'ASHA worker assignment',
      'Push notifications',
      'Visit scheduling',
      'Medication reminders',
      'Family counseling coordination',
    ],
  },
  emergency: {
    name: 'Emergency Agent',
    description: 'SOS response and ambulance coordination',
    icon: AlertTriangle,
    color: 'red',
    capabilities: [
      'SOS signal detection',
      'Automated ambulance dispatch',
      'Hospital pre-alert',
      'Police coordination for traffic',
      'Family notification',
    ],
  },
};

export default function AgentDetailPage({ params }: { params: { agent: string } }) {
  const agentId = params.agent;
  const config = agentConfig[agentId];

  if (!config) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Agent not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const IconComponent = config.icon;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className={`h-16 w-16 rounded-2xl bg-${config.color}-500/10 flex items-center justify-center`}>
          <IconComponent className={`h-8 w-8 text-${config.color}-500`} />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{config.name}</h1>
          <p className="text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Status Card */}
      <AgentStatusCard
        agent={agentId as any}
        status="active"
        lastUsed="1m ago"
        totalRuns={Math.floor(Math.random() * 10000 + 5000)}
        successRate={Math.floor(Math.random() * 10 + 90)}
        currentTask="Processing patient query..."
      />

      {/* Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Capabilities
          </CardTitle>
          <CardDescription>What this agent can do</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {config.capabilities.map((cap, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 className={`h-5 w-5 mt-0.5 text-${config.color}-500`} />
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
          <CardDescription>Last 10 actions performed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm">Patient screening processed</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.floor(Math.random() * 20 + 1)}m ago
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
