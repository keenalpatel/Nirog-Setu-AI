'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { User, Phone, MapPin, Calendar, Activity, FileText, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import type { Patient, Screening } from '@/lib/types';
import { ScreeningTimeline } from '@/components/screening-timeline';

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientScreenings, setPatientScreenings] = useState<Screening[]>([]);

  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setPatients(data);
    }
    setLoading(false);
  };

  const fetchPatientDetails = async (patient: Patient) => {
    setSelectedPatient(patient);
    const { data } = await supabase
      .from('screenings')
      .select('*')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(10);

    setPatientScreenings(data || []);
  };

  const filteredPatients = patients.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search) ||
    p.location_district?.toLowerCase().includes(search.toLowerCase())
  );

  const languageNames: Record<string, string> = {
    hi: 'Hindi',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi',
    gu: 'Gujarati',
    kn: 'Kannada',
    ml: 'Malayalam',
    pa: 'Punjabi',
    as: 'Assamese',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-8 w-8 text-primary" />
            Patients
          </h1>
          <p className="text-muted-foreground">
            Patient registry and health history
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or location..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Patient Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-40" />
            </Card>
          ))
        ) : filteredPatients.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No patients found</p>
          </div>
        ) : (
          filteredPatients.map((patient) => (
            <Card
              key={patient.id}
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => fetchPatientDetails(patient)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{patient.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {patient.phone}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{patient.location_district}, {patient.location_state}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Registered {format(new Date(patient.created_at), 'MMM d, yyyy')}</span>
                </div>
                <div>
                  <Badge variant="outline" className="mt-2">
                    {languageNames[patient.language] || patient.language}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPatient(null)}
        >
          <Card
            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>{selectedPatient.name}</CardTitle>
                    <CardDescription>
                      {selectedPatient.phone} | {selectedPatient.location_district}
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => setSelectedPatient(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Patient Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">Language</p>
                  <p className="font-medium">{languageNames[selectedPatient.language]}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs text-muted-foreground">Registered</p>
                  <p className="font-medium">{format(new Date(selectedPatient.created_at), 'PPP')}</p>
                </div>
              </div>

              {/* Screenings History */}
              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Screening History ({patientScreenings.length})
                </h3>
                {patientScreenings.length === 0 ? (
                  <p className="text-muted-foreground">No screenings recorded</p>
                ) : (
                  <div className="space-y-4">
                    {patientScreenings.map((screening) => (
                      <div key={screening.id} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">{screening.agent_type}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(screening.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{screening.symptoms}</p>
                        <p className="text-sm text-muted-foreground mt-1">{screening.diagnosis}</p>
                        {screening.agent_handoffs && (screening.agent_handoffs as any[]).length > 0 && (
                          <div className="mt-3">
                            <ScreeningTimeline steps={screening.agent_handoffs as any} compact />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
