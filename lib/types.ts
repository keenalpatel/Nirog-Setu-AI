// Patient types
export interface Patient {
  id: string;
  phone: string;
  name: string | null;
  language: string;
  location_district: string | null;
  location_state: string;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  updated_at: string;
}

// Screening types
export interface Screening {
  id: string;
  patient_id: string;
  language: string;
  symptoms: string;
  agent_type: string;
  diagnosis: string | null;
  confidence_score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'escalated';
  raw_audio_url: string | null;
  image_url: string | null;
  agent_handoffs: AgentHandoff[];
  created_at: string;
  patient?: Patient;
}

export interface AgentHandoff {
  agent: string;
  input: string;
  output: string;
  timestamp: string;
}

// Conversation types
export interface Conversation {
  id: string;
  patient_id: string;
  screening_id: string | null;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'agent';
  content: string;
  agent_type?: string;
  timestamp: string;
}

// Hospital types
export interface Hospital {
  id: string;
  name: string;
  type: string;
  location_district: string | null;
  location_state: string;
  location_lat: number;
  location_lng: number;
  specialties: string[];
  beds_available: number;
  beds_total: number;
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
}

// ASHA Worker types
export interface ASHAWorker {
  id: string;
  name: string;
  phone: string;
  assigned_district: string | null;
  assigned_area: string | null;
  active_cases: number;
  total_visits: number;
  status: 'active' | 'inactive' | 'on_leave';
  created_at: string;
}

// Emergency types
export interface Emergency {
  id: string;
  patient_id: string | null;
  screening_id: string | null;
  symptoms: string;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'dispatched' | 'in_transit' | 'resolved' | 'cancelled';
  ambulance_dispatched: boolean;
  ambulance_eta_minutes: number | null;
  hospital_assigned: string | null;
  created_at: string;
  resolved_at: string | null;
  patient?: Patient;
  hospital?: Hospital;
}

// Medical KB types
export interface MedicalKB {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string | null;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// Dashboard Analytics types
export interface DashboardStats {
  total_screenings: number;
  tb_detections: number;
  emergencies_handled: number;
  asha_workers_active: number;
  lives_saved_estimate: number;
  screenings_trend: { date: string; count: number }[];
  agent_distribution: { agent: string; count: number; percentage: number }[];
  language_distribution: { language: string; count: number }[];
  disease_surveillance: { disease: string; cases: number; trend: number }[];
}

// Agent types
export type AgentType = 'triage' | 'diagnose' | 'prescribe' | 'refer' | 'asha' | 'emergency';

export interface AgentStatus {
  agent: AgentType;
  status: 'active' | 'idle' | 'error';
  last_used: string;
  total_runs: number;
  success_rate: number;
}

// Supported languages
export const SUPPORTED_LANGUAGES = [
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];
