/*
# Nirog-Setu AI Healthcare Platform Schema

1. New Tables
- `patients` - Patient records with phone, language preference, location
- `screenings` - Health screenings with agent interactions, symptoms, diagnosis
- `conversations` - Conversation history between patient and agents
- `hospitals` - Hospital/clinic information with location and specialties
- `asha_workers` - ASHA worker profiles with assigned areas
- `emergencies` - Emergency cases with ambulance tracking
- `medical_kb` - Medical knowledge base with vector embeddings for RAG

2. Security
- Enable RLS on all tables.
- Allow anon + authenticated CRUD for public healthcare data (no auth required for patient-facing services).
- All policies use `TO anon, authenticated` with `USING (true)` since this is a public health platform.

3. Notes
- Uses pgvector extension for medical knowledge base semantic search
- Geographic coordinates stored for hospital locator functionality
- Conversation history stored as JSONB for flexibility
*/

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE NOT NULL,
  name text,
  language text NOT NULL DEFAULT 'hi',
  location_district text,
  location_state text DEFAULT 'Bihar',
  location_lat double precision,
  location_lng double precision,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Screenings table
CREATE TABLE IF NOT EXISTS screenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'hi',
  symptoms text NOT NULL,
  agent_type text NOT NULL,
  diagnosis text,
  confidence_score double precision DEFAULT 0.0,
  severity text DEFAULT 'low',
  status text DEFAULT 'completed',
  raw_audio_url text,
  image_url text,
  agent_handoffs jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  screening_id uuid REFERENCES screenings(id) ON DELETE SET NULL,
  messages jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'PHC',
  location_district text,
  location_state text DEFAULT 'Bihar',
  location_lat double precision NOT NULL,
  location_lng double precision NOT NULL,
  specialties text[] DEFAULT '{}'::text[],
  beds_available integer DEFAULT 0,
  beds_total integer DEFAULT 10,
  contact_phone text,
  contact_email text,
  created_at timestamptz DEFAULT now()
);

-- ASHA Workers table
CREATE TABLE IF NOT EXISTS asha_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text UNIQUE NOT NULL,
  assigned_district text,
  assigned_area text,
  active_cases integer DEFAULT 0,
  total_visits integer DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Emergencies table
CREATE TABLE IF NOT EXISTS emergencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  screening_id uuid REFERENCES screenings(id) ON DELETE SET NULL,
  symptoms text NOT NULL,
  location_lat double precision,
  location_lng double precision,
  location_address text,
  severity text DEFAULT 'critical',
  status text DEFAULT 'pending',
  ambulance_dispatched boolean DEFAULT false,
  ambulance_eta_minutes integer,
  hospital_assigned uuid REFERENCES hospitals(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Medical Knowledge Base table
CREATE TABLE IF NOT EXISTS medical_kb (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  source text DEFAULT 'WHO',
  category text,
  embedding vector(1536),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE asha_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_kb ENABLE ROW LEVEL SECURITY;

-- Patients policies
DROP POLICY IF EXISTS "anon_select_patients" ON patients;
CREATE POLICY "anon_select_patients" ON patients FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_patients" ON patients;
CREATE POLICY "anon_insert_patients" ON patients FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_patients" ON patients;
CREATE POLICY "anon_update_patients" ON patients FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_patients" ON patients;
CREATE POLICY "anon_delete_patients" ON patients FOR DELETE
  TO anon, authenticated USING (true);

-- Screenings policies
DROP POLICY IF EXISTS "anon_select_screenings" ON screenings;
CREATE POLICY "anon_select_screenings" ON screenings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_screenings" ON screenings;
CREATE POLICY "anon_insert_screenings" ON screenings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_screenings" ON screenings;
CREATE POLICY "anon_update_screenings" ON screenings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_screenings" ON screenings;
CREATE POLICY "anon_delete_screenings" ON screenings FOR DELETE
  TO anon, authenticated USING (true);

-- Conversations policies
DROP POLICY IF EXISTS "anon_select_conversations" ON conversations;
CREATE POLICY "anon_select_conversations" ON conversations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_conversations" ON conversations;
CREATE POLICY "anon_insert_conversations" ON conversations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_conversations" ON conversations;
CREATE POLICY "anon_update_conversations" ON conversations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_conversations" ON conversations;
CREATE POLICY "anon_delete_conversations" ON conversations FOR DELETE
  TO anon, authenticated USING (true);

-- Hospitals policies
DROP POLICY IF EXISTS "anon_select_hospitals" ON hospitals;
CREATE POLICY "anon_select_hospitals" ON hospitals FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_hospitals" ON hospitals;
CREATE POLICY "anon_insert_hospitals" ON hospitals FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_hospitals" ON hospitals;
CREATE POLICY "anon_update_hospitals" ON hospitals FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_hospitals" ON hospitals;
CREATE POLICY "anon_delete_hospitals" ON hospitals FOR DELETE
  TO anon, authenticated USING (true);

-- ASHA Workers policies
DROP POLICY IF EXISTS "anon_select_asha_workers" ON asha_workers;
CREATE POLICY "anon_select_asha_workers" ON asha_workers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_asha_workers" ON asha_workers;
CREATE POLICY "anon_insert_asha_workers" ON asha_workers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_asha_workers" ON asha_workers;
CREATE POLICY "anon_update_asha_workers" ON asha_workers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_asha_workers" ON asha_workers;
CREATE POLICY "anon_delete_asha_workers" ON asha_workers FOR DELETE
  TO anon, authenticated USING (true);

-- Emergencies policies
DROP POLICY IF EXISTS "anon_select_emergencies" ON emergencies;
CREATE POLICY "anon_select_emergencies" ON emergencies FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_emergencies" ON emergencies;
CREATE POLICY "anon_insert_emergencies" ON emergencies FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_emergencies" ON emergencies;
CREATE POLICY "anon_update_emergencies" ON emergencies FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_emergencies" ON emergencies;
CREATE POLICY "anon_delete_emergencies" ON emergencies FOR DELETE
  TO anon, authenticated USING (true);

-- Medical KB policies
DROP POLICY IF EXISTS "anon_select_medical_kb" ON medical_kb;
CREATE POLICY "anon_select_medical_kb" ON medical_kb FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_medical_kb" ON medical_kb;
CREATE POLICY "anon_insert_medical_kb" ON medical_kb FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_medical_kb" ON medical_kb;
CREATE POLICY "anon_update_medical_kb" ON medical_kb FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_medical_kb" ON medical_kb;
CREATE POLICY "anon_delete_medical_kb" ON medical_kb FOR DELETE
  TO anon, authenticated USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_screenings_patient_id ON screenings(patient_id);
CREATE INDEX IF NOT EXISTS idx_screenings_created_at ON screenings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_screenings_agent_type ON screenings(agent_type);
CREATE INDEX IF NOT EXISTS idx_screenings_severity ON screenings(severity);
CREATE INDEX IF NOT EXISTS idx_emergencies_status ON emergencies(status);
CREATE INDEX IF NOT EXISTS idx_conversations_patient_id ON conversations(patient_id);
CREATE INDEX IF NOT EXISTS idx_hospitals_location ON hospitals(location_lat, location_lng);
CREATE INDEX IF NOT EXISTS idx_asha_workers_district ON asha_workers(assigned_district);
CREATE INDEX IF NOT EXISTS idx_medical_kb_category ON medical_kb(category);