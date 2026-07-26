'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Brain, Heart, MapPin, Pill, CheckCircle2, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AgentStatusCard } from '@/components/agents/agent-status-card';
import { createClient } from '@supabase/supabase-js';

// Clean execution initializing using public keys safely matching your local environment
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

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
  
  const [metrics, setMetrics] = useState({ totalRuns: 0, successRate: 100, recentActivity: [] as any[] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config) return;

    async function fetchAgentTelemetry() {
      try {
        // Query your screenings layout matching the active agent parameters
        const { data, error } = await supabase
          .from('screenings')
          .select('*')
          .eq('agent_type', agentId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          const successfulRuns = data.filter(item => item.status === 'completed').length;
          const calculatedRate = data.length > 0 ? Math.round((successfulRuns / data.length) * 100) : 100;
          
          setMetrics({
            totalRuns: data.length,
            successRate: calculatedRate,
            recentActivity: data.slice(0, 5)
          });
        }
      } catch (err) {
        console.error('Telemetry fetch failure:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAgentTelemetry();
  }, [agentId, config]);

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
      {/* Header Visual Matrix */}
      <div className="flex items-center gap-4">
        <div className={`h-16 w-16 rounded-2xl bg-${config.color}-500/10 flex items-center justify-center`}>
          <IconComponent className={`h-8 w-8 text-${config.color}-500`} />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{config.name}</h1>
          <p className="text-muted-foreground">{config.description}</p>
        </div>
      </div>

      {/* Dynamic Status Tracking Block */}
      <AgentStatusCard
        agent={agentId as any}
        status="active"
        lastUsed={metrics.recentActivity.length > 0 ? "Just now" : "No recent runs"}
        totalRuns={metrics.totalRuns}
        successRate={metrics.successRate}
        currentTask={loading ? "Loading telemetry..." : "Awaiting triage event stream..."}
      />

      {/* Capabilities Layout */}
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

      {/* Recent Activity Engine */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
          <CardDescription>Live actions pulled directly from Supabase logs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metrics.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground p-3">No evaluations processed yet by this agent core.</p>
            ) : (
              metrics.recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-sm">
                      Screening processed: <strong>{activity.diagnosis || 'Undetermined'}</strong> ({activity.severity})
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}