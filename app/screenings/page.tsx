'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Download, Filter, Stethoscope, Search, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScreeningTimeline } from '@/components/screening-timeline';
import { supabase } from '@/lib/supabase';
import type { Screening } from '@/lib/types';
import { timeAgo } from '@/lib/mock-data';

const severityColors = {
  low: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20',
  high: 'bg-orange-500/10 text-orange-600 hover:bg-orange-500/20',
  critical: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
};

export default function ScreeningsPage() {
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScreening, setSelectedScreening] = useState<Screening | null>(null);
  const [filters, setFilters] = useState({
    severity: 'all',
    agent_type: 'all',
    search: '',
  });

  useEffect(() => {
    fetchScreenings();
  }, [filters]);

  const fetchScreenings = async () => {
    setLoading(true);
    let query = supabase
      .from('screenings')
      .select('*, patient:patients(*)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (filters.severity && filters.severity !== 'all') {
      query = query.eq('severity', filters.severity);
    }
    if (filters.agent_type && filters.agent_type !== 'all') {
      query = query.eq('agent_type', filters.agent_type);
    }

    const { data, error } = await query;
    if (!error && data) {
      setScreenings(data);
    }
    setLoading(false);
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Patient', 'Symptoms', 'Diagnosis', 'Agent', 'Severity', 'Date'];
    const rows = screenings.map((s) => [
      s.id,
      s.patient?.name || 'Unknown',
      s.symptoms,
      s.diagnosis,
      s.agent_type,
      s.severity,
      s.created_at,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screenings-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const filteredScreenings = screenings.filter((s) => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      return (
        s.symptoms?.toLowerCase().includes(search) ||
        s.diagnosis?.toLowerCase().includes(search) ||
        s.patient?.name?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Stethoscope className="h-8 w-8 text-primary" />
            Screenings
          </h1>
          <p className="text-muted-foreground">
            View and manage patient health screenings
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search symptoms, diagnosis..."
                  className="pl-10"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={filters.severity}
                onValueChange={(v) => setFilters({ ...filters, severity: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Agent Type</Label>
              <Select
                value={filters.agent_type}
                onValueChange={(v) => setFilters({ ...filters, agent_type: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="triage">Triage</SelectItem>
                  <SelectItem value="diagnose">Diagnose</SelectItem>
                  <SelectItem value="prescribe">Prescribe</SelectItem>
                  <SelectItem value="refer">Refer</SelectItem>
                  <SelectItem value="asha">ASHA</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue placeholder="All time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Symptoms</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="animate-pulse">
                        <div className="h-4 bg-muted rounded w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredScreenings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No screenings found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredScreenings.map((screening) => (
                    <TableRow
                      key={screening.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedScreening(screening)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{screening.patient?.name || 'Anonymous'}</p>
                          <p className="text-xs text-muted-foreground">
                            {screening.patient?.phone?.slice(0, 8)}...
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate">{screening.symptoms}</p>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate">{screening.diagnosis}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {screening.agent_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${screening.confidence_score}%` }}
                            />
                          </div>
                          <span className="text-xs">{screening.confidence_score}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={severityColors[screening.severity as keyof typeof severityColors]}>
                          {screening.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {timeAgo(screening.created_at)}
                      </TableCell>
                      <TableCell>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedScreening} onOpenChange={() => setSelectedScreening(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Screening Details</DialogTitle>
            <DialogDescription>
              {selectedScreening?.created_at && format(new Date(selectedScreening.created_at), 'PPP p')}
            </DialogDescription>
          </DialogHeader>
          {selectedScreening && (
            <div className="space-y-6">
              {/* Patient Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Patient</Label>
                  <p className="font-medium">{selectedScreening.patient?.name || 'Anonymous'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Language</Label>
                  <p className="font-medium uppercase">{selectedScreening.language}</p>
                </div>
              </div>

              {/* Symptoms & Diagnosis */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Symptoms</Label>
                <p className="p-3 rounded-lg bg-muted">{selectedScreening.symptoms}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Diagnosis</Label>
                <p className="p-3 rounded-lg border">{selectedScreening.diagnosis}</p>
              </div>

              {/* Metrics */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Confidence</p>
                  <p className="text-xl font-bold">{selectedScreening.confidence_score}%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Severity</p>
                  <p className="text-xl font-bold capitalize">{selectedScreening.severity}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Agent</p>
                  <p className="text-xl font-bold capitalize">{selectedScreening.agent_type}</p>
                </div>
              </div>

              {/* Agent Handoffs Timeline */}
              {selectedScreening.agent_handoffs && selectedScreening.agent_handoffs.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Agent Handoffs</Label>
                  <ScreeningTimeline steps={selectedScreening.agent_handoffs as any} />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
