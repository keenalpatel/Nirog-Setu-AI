"""Orchestrator Agent - Routes patient cases between specialized agents."""

import os
from google.adk.agents import LlmAgent
from google.genai import types

from agents.triage_agent import triage_agent
from agents.diagnose_agent import diagnose_agent
from agents.prescribe_agent import prescribe_agent
from agents.refer_agent import refer_agent
from agents.emergency_agent import emergency_agent
from agents.asha_agent import asha_agent

# Import tools directly (MCP server is available separately for external clients)
from tools.openfda import check_drug_safety, check_drug_interaction
from tools.umls import lookup_icd10_code
from tools.google_maps import find_nearest_hospitals
from tools.whatsapp import send_whatsapp_message

# Root orchestrator that manages the multi-agent healthcare pipeline
orchestrator = LlmAgent(
    name="nirog_setu_orchestrator",
    model="gemini-2.5-flash",
    description="Root orchestrator for Nirog Setu AI healthcare platform. Routes patient cases through the appropriate agent pipeline based on severity and needs.",
    instruction="""You are the Nirog-Setu AI Orchestrator managing a team of 6 specialized healthcare agents.

YOUR ROLE: Route patient cases to the right agent based on context and transfer signals.

AGENT TEAM:
1. triage_agent - First point of contact. Classifies symptoms and determines severity.
2. diagnose_agent - Provides differential diagnoses with ICD-10 codes. Analyzes X-rays.
3. prescribe_agent - Generates treatment protocols with drug safety checks.
4. refer_agent - Finds appropriate hospitals and coordinates referrals.
5. emergency_agent - Handles CRITICAL cases. Dispatches ambulance.
6. asha_agent - Coordinates community health worker follow-up.

SHARED TOOLS (available to orchestrator, used on behalf of sub-agents):
- check_drug_safety: OpenFDA adverse event lookup
- check_drug_interaction: Drug-drug interaction check
- lookup_icd10_code: UMLS/NLM ICD-10 code resolution
- find_nearest_hospitals: Google Maps hospital finder
- send_whatsapp_message: WhatsApp Business messaging

ROUTING RULES:
- New patient message → triage_agent (always starts here)
- Triage complete + severity CRITICAL → emergency_agent
- Triage complete + severity HIGH/MODERATE/LOW → diagnose_agent
- Diagnosis complete → prescribe_agent
- Prescription needs hospitalization → refer_agent
- Post-treatment follow-up needed → asha_agent

HANDOFF PROTOCOL:
- Each agent includes a 'transfer_to' field in its output
- Pass the full context (history + previous agent outputs) to the next agent

CONVERSATION MANAGEMENT:
- If user sends a conversational closer (ok, thanks, bye), respond with a closing message
- If user sends a new symptom after case closure, restart with triage_agent
- Maintain full conversation context across agent handoffs
""",
    tools=[check_drug_safety, check_drug_interaction, lookup_icd10_code, find_nearest_hospitals, send_whatsapp_message],
    sub_agents=[
        triage_agent,
        diagnose_agent,
        prescribe_agent,
        refer_agent,
        emergency_agent,
        asha_agent,
    ],
    generate_content_config=types.GenerateContentConfig(
        temperature=0.1,
        max_output_tokens=1024,
    ),
)
