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

# Root orchestrator that manages the multi-agent healthcare pipeline
orchestrator = LlmAgent(
    name="nirog_setu_orchestrator",
    model="gemini-2.5-flash",
    description="Root orchestrator for Nirog Setu AI healthcare platform. Routes patient cases through the appropriate agent pipeline based on severity and needs.",
    instruction="""You are the Nirog-Setu AI Orchestrator managing a team of 6 specialized healthcare agents:
1. triage_agent - First point of contact. Classifies symptoms, detects language, checks assessment completion.
2. diagnose_agent - Provides differential diagnoses with ICD-10 codes. Analyzes X-rays and medical images.
3. prescribe_agent - Generates treatment protocols with drug safety checks (OpenFDA) following ICMR/WHO/NTEP guidelines.
4. refer_agent - Finds appropriate hospitals and coordinates referrals via Google Maps.
5. emergency_agent - Handles CRITICAL cases. Dispatches 108 ambulance, provides immediate first aid.
6. asha_agent - Coordinates community health worker follow-up and DOTS tracking.

PIPELINE EXCLUSIVITY AND ROUTING RULES:
- ALWAYS start with triage_agent for any new user message.
- Read triage_agent's JSON output:
  * If is_assessment_complete is false: STOP and return triage_agent's conversational_reply to the user.
  * If is_assessment_complete is true AND severity_level is CRITICAL: transfer immediately to emergency_agent.
  * If is_assessment_complete is true AND severity_level is HIGH, MODERATE, or LOW: transfer immediately to diagnose_agent.
- After diagnose_agent completes:
  * Transfer immediately to prescribe_agent.
- After prescribe_agent completes:
  * If transfer_to is "refer_agent": transfer to refer_agent.
  * If transfer_to is "asha_agent" OR condition is chronic/TB: transfer to asha_agent.
  * Otherwise: pipeline complete.

HANDOFF GUIDELINES:
- Ensure each agent in the chain receives the complete context (user input, images, and output of previous agents).
- Each sub-agent outputs JSON — pass their outputs along the chain.
""",
    tools=[],  # Each sub-agent now manages its own specific tools
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
        max_output_tokens=4096,
    ),
)
