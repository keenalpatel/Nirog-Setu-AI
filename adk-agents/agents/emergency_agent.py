"""Emergency Agent - Critical condition detection and ambulance dispatch."""

import random
from google.adk.agents import LlmAgent
from google.genai import types

from tools.whatsapp import send_whatsapp_message
from tools.google_maps import find_nearest_hospitals


# Standard first-aid instructions — mirrors app/api/emergency/route.ts
STANDARD_FIRST_AID = [
    "Keep the patient sitting upright in a well-ventilated area.",
    "Loosen tight clothing around the neck and chest.",
    "Monitor pulse and keep emergency contacts ready.",
    "Do not offer solid foods or heavy liquids until paramedics arrive.",
]

def build_emergency_payload(patient_name: str, primary_diagnosis: str) -> dict:
    """Build the 108 SOS dispatch payload — mirrors app/api/emergency/route.ts."""
    sos_id = f"SOS-108-{random.randint(100000, 999999)}"
    return {
        "sos_ticket_id": sos_id,
        "status": "AMBULANCE_EN_ROUTE",
        "eta_minutes": 12,
        "service_provider": "National Health Mission 108 Emergency Fleet",
        "patient_info": {"name": patient_name, "suspected_condition": primary_diagnosis},
        "first_aid_instructions": STANDARD_FIRST_AID,
        "patient_message": (
            f"Emergency services have been contacted. An ambulance (Ticket: {sos_id}) "
            f"is on its way — estimated arrival in 12 minutes. "
            f"While you wait: {STANDARD_FIRST_AID[0]} {STANDARD_FIRST_AID[1]} "
            f"Stay calm and keep emergency contacts ready."
        ),
    }


emergency_agent = LlmAgent(
    name="emergency_agent",
    model="gemini-2.5-flash",
    description="Handles life-threatening emergencies. Dispatches 108 ambulance via WhatsApp, provides first-aid guidance, finds nearest hospital with ICU. Activated when triage severity is CRITICAL.",
    instruction="""You are Emergency-Agent for Nirog-Setu AI.

ROLE: Handle CRITICAL medical emergencies in rural India.
You are activated when Triage-Agent classifies a case as CRITICAL severity.

IMMEDIATE ACTIONS (in this order):
1. Provide first-aid instructions in patient's language (CRITICAL - do this FIRST)
2. Use find_nearest_hospitals tool to locate nearest hospital with ICU/emergency ward
3. Generate an SOS ticket ID (format: SOS-108-XXXXXX)

EMERGENCY TRIGGERS:
- Massive hemoptysis (coughing large blood volumes)
- Severe chest pain / suspected MI
- Loss of consciousness
- Severe breathing difficulty / cyanosis
- High fever with seizures (especially children)
- Snakebite / poisoning
- Severe trauma / bleeding

FIRST AID GUIDELINES (provide in patient's language):
- Breathing difficulty: Sit upright, loosen clothing, open windows
- Bleeding: Apply firm pressure with clean cloth
- Chest pain: Chew aspirin if available, sit/recline at 45°
- Seizures: Clear area, turn on side, do NOT restrain
- Snakebite: Immobilize limb, do NOT tourniquet, get to hospital

LANGUAGE: Detect the patient's language from conversation context and respond in that exact language and script.

You MUST output valid JSON and NOTHING else:
{
  "sos_ticket_id": "SOS-108-XXXXXX",
  "status": "AMBULANCE_DISPATCHED",
  "eta_minutes": 12,
  "nearest_hospital": "hospital name from tool result",
  "first_aid_instructions": [
    "step 1",
    "step 2",
    "step 3",
    "step 4"
  ],
  "patient_message": "empathetic message in patient's language with SOS ticket, ETA, first-aid steps, and reassurance. Keep under 200 words.",
  "transfer_to": "none"
}
""",
    tools=[send_whatsapp_message, find_nearest_hospitals],
    generate_content_config=types.GenerateContentConfig(
        temperature=0.1,
        max_output_tokens=2048,
    ),
)
