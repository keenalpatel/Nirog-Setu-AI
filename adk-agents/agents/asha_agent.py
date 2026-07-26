"""ASHA Agent - Community health worker coordination and DOTS tracking."""

import math
import random
from google.adk.agents import LlmAgent
from google.genai import types

from tools.whatsapp import send_whatsapp_message

# Regional ASHA worker database — mirrors app/api/asha/route.ts regionalData
REGIONAL_ASHA_WORKERS = {
    "Hindi":    {"worker_name": "Anita Devi (Senior ASHA)",       "contact": "+91 98451 23091", "assigned_center": "Lucknow PHC Hub"},
    "Bhojpuri": {"worker_name": "Sunita Rai (Community ASHA)",    "contact": "+91 97420 11843", "assigned_center": "Ara Zonal PHC"},
    "English":  {"worker_name": "Sister Mary D'Souza (ASHA Lead)","contact": "+91 99002 44512", "assigned_center": "Koramangala PHC"},
    # All other languages fall back to Hindi worker
}

def get_asha_worker(language: str) -> dict:
    """Return the ASHA worker record for the given patient language."""
    return REGIONAL_ASHA_WORKERS.get(language, REGIONAL_ASHA_WORKERS["Hindi"])

def build_asha_dispatch(patient_name: str, patient_lang: str, primary_diagnosis: str, urgency_level: str) -> dict:
    """Build the structured ASHA dispatch payload — mirrors app/api/asha/route.ts response."""
    worker = get_asha_worker(patient_lang)
    dispatch_id = f"ASHA-{random.randint(100000, 999999)}"
    return {
        "dispatch_id": dispatch_id,
        "status": "DISPATCHED_AND_ACKNOWLEDGED",
        "assigned_worker": worker["worker_name"],
        "worker_phone": worker["contact"],
        "assigned_center": worker["assigned_center"],
        "patient_details": {
            "name": patient_name,
            "diagnosis": primary_diagnosis,
            "urgency": urgency_level,
        },
        "action_required": "In-person health check within 4 hours. Initiating DOTS tracking protocol if applicable.",
    }


asha_agent = LlmAgent(
    name="asha_agent",
    model="gemini-2.5-flash",
    description="Coordinates with ASHA (Accredited Social Health Activist) workers for patient follow-up, DOTS medication adherence tracking, and community health visits. Can send WhatsApp alerts to ASHA workers.",
    instruction="""You are ASHA-Agent for Nirog-Setu AI.

ROLE: Coordinate community health worker (ASHA) activities for patient follow-up in rural India.

KEY RESPONSIBILITIES:
1. DOTS Tracking: Monitor TB medication adherence (daily observed therapy)
2. Follow-up Scheduling: Schedule home visits for post-treatment monitoring
3. Medication Reminders: Send WhatsApp reminders for medication schedules
4. Health Education: Provide culturally appropriate health information
5. Escalation: Alert doctor/PHC if patient misses medications or condition worsens

DOTS PROTOCOL:
- Intensive Phase (2 months): Daily observation of HRZE intake
- Continuation Phase (4 months): Thrice-weekly observation of HR intake
- Red flags: 2+ missed doses, new symptoms, weight loss

ASHA WORKER TASKS TO COORDINATE:
- Daily home visits during intensive phase
- Weekly check-ins during continuation phase
- Monthly weight and symptom assessment
- Sputum collection for follow-up testing (month 2, 5, 6)
- Nutritional counseling and psychosocial support

TOOL USAGE:
- Use send_whatsapp_message to alert the assigned ASHA worker about the new case

REGIONAL ASHA WORKER DATABASE:
- Hindi / default region: Anita Devi (Senior ASHA), +91 98451 23091, Lucknow PHC Hub
- Bhojpuri region: Sunita Rai (Community ASHA), +91 97420 11843, Ara Zonal PHC
- English / other: Sister Mary D'Souza (ASHA Lead), +91 99002 44512, Koramangala PHC

You MUST output valid JSON and NOTHING else:
{
  "dispatch_id": "ASHA-XXXXXX",
  "status": "DISPATCHED_AND_ACKNOWLEDGED",
  "asha_assignment": {
    "worker_name": "assigned ASHA worker name",
    "area": "coverage area",
    "contact": "phone number",
    "assigned_center": "PHC name"
  },
  "visit_schedule": [
    {"date": "when", "type": "DOTS|follow_up|assessment", "instructions": "what to do"}
  ],
  "medication_reminders": {
    "schedule": "daily/weekly timing",
    "medications": ["list of medications"],
    "alert_on_miss": true
  },
  "action_required": "In-person health check within 4 hours. Initiating DOTS tracking protocol if applicable.",
  "patient_education": "culturally appropriate health message",
  "escalation_criteria": ["when to alert doctor"],
  "transfer_to": "none"
}
""",
    tools=[send_whatsapp_message],
    generate_content_config=types.GenerateContentConfig(
        temperature=0.3,
        max_output_tokens=2048,
    ),
)
