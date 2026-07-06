'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Heart,
  Stethoscope,
  TrendingUp,
  Users,
  Phone,
  Shield,
} from 'lucide-react';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { KPICard, KPICardGrid } from '@/components/dashboard/kpi-cards';
import { AgentStatusCard, AgentStatusGrid } from '@/components/agents/agent-status-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import type { DashboardStats, Screening, Emergency } from '@/lib/types';

const COLORS = ['#6366f1', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981', '#ec4899'];

export default function OverviewPage() {
  const [recentScreenings, setRecentScreenings] = useState<Screening[]>([]);
  const [recentEmergencies, setRecentEmergencies] = useState<Emergency[]>([]);

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await fetch('/api/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json() as Promise<DashboardStats>;
    },
  });

  // Seed data on first load
  useEffect(() => {
    const seedData = async () => {
      try {
        const response = await fetch('/api/seed', { method: 'POST' });
        const data = await response.json();
        console.log('Seed result:', data);
      } catch (error) {
        console.error('Seed error:', error);
      }
    };
    seedData();
  }, []);

  // Fetch recent screenings
  useEffect(() => {
    const fetchRecent = async () => {
      const { data: screenings } = await supabase
        .from('screenings')
        .select('*, patient:patients(*)')
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentScreenings(screenings || []);

      const { data: emergencies } = await supabase
        .from('emergencies')
        .select('*, patient:patients(*)')
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentEmergencies(emergencies || []);
    };
    fetchRecent();

    // Subscribe to new screenings
    const channel = supabase
      .channel('screenings-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'screenings' },
        (payload) => {
          setRecentScreenings((prev) => [payload.new as Screening, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text neon-glow">Nirog-Setu AI Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Real-time healthcare analytics for rural India
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass flex items-center gap-2 px-3 py-1.5 rounded-full text-emerald-400">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium">System Online</span>
          </div>
          <Badge variant="outline" className="gap-1 border-indigo-500/30 text-indigo-400">
            <Phone className="h-3 w-3" />
            WhatsApp Connected
          </Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICardGrid>
        <KPICard
          title="Total Screenings"
          value={stats?.total_screenings?.toLocaleString() || 0}
          change={{ value: 12, label: 'vs last week' }}
          icon={Stethoscope}
          color="primary"
        />
        <KPICard
          title="TB Detections"
          value={stats?.tb_detections || 0}
          change={{ value: 8, label: 'vs last week' }}
          icon={Activity}
          color="secondary"
          description="Early detection saves lives"
        />
        <KPICard
          title="Emergencies Handled"
          value={stats?.emergencies_handled || 0}
          change={{ value: 15, label: 'vs last week' }}
          icon={AlertTriangle}
          color="destructive"
        />
        <KPICard
          title="ASHA Workers Active"
          value={stats?.asha_workers_active || 0}
          icon={Users}
          color="success"
        />
      </KPICardGrid>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Screenings Trend */}
        <Card className="col-span-2 glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-400" />
              Screenings Trend
            </CardTitle>
            <CardDescription className="text-gray-500">Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.screenings_trend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    className="text-xs"
                    stroke="rgba(255,255,255,0.3)"
                  />
                  <YAxis className="text-xs" stroke="rgba(255,255,255,0.3)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(10, 10, 10, 0.9)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: '0.5rem',
                      color: '#fff',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Agent Distribution */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-white">Agent Distribution</CardTitle>
            <CardDescription className="text-gray-500">Screenings by agent type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.agent_distribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="agent"
                    label={({ agent, percentage }) => `${agent}: ${percentage}%`}
                    labelLine={false}
                    fill="#6366f1"
                  >
                    {(stats?.agent_distribution || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(10, 10, 10, 0.9)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: '0.5rem',
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agents Status Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">AI Agents Status</h2>
        <AgentStatusGrid>
          <AgentStatusCard
            agent="triage"
            status="active"
            lastUsed="2m ago"
            totalRuns={15420}
            successRate={98}
            currentTask="Analyzing patient symptoms..."
          />
          <AgentStatusCard
            agent="diagnose"
            status="active"
            lastUsed="5m ago"
            totalRuns={12380}
            successRate={94}
            currentTask="TB diagnosis with X-ray analysis"
          />
          <AgentStatusCard
            agent="emergency"
            status="active"
            lastUsed="1m ago"
            totalRuns={892}
            successRate={99}
            currentTask="Dispatching ambulance to Patna"
          />
          <AgentStatusCard
            agent="refer"
            status="idle"
            lastUsed="15m ago"
            totalRuns={8920}
            successRate={96}
          />
          <AgentStatusCard
            agent="asha"
            status="active"
            lastUsed="8m ago"
            totalRuns={11200}
            successRate={97}
            currentTask="Notifying ASHA worker for follow-up"
          />
          <AgentStatusCard
            agent="prescribe"
            status="idle"
            lastUsed="20m ago"
            totalRuns={7650}
            successRate={93}
          />
        </AgentStatusGrid>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Screenings */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">Recent Screenings</CardTitle>
              <CardDescription className="text-gray-500">Latest patient interactions</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/screenings">View All</a>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentScreenings.length === 0 ? (
                <p className="text-muted-foreground text-sm">No recent screenings</p>
              ) : (
                recentScreenings.slice(0, 5).map((screening) => (
                  <div
                    key={screening.id}
                    className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-white">{screening.symptoms}</p>
                      <p className="text-sm text-gray-400 truncate">
                        {screening.diagnosis}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          screening.severity === 'critical'
                            ? 'destructive'
                            : screening.severity === 'high'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {screening.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {screening.agent_type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active Emergencies */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-white">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                Active Emergencies
              </CardTitle>
              <CardDescription className="text-gray-500">Requiring immediate attention</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/emergencies">View All</a>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentEmergencies.filter((e) => e.status !== 'resolved').length === 0 ? (
                <div className="text-center py-4">
                  <Shield className="h-8 w-8 mx-auto text-success mb-2" />
                  <p className="text-sm text-muted-foreground">No active emergencies</p>
                </div>
              ) : (
                recentEmergencies
                  .filter((e) => e.status !== 'resolved')
                  .slice(0, 5)
                  .map((emergency) => (
                    <div
                      key={emergency.id}
                      className="flex items-center gap-4 rounded-lg border border-destructive/50 bg-destructive/5 p-3"
                    >
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-destructive animate-ping opacity-50" />
                        <AlertTriangle className="relative h-5 w-5 text-destructive" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{emergency.symptoms}</p>
                        <p className="text-sm text-muted-foreground">
                          {emergency.location_address}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="destructive" className="animate-pulse">
                          {emergency.status}
                        </Badge>
                        {emergency.ambulance_eta_minutes && (
                          <span className="text-xs">
                            ETA: {emergency.ambulance_eta_minutes}m
                          </span>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
