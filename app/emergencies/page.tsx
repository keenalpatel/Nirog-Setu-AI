'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Ambulance,
  Building2,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import type { Emergency } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusColors = {
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500' },
  dispatched: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500' },
  in_transit: { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500' },
  resolved: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500' },
  cancelled: { bg: 'bg-gray-500/10', text: 'text-gray-600', border: 'border-gray-500' },
};

const severityColors = {
  low: 'bg-emerald-500 text-white',
  medium: 'bg-amber-500 text-white',
  high: 'bg-orange-500 text-white',
  critical: 'bg-destructive text-white animate-pulse',
};

export default function EmergenciesPage() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchEmergencies();

    // Subscribe to new emergencies
    const channel = supabase
      .channel('emergencies-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emergencies' },
        (payload) => {
          setEmergencies((prev) => [payload.new as Emergency, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'emergencies' },
        (payload) => {
          setEmergencies((prev) =>
            prev.map((e) => (e.id === payload.new.id ? (payload.new as Emergency) : e))
          );
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const fetchEmergencies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('emergencies')
      .select('*, patient:patients(*), hospital:hospitals(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setEmergencies(data);
    }
    setLoading(false);
  };

  const handleStatusUpdate = async (id: string, newStatus: Emergency['status']) => {
    const updates: Partial<Emergency> = { status: newStatus };
    if (newStatus === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }
    if (newStatus === 'dispatched') {
      updates.ambulance_dispatched = true;
      updates.ambulance_eta_minutes = Math.floor(Math.random() * 15 + 10);
    }

    await supabase
      .from('emergencies')
      .update(updates)
      .eq('id', id);
  };

  const filteredEmergencies = emergencies.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'active') return !['resolved', 'cancelled'].includes(e.status);
    return e.status === filter;
  });

  const activeCount = emergencies.filter((e) => !['resolved', 'cancelled'].includes(e.status)).length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            Emergency Response Center
          </h1>
          <p className="text-muted-foreground">
            Real-time emergency monitoring and dispatch
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
              </span>
              <span className="font-medium">{activeCount} Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'active', 'pending', 'dispatched', 'in_transit', 'resolved'].map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {/* Emergency Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48" />
            </Card>
          ))
        ) : filteredEmergencies.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <CheckCircle2 className="h-16 w-16 mx-auto text-success mb-4" />
            <p className="text-lg font-medium">No emergencies</p>
            <p className="text-muted-foreground">All cases have been resolved</p>
          </div>
        ) : (
          filteredEmergencies.map((emergency) => {
            const statusStyle = statusColors[emergency.status as keyof typeof statusColors];
            return (
              <Card
                key={emergency.id}
                className={cn(
                  'overflow-hidden transition-all hover:shadow-lg',
                  emergency.status !== 'resolved' && 'border-l-4',
                  emergency.status === 'pending' && 'border-l-amber-500',
                  emergency.status === 'dispatched' && 'border-l-blue-500',
                  emergency.status === 'in_transit' && 'border-l-purple-500'
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <Badge className={cn(severityColors[emergency.severity as keyof typeof severityColors])}>
                      {emergency.severity}
                    </Badge>
                    <Badge variant="outline" className={cn(statusStyle.bg, statusStyle.text)}>
                      {emergency.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <CardTitle className="text-base mt-2 line-clamp-2">
                    {emergency.symptoms}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(emergency.created_at), 'MMM d, h:mm a')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Patient Info */}
                  {emergency.patient && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{emergency.patient.name}</span>
                      {emergency.patient.phone && (
                        <a
                          href={`tel:${emergency.patient.phone}`}
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          Call
                        </a>
                      )}
                    </div>
                  )}

                  {/* Location */}
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{emergency.location_address}</span>
                  </div>

                  {/* Hospital */}
                  {emergency.hospital && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{emergency.hospital.name}</span>
                    </div>
                  )}

                  {/* Ambulance Info */}
                  {emergency.ambulance_dispatched && (
                    <div className="flex items-center gap-2 text-sm">
                      <Ambulance className="h-4 w-4 text-blue-500" />
                      <span>
                        Ambulance dispatched
                        {emergency.ambulance_eta_minutes && (
                          <span className="text-muted-foreground"> (ETA: {emergency.ambulance_eta_minutes}m)</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {emergency.status === 'pending' && (
                    <Button
                      className="w-full"
                      onClick={() => handleStatusUpdate(emergency.id, 'dispatched')}
                    >
                      <Ambulance className="h-4 w-4 mr-2" />
                      Dispatch Ambulance
                    </Button>
                  )}
                  {emergency.status === 'dispatched' && (
                    <Button
                      className="w-full"
                      variant="secondary"
                      onClick={() => handleStatusUpdate(emergency.id, 'in_transit')}
                    >
                      Mark In Transit
                    </Button>
                  )}
                  {emergency.status === 'in_transit' && (
                    <Button
                      className="w-full"
                      variant="default"
                      onClick={() => handleStatusUpdate(emergency.id, 'resolved')}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Resolved
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
