"""Refer Agent - Hospital finder and referral coordination."""

import random
from google.adk.agents import LlmAgent
from google.genai import types

from tools.google_maps import find_nearest_hospitals

# Regional referral mapping — mirrors app/api/refer/route.ts referralMapping
REGIONAL_REFERRAL_MAP = {
    "Hindi": {
        "facility_name": "Sanjay Gandhi Regional PHC Sub-Centre",
        "address": "Sector 4, Near Community Hub, Lucknow, UP",
        "distance_km": "4.2 km",
        "bed_availability": "14 Beds Available",
        "doctor_on_duty": "Dr. R. K. Sharma (General Medicine)",
        "emergency_support": True,
    },
    "Bhojpuri": {
        "facility_name": "Bhojpur Zonal Primary Health Centre",
        "address": "Station Road, Opp. Civil Hospital, Ara, Bihar",
        "distance_km": "2.8 km",
        "bed_availability": "6 Beds Available",
        "doctor_on_duty": "Dr. Suresh Verma (Chest Specialist)",
        "emergency_support": True,
    },
    "English": {
        "facility_name": "National Urban Health PHC Facility",
        "address": "7th Main, KHB Colony, Koramangala, Bengaluru, Karnataka",
        "distance_km": "3.1 km",
        "bed_availability": "22 Beds Available",
        "doctor_on_duty": "Dr. Ananya Rao (Pulmonologist)",
        "emergency_support": True,
    },
}

def build_referral_response(patient_lang: str, urgency_level: str, required_specialty: str) -> dict:
    """Build referral payload — mirrors app/api/refer/route.ts response."""
    facility = REGIONAL_REFERRAL_MAP.get(patient_lang, REGIONAL_REFERRAL_MAP["English"])
    return {
        "referral_code": f"REF-{random.randint(1000, 9999)}",
        "facility": facility["facility_name"],
        "address": facility["address"],
        "distance": facility["distance_km"],
        "beds": facility["bed_availability"],
        "assigned_doctor": facility["doctor_on_duty"],
        "specialty_needed": required_specialty or "General Diagnostics",
        "urgency_priority": urgency_level,
    }


refer_agent = LlmAgent(
    name="refer_agent",
    model="gemini-2.5-flash",
    description="Finds appropriate healthcare facilities based on patient location, condition severity, and required specialties. Coordinates referrals and provides travel guidance. Uses Google Maps to find nearest hospitals.",
    instruction="""You are Refer-Agent for Nirog-Setu AI.

ROLE: Find the most appropriate hospital or PHC for patient referral based on:
- Patient location (latitude/longitude if available)
- Required medical specialty
- Urgency level (CRITICAL patients need tertiary hospitals)
- Bed availability

REFERRAL GUIDELINES:
- LOW/MODERATE severity: Nearest PHC or Community Health Center
- HIGH severity: District Hospital with specialist availability
- CRITICAL severity: Tertiary hospital (AIIMS, Medical College) with ICU

TOOL USAGE:
1. Call find_nearest_hospitals with patient coordinates (use default 25.6093, 85.1376 for Bihar if unknown)
2. Match required specialty to hospital capabilities
3. For TB patients: ensure DOTS center availability

RULES:
1. Provide clear travel directions and estimated time
2. Include emergency contact numbers
3. Generate a referral code (format: REF-XXXX)
4. Coordinate with ASHA worker for follow-up (set transfer_to = "asha_agent")

OUTPUT: Respond with a clear, empathetic message in the patient's language describing:
- Which hospital to go to and why
- How far it is and how to get there
- What documents to bring
- The referral code for the hospital

Then set transfer_to = "asha_agent" for follow-up coordination.

You MUST output valid JSON and NOTHING else:
{
  "recommended_hospital": {
    "name": "hospital name",
    "type": "PHC|CHC|District|Tertiary",
    "distance_km": 0.0,
    "specialty_match": true,
    "beds_available": 0,
    "contact": "phone number"
  },
  "referral_code": "REF-XXXX",
  "referral_urgency": "immediate|within_24h|within_week",
  "travel_guidance": "how to reach",
  "documents_needed": ["list of documents to carry"],
  "patient_message": "empathetic message in patient's language with all referral details",
  "transfer_to": "asha_agent"
}
""",
    tools=[find_nearest_hospitals],
    generate_content_config=types.GenerateContentConfig(
        temperature=0.2,
        max_output_tokens=2048,
    ),
)
