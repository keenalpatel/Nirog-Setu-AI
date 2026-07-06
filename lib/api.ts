import { supabase, handleSupabaseError } from './supabase';
import type {
  Patient,
  Screening,
  Conversation,
  Hospital,
  ASHAWorker,
  Emergency,
  DashboardStats
} from './types';

// Patients API
export async function getPatients(limit = 50, offset = 0) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  return handleSupabaseError(data, error);
}

export async function getPatient(id: string) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return handleSupabaseError(data, error);
}

export async function createPatient(patient: Partial<Patient>) {
  const { data, error } = await supabase
    .from('patients')
    .insert(patient)
    .select()
    .single();
  return handleSupabaseError(data, error);
}

export async function updatePatient(id: string, updates: Partial<Patient>) {
  const { data, error } = await supabase
    .from('patients')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return handleSupabaseError(data, error);
}

// Screenings API
export async function getScreenings(filters?: {
  patient_id?: string;
  agent_type?: string;
  severity?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('screenings')
    .select('*, patient:patients(*)')
    .order('created_at', { ascending: false });

  if (filters?.patient_id) {
    query = query.eq('patient_id', filters.patient_id);
  }
  if (filters?.agent_type) {
    query = query.eq('agent_type', filters.agent_type);
  }
  if (filters?.severity) {
    query = query.eq('severity', filters.severity);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  return handleSupabaseError(data, error);
}

export async function getScreening(id: string) {
  const { data, error } = await supabase
    .from('screenings')
    .select('*, patient:patients(*)')
    .eq('id', id)
    .maybeSingle();
  return handleSupabaseError(data, error);
}

export async function createScreening(screening: Partial<Screening>) {
  const { data, error } = await supabase
    .from('screenings')
    .insert(screening)
    .select()
    .single();
  return handleSupabaseError(data, error);
}

// Conversations API
export async function getConversations(patientId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  return handleSupabaseError(data, error);
}

export async function getConversation(id: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return handleSupabaseError(data, error);
}

// Hospitals API
export async function getHospitals() {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*')
    .order('name');
  return handleSupabaseError(data, error);
}

export async function getNearbyHospitals(lat: number, lng: number, limit = 10) {
  // Simple distance-based query (PostGIS would be ideal, but this works for demo)
  const { data, error } = await supabase
    .from('hospitals')
    .select('*')
    .order('name');

  if (error) {
    return handleSupabaseError(null, error);
  }

  // Calculate distance and sort
  const hospitalsWithDistance = (data || []).map((h: Hospital) => {
    const distance = Math.sqrt(
      Math.pow(h.location_lat - lat, 2) + Math.pow(h.location_lng - lng, 2)
    ) * 111; // Rough km conversion
    return { ...h, distance };
  }).sort((a, b) => a.distance - b.distance).slice(0, limit);

  return { data: hospitalsWithDistance, error: null };
}

export async function updateHospitalBeds(id: string, bedsAvailable: number) {
  const { data, error } = await supabase
    .from('hospitals')
    .update({ beds_available: bedsAvailable })
    .eq('id', id)
    .select()
    .single();
  return handleSupabaseError(data, error);
}

// ASHA Workers API
export async function getASHAWorkers() {
  const { data, error } = await supabase
    .from('asha_workers')
    .select('*')
    .order('name');
  return handleSupabaseError(data, error);
}

export async function getASHAWorker(id: string) {
  const { data, error } = await supabase
    .from('asha_workers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return handleSupabaseError(data, error);
}

export async function updateASHAWorker(id: string, updates: Partial<ASHAWorker>) {
  const { data, error } = await supabase
    .from('asha_workers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  return handleSupabaseError(data, error);
}

// Emergencies API
export async function getEmergencies(filters?: {
  status?: string;
  severity?: string;
  limit?: number;
}) {
  let query = supabase
    .from('emergencies')
    .select('*, patient:patients(*), hospital:hospitals(*)')
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.severity) {
    query = query.eq('severity', filters.severity);
  }

  const limit = filters?.limit || 50;
  query = query.limit(limit);

  const { data, error } = await query;
  return handleSupabaseError(data, error);
}

export async function getEmergency(id: string) {
  const { data, error } = await supabase
    .from('emergencies')
    .select('*, patient:patients(*), hospital:hospitals(*)')
    .eq('id', id)
    .maybeSingle();
  return handleSupabaseError(data, error);
}

export async function createEmergency(emergency: Partial<Emergency>) {
  const { data, error } = await supabase
    .from('emergencies')
    .insert(emergency)
    .select()
    .single();
  return handleSupabaseError(data, error);
}

export async function updateEmergency(id: string, updates: Partial<Emergency>) {
  const { data, error } = await supabase
    .from('emergencies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  return handleSupabaseError(data, error);
}

// Analytics API
export async function getDashboardStats(): Promise<{ data: DashboardStats | null; error: string | null }> {
  // Get total screenings
  const { count: totalScreenings } = await supabase
    .from('screenings')
    .select('*', { count: 'exact', head: true });

  // Get TB detections (diagnosis containing TB)
  const { data: tbData } = await supabase
    .from('screenings')
    .select('id')
    .ilike('diagnosis', '%TB%');

  // Get emergencies handled
  const { count: emergenciesHandled } = await supabase
    .from('emergencies')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'resolved');

  // Get active ASHA workers
  const { count: ashaWorkersActive } = await supabase
    .from('asha_workers')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  // Get screenings by agent type
  const { data: agentData } = await supabase
    .from('screenings')
    .select('agent_type');

  const agentCounts = (agentData || []).reduce((acc: Record<string, number>, item) => {
    acc[item.agent_type] = (acc[item.agent_type] || 0) + 1;
    return acc;
  }, {});

  const agentDistribution = Object.entries(agentCounts).map(([agent, count]) => ({
    agent,
    count,
    percentage: totalScreenings ? Math.round((count / totalScreenings) * 100) : 0,
  }));

  // Get screenings by language
  const { data: languageData } = await supabase
    .from('screenings')
    .select('language');

  const languageCounts = (languageData || []).reduce((acc: Record<string, number>, item) => {
    acc[item.language] = (acc[item.language] || 0) + 1;
    return acc;
  }, {});

  const languageDistribution = Object.entries(languageCounts).map(([language, count]) => ({
    language,
    count,
  }));

  // Get screenings trend (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: trendData } = await supabase
    .from('screenings')
    .select('created_at')
    .gte('created_at', thirtyDaysAgo.toISOString());

  const screeningsByDate: Record<string, number> = {};
  (trendData || []).forEach((item) => {
    const date = new Date(item.created_at).toISOString().split('T')[0];
    screeningsByDate[date] = (screeningsByDate[date] || 0) + 1;
  });

  const screeningsTrend = Object.entries(screeningsByDate)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const stats: DashboardStats = {
    total_screenings: totalScreenings || 0,
    tb_detections: tbData?.length || 0,
    emergencies_handled: emergenciesHandled || 0,
    asha_workers_active: ashaWorkersActive || 0,
    lives_saved_estimate: Math.round((emergenciesHandled || 0) * 0.8 + (tbData?.length || 0) * 0.5),
    screenings_trend: screeningsTrend,
    agent_distribution: agentDistribution,
    language_distribution: languageDistribution,
    disease_surveillance: [
      { disease: 'Tuberculosis', cases: tbData?.length || 0, trend: 5 },
      { disease: 'Malaria', cases: Math.round((totalScreenings || 0) * 0.08), trend: -3 },
      { disease: 'Dengue', cases: Math.round((totalScreenings || 0) * 0.05), trend: 2 },
      { disease: 'Diabetes', cases: Math.round((totalScreenings || 0) * 0.12), trend: 8 },
      { disease: 'Hypertension', cases: Math.round((totalScreenings || 0) * 0.15), trend: 4 },
    ],
  };

  return { data: stats, error: null };
}

// Real-time subscriptions
export function subscribeToEmergencies(callback: (emergency: Emergency) => void) {
  return supabase
    .channel('emergencies-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'emergencies' },
      (payload) => callback(payload.new as Emergency)
    )
    .subscribe();
}

export function subscribeToScreenings(callback: (screening: Screening) => void) {
  return supabase
    .channel('screenings-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'screenings' },
      (payload) => callback(payload.new as Screening)
    )
    .subscribe();
}
