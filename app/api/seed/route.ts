import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  generatePatients,
  generateHospitals,
  generateASHAWorkers,
} from '@/lib/mock-data';

export async function POST(request: NextRequest) {
  try {
    // Check if data already exists
    const { count: patientCount } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true });

    if (patientCount && patientCount > 0) {
      // Data exists, just return stats
      return NextResponse.json({
        message: 'Data already seeded',
        stats: await getStats(),
      });
    }

    // Generate and insert patients
    const patients = generatePatients(500);
    const { data: insertedPatients, error: patientError } = await supabase
      .from('patients')
      .insert(patients)
      .select();

    if (patientError) {
      throw patientError;
    }

    // Generate and insert hospitals
    const hospitals = generateHospitals();
    const { data: insertedHospitals, error: hospitalError } = await supabase
      .from('hospitals')
      .insert(hospitals)
      .select();

    if (hospitalError) {
      throw hospitalError;
    }

    // Generate and insert ASHA workers
    const ashaWorkers = generateASHAWorkers();
    const { error: ashaError } = await supabase
      .from('asha_workers')
      .insert(ashaWorkers);

    if (ashaError) {
      throw ashaError;
    }

    // Generate screenings
    const screenings = [];
    for (let i = 0; i < 2000; i++) {
      const patient = insertedPatients[Math.floor(Math.random() * insertedPatients.length)];
      const hospital = insertedHospitals[Math.floor(Math.random() * insertedHospitals.length)];
      const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);

      const symptomSets = [
        { symptoms: 'Persistent cough for 3 weeks, fever, night sweats', diagnosis: 'TB Suspected', severity: 'high', agent: 'triage' },
        { symptoms: 'Chest pain, difficulty breathing', diagnosis: 'Pneumonia', severity: 'medium', agent: 'diagnose' },
        { symptoms: 'Skin rash, itching', diagnosis: 'Fungal infection', severity: 'low', agent: 'prescribe' },
        { symptoms: 'High fever, body ache', diagnosis: 'Malaria suspected', severity: 'medium', agent: 'diagnose' },
        { symptoms: 'Severe headache, neck stiffness', diagnosis: 'Meningitis - EMERGENCY', severity: 'critical', agent: 'emergency' },
        { symptoms: 'Blood in cough, chest tightness', diagnosis: 'TB with hemoptysis', severity: 'critical', agent: 'emergency' },
        { symptoms: 'Weakness, increased thirst', diagnosis: 'Diabetes suspected', severity: 'medium', agent: 'diagnose' },
        { symptoms: 'Joint pain, swelling', diagnosis: 'Arthritis', severity: 'low', agent: 'prescribe' },
      ];

      const symptomSet = symptomSets[Math.floor(Math.random() * symptomSets.length)];
      const language = ['hi', 'bn', 'ta', 'te', 'mr'][Math.floor(Math.random() * 5)];

      screenings.push({
        patient_id: patient.id,
        language,
        symptoms: symptomSet.symptoms,
        agent_type: symptomSet.agent,
        diagnosis: symptomSet.diagnosis,
        confidence_score: Math.floor(Math.random() * 25 + 70),
        severity: symptomSet.severity,
        status: 'completed',
        agent_handoffs: [
          { agent: 'Triage', input: symptomSet.symptoms, output: `Severity: ${symptomSet.severity}. Routed appropriately.`, timestamp: createdAt.toISOString() },
        ],
        created_at: createdAt.toISOString(),
      });
    }

    // Insert screenings in batches
    const batchSize = 100;
    for (let i = 0; i < screenings.length; i += batchSize) {
      const batch = screenings.slice(i, i + batchSize);
      const { error } = await supabase.from('screenings').insert(batch);
      if (error) console.error('Screening batch error:', error);
    }

    // Generate emergencies
    const emergencies = [];
    for (let i = 0; i < 150; i++) {
      const patient = insertedPatients[Math.floor(Math.random() * insertedPatients.length)];
      const hospital = insertedHospitals[Math.floor(Math.random() * insertedHospitals.length)];
      const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      const status = ['pending', 'dispatched', 'in_transit', 'resolved', 'cancelled'][Math.floor(Math.random() * 5)];

      emergencies.push({
        patient_id: patient.id,
        symptoms: 'Critical condition - immediate attention required',
        location_lat: patient.location_lat,
        location_lng: patient.location_lng,
        location_address: `${patient.location_district}, ${patient.location_state}`,
        severity: ['high', 'critical'][Math.floor(Math.random() * 2)],
        status,
        ambulance_dispatched: status !== 'pending',
        ambulance_eta_minutes: status === 'in_transit' ? Math.floor(Math.random() * 20 + 5) : null,
        hospital_assigned: hospital.id,
        created_at: createdAt.toISOString(),
        resolved_at: status === 'resolved' ? new Date(createdAt.getTime() + 60 * 60000).toISOString() : null,
      });
    }

    const { error: emergencyError } = await supabase
      .from('emergencies')
      .insert(emergencies);

    if (emergencyError) {
      console.error('Emergency insert error:', emergencyError);
    }

    return NextResponse.json({
      message: 'Database seeded successfully',
      stats: await getStats(),
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to seed database' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const stats = await getStats();
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

async function getStats() {
  const { count: patients } = await supabase.from('patients').select('*', { count: 'exact', head: true });
  const { count: screenings } = await supabase.from('screenings').select('*', { count: 'exact', head: true });
  const { count: hospitals } = await supabase.from('hospitals').select('*', { count: 'exact', head: true });
  const { count: ashaWorkers } = await supabase.from('asha_workers').select('*', { count: 'exact', head: true });
  const { count: emergencies } = await supabase.from('emergencies').select('*', { count: 'exact', head: true });

  return { patients, screenings, hospitals, ashaWorkers, emergencies };
}
