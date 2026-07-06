'use client';

import { useState, useEffect } from 'react';
import { MapPin, Building2, Phone, Bed, Calendar, Navigation } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import type { Hospital } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHospitals();
  }, []);

  const fetchHospitals = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .order('name');

    if (!error && data) {
      setHospitals(data);
    }
    setLoading(false);
  };

  const hospitalTypes: Record<string, string> = {
    PHC: 'Primary Health Center',
    CHC: 'Community Health Center',
    DH: 'District Hospital',
    'Medical College': 'Medical College Hospital',
    'TB Center': 'District TB Center',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-8 w-8 text-primary" />
          Healthcare Facilities
        </h1>
        <p className="text-muted-foreground">
          Hospital and clinic registry with bed availability
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{hospitals.length}</div>
            <p className="text-sm text-muted-foreground">Total Facilities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">
              {hospitals.reduce((acc, h) => acc + h.beds_available, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Beds Available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {hospitals.reduce((acc, h) => acc + h.beds_total, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Total Beds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {hospitals.length > 0
                ? Math.round(
                    (hospitals.reduce((acc, h) => acc + h.beds_available, 0) /
                      hospitals.reduce((acc, h) => acc + h.beds_total, 0)) *
                      100
                  )
                : 0}
              %
            </div>
            <p className="text-sm text-muted-foreground">Bed Occupancy</p>
          </CardContent>
        </Card>
      </div>

      {/* Hospitals Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48" />
            </Card>
          ))
        ) : (
          hospitals.map((hospital) => {
            const bedPercent = hospital.beds_total > 0
              ? (hospital.beds_available / hospital.beds_total) * 100
              : 0;
            return (
              <Card key={hospital.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{hospital.name}</CardTitle>
                      <CardDescription>
                        {hospital.location_district}, {hospital.location_state}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{hospital.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Location */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {hospital.location_lat.toFixed(4)}, {hospital.location_lng.toFixed(4)}
                    </span>
                    <Button size="sm" variant="ghost" className="ml-auto gap-1">
                      <Navigation className="h-3 w-3" />
                      Directions
                    </Button>
                  </div>

                  {/* Specialties */}
                  {hospital.specialties && hospital.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {hospital.specialties.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Bed Availability */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Bed className="h-4 w-4" />
                        Bed Availability
                      </span>
                      <span className="font-medium">
                        {hospital.beds_available}/{hospital.beds_total}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          bedPercent < 20 ? 'bg-destructive' : bedPercent < 50 ? 'bg-amber-500' : 'bg-primary'
                        )}
                        style={{ width: `${bedPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Contact */}
                  {hospital.contact_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`tel:${hospital.contact_phone}`}
                        className="text-primary hover:underline"
                      >
                        {hospital.contact_phone}
                      </a>
                    </div>
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
