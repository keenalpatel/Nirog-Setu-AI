'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Heart, Phone, MapPin, CheckCircle2, Clock, User, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import type { ASHAWorker } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function ASHAWorkersPage() {
  const [workers, setWorkers] = useState<ASHAWorker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('asha_workers')
      .select('*')
      .order('active_cases', { ascending: false });

    if (!error && data) {
      setWorkers(data);
    }
    setLoading(false);
  };

  const totalWorkers = workers.length;
  const activeWorkers = workers.filter((w) => w.status === 'active').length;
  const totalCases = workers.reduce((acc, w) => acc + w.active_cases, 0);
  const totalVisits = workers.reduce((acc, w) => acc + w.total_visits, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Heart className="h-8 w-8 text-primary" />
          ASHA Workers
        </h1>
        <p className="text-muted-foreground">
          Community health worker coordination center
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalWorkers}</div>
            <p className="text-sm text-muted-foreground">Total Workers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">{activeWorkers}</div>
            <p className="text-sm text-muted-foreground">Active Now</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalCases}</div>
            <p className="text-sm text-muted-foreground">Active Cases</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{totalVisits.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Total Home Visits</p>
          </CardContent>
        </Card>
      </div>

      {/* Workers List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48" />
            </Card>
          ))
        ) : (
          workers.map((worker) => (
            <Card key={worker.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-rose-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{worker.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {worker.assigned_area}, {worker.assigned_district}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={worker.status === 'active' ? 'default' : 'secondary'}
                    className={worker.status === 'active' ? 'bg-emerald-500' : ''}
                  >
                    {worker.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Phone */}
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{worker.phone}</span>
                  <a href={`tel:${worker.phone}`} className="ml-auto text-primary hover:underline">
                    Call
                  </a>
                </div>

                {/* Active Cases */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active Cases</span>
                    <span className="font-medium">{worker.active_cases}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min((worker.active_cases / 15) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="p-2 rounded-lg bg-muted text-center">
                    <p className="text-lg font-bold">{worker.total_visits}</p>
                    <p className="text-xs text-muted-foreground">Total Visits</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted text-center">
                    <p className="text-lg font-bold flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {Math.round((worker.total_visits / 30) * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Completion Rate</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Phone className="h-4 w-4 mr-1" />
                    Contact
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Assign Case
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
