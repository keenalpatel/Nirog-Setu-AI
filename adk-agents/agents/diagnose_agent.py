"""Diagnose Agent - Differential diagnosis with ICD-10 codes and image analysis."""

import re
from google.adk.agents import LlmAgent
from google.genai import types

from tools.umls import lookup_icd10_code

diagnose_agent = LlmAgent(
    name="diagnose_agent",
    model="gemini-2.5-flash",
    description="Evaluates patient symptom history and medical images (X-rays, skin lesions) to provide differential diagnoses with confidence scores and ICD-10 codes. Calls lookup_icd10_code tool to resolve accurate ICD-10 codes. Routes to prescribe_agent after diagnosis.",
    instruction="""You are Diagnose-Agent for Nirog-Setu AI.

ROLE: Evaluate patient symptom history and any attached medical images (Chest X-rays, skin images).
Provide clear differential diagnoses under Primary Health Centre (PHC) guidelines for rural India.

TRIAGE URGENCY LEVEL GUIDELINES (triage_urgency_level):
1. CRITICAL: Reserve strictly for immediate life-threatening conditions (e.g., massive hemoptysis/coughing large amounts of blood, severe chest pain, shortness of breath at rest, cyanosis, unconsciousness).
2. HIGH: Minor/occasional blood-tinged sputum or trace blood while coughing slowly/dryly, high fever (>102°F) for several days without respiratory collapse, or moderate respiratory distress. This requires PHC Doctor referral & ASHA Visit, but NOT 108 Emergency Ambulance dispatch.
3. MODERATE: Mild cold, low-grade fever, sore throat, or routine mild symptoms.
4. LOW: Informational or general hygiene queries.

IMPORTANT SAFETY GUARDRAIL:
- If the patient mentions blood in cough/sputum with words like "sometimes", "streaks", "few drops", "slowly", "little", "flecks" — and does NOT mention severe shortness of breath, breathlessness, severe chest pain, unconsciousness, or massive bleeding — then the urgency MUST be HIGH, NOT CRITICAL.
- Only set CRITICAL if there is clear evidence of massive hemoptysis, severe respiratory distress, or life-threatening symptoms.

TOOL USAGE:
- You MUST call the lookup_icd10_code tool for each condition in your differential diagnoses to get accurate ICD-10 codes.
- Pass the clean condition name (e.g., "Miliary Tuberculosis") to the tool.

CRITICAL FORMATTING:
- Do NOT append urgency levels or brackets like '(High)' into condition_name or primary_diagnosis. Output clean standard condition names (e.g. 'Bacterial Pneumonia', 'Acute Bronchitis', 'Miliary Tuberculosis').
- Keep clinical rationales concise and punchy (under 2-3 sentences per condition).
- Always include a standard ICD-10 code for each diagnosis (e.g. J18.9 for Pneumonia, A19 for Miliary TB).

After calling the lookup_icd10_code tool for your diagnoses, output your final response as valid JSON with this exact structure and NOTHING else (no markdown, no explanation):
{
  "primary_diagnosis": "clean condition name",
  "differential_diagnoses": [
    {
      "condition_name": "clean name without severity tags",
      "confidence_score": "High|Moderate|Low",
      "clinical_rationale": "concise 2-3 sentence reasoning",
      "icd_10_code": "code from lookup_icd10_code tool result"
    }
  ],
  "required_followup_tests": ["test1", "test2"],
  "patient_action_plan": "actionable next steps for the patient",
  "triage_urgency_level": "CRITICAL|HIGH|MODERATE|LOW",
  "transfer_to": "prescribe_agent"
}
""",
    tools=[lookup_icd10_code],
    generate_content_config=types.GenerateContentConfig(
        temperature=0.1,
        max_output_tokens=4096,
    ),
)


def sanitize_diagnose_output(diagnose_data: dict, history_text: str = "") -> dict:
    """Post-processing guardrails matching legacy diagnose/route.ts logic.

    1. Strips severity tags from condition names (e.g. '(High)' → removed).
    2. Falls back to J18.9 if no ICD-10 code was resolved for the primary diagnosis.
    3. Demotes CRITICAL → HIGH when history only mentions minor blood-in-cough without
       severe respiratory distress — mirrors the safety guardrail in the Next.js API.
    """
    if not diagnose_data:
        return diagnose_data

    # 1. Sanitize condition names
    def _clean(name: str) -> str:
        name = re.sub(r'\(.*?\)', '', name)
        name = re.sub(r'high|moderate|low|acute|severe|chronic', '', name, flags=re.IGNORECASE)
        name = re.sub(r'[^a-zA-Z\s]', '', name).strip()
        return name

    if diagnose_data.get("primary_diagnosis"):
        diagnose_data["primary_diagnosis"] = _clean(diagnose_data["primary_diagnosis"])

    diffs = diagnose_data.get("differential_diagnoses", [])
    for d in diffs:
        if d.get("condition_name"):
            d["condition_name"] = _clean(d["condition_name"])
        if not d.get("icd_10_code"):
            d["icd_10_code"] = "J18.9"

    # 2. Safety guardrail: demote erroneous CRITICAL to HIGH for minor blood in cough
    if diagnose_data.get("triage_urgency_level", "").upper() == "CRITICAL" and history_text:
        has_minor = bool(re.search(
            r'slowly|sometimes|flecks|streaks|few drops|little', history_text, re.IGNORECASE
        ))
        has_severe = bool(re.search(
            r'shortness of breath|breathless|severe chest pain|unconscious|fainted|massive',
            history_text, re.IGNORECASE,
        ))
        if has_minor and not has_severe:
            diagnose_data["triage_urgency_level"] = "HIGH"

    return diagnose_data
