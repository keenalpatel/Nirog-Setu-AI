import type { Patient, Screening, Hospital, ASHAWorker, Emergency, AgentHandoff } from './types';

type Severity = 'low' | 'medium' | 'high' | 'critical';

// Bihar and UP districts with coordinates
const districts = [
  { name: 'Patna', state: 'Bihar', lat: 25.5941, lng: 85.1376 },
  { name: 'Gaya', state: 'Bihar', lat: 24.7914, lng: 85.0002 },
  { name: 'Muzaffarpur', state: 'Bihar', lat: 26.1209, lng: 85.3647 },
  { name: 'Bhagalpur', state: 'Bihar', lat: 25.2500, lng: 86.9800 },
  { name: 'Purnia', state: 'Bihar', lat: 25.7770, lng: 87.4740 },
  { name: 'Darbhanga', state: 'Bihar', lat: 26.1833, lng: 85.9000 },
  { name: 'Siwan', state: 'Bihar', lat: 26.2191, lng: 84.3631 },
  { name: 'Begusarai', state: 'Bihar', lat: 25.4185, lng: 86.1259 },
  { name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lng: 82.9739 },
  { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
];

// Language codes
const languages = ['hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'as'];

// Symptoms and diagnoses for TB and other rural health conditions
const symptomSets: { symptoms: string; diagnosis: string; severity: Severity }[] = [
  { symptoms: 'Persistent cough for 3 weeks, fever, night sweats, weight loss', diagnosis: 'Pulmonary Tuberculosis suspected', severity: 'high' },
  { symptoms: 'Chest pain, difficulty breathing, high fever', diagnosis: 'Community-acquired pneumonia', severity: 'medium' },
  { symptoms: 'Skin rash, joint pain, mild fever', diagnosis: 'Viral exanthem, monitor for complications', severity: 'low' },
  { symptoms: 'Severe headache, neck stiffness, high fever', diagnosis: 'Meningitis suspected - EMERGENCY', severity: 'critical' },
  { symptoms: 'Blood in cough, severe chest pain, sudden weakness', diagnosis: 'Hemoptysis - requires immediate evaluation', severity: 'critical' },
  { symptoms: 'Abdominal pain, nausea, yellow skin', diagnosis: 'Hepatitis suspected', severity: 'medium' },
  { symptoms: 'High fever, chills, body ache', diagnosis: 'Malaria suspected - rapid test recommended', severity: 'medium' },
  { symptoms: 'Skin lesions with itching, red patches', diagnosis: 'Scabies or fungal infection', severity: 'low' },
  { symptoms: 'Difficulty breathing, swelling in legs, tiredness', diagnosis: 'Heart failure possible - refer urgently', severity: 'high' },
  { symptoms: 'Increased thirst, frequent urination, weight loss', diagnosis: 'Diabetes mellitus suspected', severity: 'medium' },
  { symptoms: 'Cough with blood, night sweats, chest tightness', diagnosis: 'TB relapse - sputum test needed', severity: 'high' },
  { symptoms: 'Sudden weakness on one side, facial drooping, speech difficulty', diagnosis: 'Stroke - IMMEDIATE EMERGENCY', severity: 'critical' },
  { symptoms: 'Severe abdominal pain, vomiting, fever', diagnosis: 'Acute appendicitis suspected', severity: 'high' },
  { symptoms: 'Chronic cough, difficulty swallowing, weight loss', diagnosis: 'Esophageal or lung malignancy - urgent referral', severity: 'high' },
  { symptoms: 'Fever, cold, running nose, body pain', diagnosis: 'Common viral infection', severity: 'low' },
];

// Agent types and their typical outputs
const agentOutputs: Record<string, string[]> = {
  triage: [
    'Severity: High. Routed to Diagnose Agent.',
    'Severity: Critical. Emergency protocol initiated.',
    'Severity: Medium. Standard diagnostic flow.',
    'Severity: Low. Self-care recommendations provided.',
  ],
  diagnose: [
    'TB suspected based on symptoms. Confidence: 85%. Recommended: Chest X-ray, sputum test.',
    'Malaria likely based on fever pattern. Confidence: 78%. Recommended: Rapid diagnostic test.',
    'Diabetes indicated by symptoms. Confidence: 82%. Recommended: Fasting glucose test.',
    'Pneumonia diagnosis confirmed by symptom cluster. Confidence: 88%.',
  ],
  prescribe: [
    'Treatment Protocol: DOTS therapy for 6 months. Daily medication compliance required.',
    'Treatment: Artemisinin combination therapy. Complete full course.',
    'Management: Lifestyle modifications + Metformin 500mg. Follow-up in 2 weeks.',
    'Prescription: Antibiotics course for 7 days. Adequate rest and fluids.',
  ],
  refer: [
    'Referred to: District Hospital Patna. Bed available. ETA: 45 minutes.',
    'Referred to: PHC Muzaffarpur. OPD available today.',
    'Referred to: AIIMS Patna. Emergency bed confirmed.',
    'Referred to: District TB Center. Appointment scheduled for tomorrow.',
  ],
  asha: [
    'ASHA worker Sunita Devi notified. Visit scheduled within 24 hours.',
    'ASHA worker Priya Kumari assigned for follow-up. Contact: 98765XXXXX',
    'Home visit arranged. Medication delivery confirmed.',
    'Family counseling scheduled. Community health worker dispatched.',
  ],
  emergency: [
    'EMERGENCY DISPATCHED. Ambulance #BR-05-1234 en route. ETA: 18 minutes.',
    'Ambulance dispatched. Hospital on standby. Police notified for traffic clearance.',
    'Emergency response activated. Nearest facility: District Hospital (8 km).',
  ],
};

// Hindi names
const firstNames = [
  'Suresh', 'Anita', 'Ramesh', 'Sunita', 'Amit', 'Priya', 'Rajesh', 'Kavita',
  'Vijay', 'Lakshmi', 'Sunil', 'Deepa', 'Mukesh', 'Geeta', 'Arun', 'Rekha',
  'Dinesh', 'Meena', 'Rahul', 'Pooja', 'Sanjay', 'Neha', 'Ajay', 'Ritu',
  'Manoj', 'Savita', 'Ravindra', 'Kamla', 'Prashant', 'Anjali', 'Subhash', 'Rani',
];

const lastName = [
  'Kumar', 'Devi', 'Singh', 'Yadav', 'Sharma', 'Gupta', 'Prasad', 'Mishra',
  'Chaudhary', 'Thakur', 'Mahto', 'Paswan', 'Kumari', 'Rani', 'Sah',
];

// Hospital names
const hospitalNames = [
  'Primary Health Center', 'District Hospital', 'Community Health Center',
  'District TB Center', 'Government Hospital', 'ESI Hospital', 'AIIMS',
  'Medical College Hospital', 'Sub-divisional Hospital', 'Referral Hospital',
];

// ASHA worker names
const ashaNames = [
  'Sunita Devi', 'Kamla Devi', 'Priya Kumari', 'Geeta Devi', 'Lakshmi Devi',
  'Rani Devi', 'Meena Devi', 'Deepa Devi', 'Anjali Devi', 'Savita Devi',
  'Kavita Kumari', 'Ritu Kumari', 'Neha Kumari', 'Pooja Kumari', 'Rekha Devi',
];

function randomPhone(): string {
  return `9${Math.floor(100000000 + Math.random() * 900000000)}`;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateAgentHandoffs(symptomSet: { symptoms: string; diagnosis: string; severity: Severity }): AgentHandoff[] {
  const handoffs: AgentHandoff[] = [];
  const now = new Date();

  // Triage always runs first
  handoffs.push({
    agent: 'Triage',
    input: symptomSet.symptoms,
    output: randomElement(agentOutputs.triage),
    timestamp: new Date(now.getTime() - randomInt(2, 5) * 60000).toISOString(),
  });

  // If critical, emergency runs immediately
  if (symptomSet.severity === 'critical') {
    handoffs.push({
      agent: 'Emergency',
      input: 'Critical case detected',
      output: randomElement(agentOutputs.emergency),
      timestamp: new Date(now.getTime() - randomInt(1, 2) * 60000).toISOString(),
    });
    return handoffs;
  }

  // High/Medium severity gets diagnose
  if (symptomSet.severity === 'high' || symptomSet.severity === 'medium') {
    handoffs.push({
      agent: 'Diagnose',
      input: symptomSet.symptoms,
      output: randomElement(agentOutputs.diagnose),
      timestamp: new Date(now.getTime() - randomInt(3, 4) * 60000).toISOString(),
    });

    // High severity gets refer
    if (symptomSet.severity === 'high') {
      handoffs.push({
        agent: 'Refer',
        input: symptomSet.diagnosis,
        output: randomElement(agentOutputs.refer),
        timestamp: new Date(now.getTime() - randomInt(1, 2) * 60000).toISOString(),
      });
    }

    // ASHA notification for follow-up
    if (Math.random() > 0.3) {
      handoffs.push({
        agent: 'ASHA',
        input: 'Case assigned for follow-up',
        output: randomElement(agentOutputs.asha),
        timestamp: new Date(now.getTime() - 10000).toISOString(),
      });
    }
  }

  return handoffs;
}

export function generatePatients(count: number): Partial<Patient>[] {
  const patients: Partial<Patient>[] = [];

  for (let i = 0; i < count; i++) {
    const district = randomElement(districts);
    patients.push({
      phone: randomPhone(),
      name: `${randomElement(firstNames)} ${randomElement(lastName)}`,
      language: randomElement(languages),
      location_district: district.name,
      location_state: district.state,
      location_lat: district.lat + (Math.random() - 0.5) * 0.5,
      location_lng: district.lng + (Math.random() - 0.5) * 0.5,
    });
  }

  return patients;
}

export function generateScreenings(patients: Patient[], count: number): Partial<Screening>[] {
  const screenings: Partial<Screening>[] = [];
  const agents = ['triage', 'diagnose', 'prescribe', 'refer', 'asha', 'emergency'];

  for (let i = 0; i < count; i++) {
    const patient = randomElement(patients);
    const symptomSet = randomElement(symptomSets);
    const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);

    screenings.push({
      patient_id: patient.id,
      language: patient.language,
      symptoms: symptomSet.symptoms,
      agent_type: randomElement(agents),
      diagnosis: symptomSet.diagnosis,
      confidence_score: randomInt(70, 95),
      severity: symptomSet.severity,
      status: 'completed',
      agent_handoffs: generateAgentHandoffs(symptomSet),
      created_at: createdAt.toISOString(),
    });
  }

  return screenings;
}

export function generateHospitals(): Partial<Hospital>[] {
  const hospitals: Partial<Hospital>[] = [];
  const types = ['PHC', 'CHC', 'DH', 'Medical College', 'TB Center'];
  const specialties = [
    ['General Medicine', 'TB'],
    ['Pediatrics', 'Obstetrics'],
    ['General Medicine', 'Emergency'],
    ['Surgery', 'Orthopedics'],
    ['TB', 'Respiratory Medicine'],
    ['General Medicine', 'Dermatology'],
  ];

  for (const district of districts) {
    // Add 2-3 hospitals per district
    const hospitalsCount = randomInt(2, 3);
    for (let i = 0; i < hospitalsCount; i++) {
      hospitals.push({
        name: `${randomElement(hospitalNames)} ${district.name}${i > 0 ? ` ${i + 1}` : ''}`,
        type: randomElement(types),
        location_district: district.name,
        location_state: district.state,
        location_lat: district.lat + (Math.random() - 0.5) * 0.1,
        location_lng: district.lng + (Math.random() - 0.5) * 0.1,
        specialties: randomElement(specialties),
        beds_available: randomInt(0, 20),
        beds_total: randomInt(20, 50),
        contact_phone: randomPhone(),
      });
    }
  }

  return hospitals;
}

export function generateASHAWorkers(): Partial<ASHAWorker>[] {
  const workers: Partial<ASHAWorker>[] = [];

  for (const district of districts) {
    const workersCount = randomInt(3, 7);
    for (let i = 0; i < workersCount; i++) {
      workers.push({
        name: randomElement(ashaNames),
        phone: randomPhone(),
        assigned_district: district.name,
        assigned_area: `Block ${i + 1}`,
        active_cases: randomInt(0, 15),
        total_visits: randomInt(50, 500),
        status: Math.random() > 0.1 ? 'active' : 'inactive',
      });
    }
  }

  return workers;
}

export function generateEmergencies(patients: Patient[], hospitals: Hospital[], count: number): Partial<Emergency>[] {
  const emergencies: Partial<Emergency>[] = [];
  const statuses: Emergency['status'][] = ['pending', 'dispatched', 'in_transit', 'resolved'];
  const criticalSymptomSets = symptomSets.filter(s => s.severity === 'critical' || s.severity === 'high');

  for (let i = 0; i < count; i++) {
    const patient = randomElement(patients);
    const hospital = randomElement(hospitals);
    const symptomSet = randomElement(criticalSymptomSets);
    const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const status = randomElement(statuses);

    emergencies.push({
      patient_id: patient.id,
      symptoms: symptomSet.symptoms,
      location_lat: patient.location_lat,
      location_lng: patient.location_lng,
      location_address: `${patient.location_district}, ${patient.location_state}`,
      severity: symptomSet.severity as Emergency['severity'],
      status,
      ambulance_dispatched: status !== 'pending',
      ambulance_eta_minutes: status === 'in_transit' ? randomInt(5, 25) : null,
      hospital_assigned: hospital.id,
      created_at: createdAt.toISOString(),
      resolved_at: status === 'resolved' ? new Date(createdAt.getTime() + randomInt(30, 120) * 60000).toISOString() : null,
    });
  }

  return emergencies;
}

// Generate relative time string
export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
