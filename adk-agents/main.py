"""
Nirog Setu AI - ADK Agent Service
FastAPI server exposing ADK agents as HTTP endpoints for Cloud Run deployment.
"""

import os
import base64
import json
import re
import asyncio
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

# Set Vertex AI defaults for Google GenAI SDK if GEMINI_API_KEY is not set
if not os.getenv("GEMINI_API_KEY") and not os.getenv("GOOGLE_API_KEY"):
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "true"
    if "GOOGLE_CLOUD_PROJECT" not in os.environ:
        os.environ["GOOGLE_CLOUD_PROJECT"] = os.getenv("GCP_PROJECT_ID", "project-3d39fa0c-2d6a-41aa-948")
    if "GOOGLE_CLOUD_LOCATION" not in os.environ:
        os.environ["GOOGLE_CLOUD_LOCATION"] = os.getenv("GCP_LOCATION", "us-central1")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

load_dotenv()

# Import all specialized agents and orchestrator
from agents.orchestrator import orchestrator
from agents.triage_agent import triage_agent
from agents.diagnose_agent import diagnose_agent
from agents.prescribe_agent import prescribe_agent
from agents.refer_agent import refer_agent
from agents.emergency_agent import emergency_agent
from agents.asha_agent import asha_agent
from tools.openfda import check_drug_safety

APP_NAME = "nirog_setu_ai"
session_service = InMemorySessionService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    print(f"🏥 Nirog Setu AI ADK Service starting...")
    print(f"   GCP Project: {os.getenv('GCP_PROJECT_ID', 'not set')}")
    print(f"   Agents: triage, diagnose, prescribe, refer, emergency, asha")
    print(f"   Orchestrator: nirog_setu_orchestrator")
    yield
    print("🛑 Nirog Setu AI ADK Service shutting down...")


app = FastAPI(
    title="Nirog Setu AI - ADK Agent Service",
    description="Multi-agent healthcare platform built on Google ADK, deployed on Cloud Run",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request/Response Models ---


class ChatRequest(BaseModel):
    """Incoming patient message (supports text, image, and voice audio)."""
    message: str = ""
    user_id: str = "anonymous"
    session_id: str | None = None
    image_base64: str | None = None
    audio_base64: str | None = None


class ChatResponse(BaseModel):
    """Agent response."""
    reply: str
    session_id: str
    agent_name: str
    handoffs: list[dict] = []
    metadata: dict = {}


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    service: str
    agents: list[str]


# --- Endpoints ---


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for Cloud Run."""
    return HealthResponse(
        status="healthy",
        service="nirog-setu-adk-agents",
        agents=["triage", "diagnose", "prescribe", "refer", "emergency", "asha"],
    )


def _safe_json_parse(text: str) -> dict | None:
    """Robust JSON parser that extracts JSON blocks even if surrounded by markdown/text."""
    if not text:
        return None
    clean = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(clean)
    except Exception:
        pass

    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    return None


def _get_fallback_prescription(condition_name: str) -> dict:
    """Provides standard ICMR/NTEP guideline prescriptions for core rural India conditions as a safety fallback."""
    cond_lower = (condition_name or "").lower()
    if "tuberculosis" in cond_lower or "tb" in cond_lower:
        return {
            "prescriptions": [
                {"medication_name": "Rifampicin", "dosage": "600 mg", "frequency": "Once daily", "duration": "9-12 months", "route": "oral", "purpose": "First-line anti-TB bactericidal antibiotic"},
                {"medication_name": "Isoniazid", "dosage": "300 mg", "frequency": "Once daily", "duration": "9-12 months", "route": "oral", "purpose": "First-line anti-TB antibiotic"},
                {"medication_name": "Pyrazinamide", "dosage": "1500 mg", "frequency": "Once daily", "duration": "2 months", "route": "oral", "purpose": "Intensive phase sterilizing anti-TB drug"}
            ],
            "phc_pharmacy_status": "Available under NTEP at PHC",
            "icmr_guideline_reference": "NTEP Guidelines 2025"
        }
    elif "bronchitis" in cond_lower or "cough" in cond_lower or "cold" in cond_lower:
        return {
            "prescriptions": [
                {"medication_name": "Dextromethorphan Syrup", "dosage": "10 ml", "frequency": "Thrice daily", "duration": "5 days", "route": "oral", "purpose": "Cough suppression and airway relief"},
                {"medication_name": "Paracetamol", "dosage": "500 mg", "frequency": "Thrice daily as needed", "duration": "3-5 days", "route": "oral", "purpose": "Fever and chest discomfort relief"},
                {"medication_name": "Steam Inhalation / Warm Saline", "dosage": "2-3 times daily", "frequency": "Daily", "duration": "5 days", "route": "inhalation", "purpose": "Mucus clearance and throat soothing"}
            ],
            "phc_pharmacy_status": "Available under NEML at PHC",
            "icmr_guideline_reference": "ICMR Bronchitis & Respiratory Care Protocol"
        }
    elif "pneumonia" in cond_lower:
        return {
            "prescriptions": [
                {"medication_name": "Amoxicillin", "dosage": "500 mg", "frequency": "Thrice daily", "duration": "7 days", "route": "oral", "purpose": "Antibacterial therapy"},
                {"medication_name": "Paracetamol", "dosage": "500 mg", "frequency": "As needed (max 4x daily)", "duration": "5 days", "route": "oral", "purpose": "Fever and pain relief"}
            ],
            "phc_pharmacy_status": "Available under NEML at PHC",
            "icmr_guideline_reference": "ICMR Pneumonia Treatment Protocol"
        }
    else:
        return {
            "prescriptions": [
                {"medication_name": "Paracetamol", "dosage": "500 mg", "frequency": "Thrice daily", "duration": "5 days", "route": "oral", "purpose": "Symptomatic fever and pain management"},
                {"medication_name": "Dextromethorphan Syrup", "dosage": "10 ml", "frequency": "Thrice daily", "duration": "5 days", "route": "oral", "purpose": "Symptomatic cough relief"},
                {"medication_name": "ORS (Oral Rehydration Salts)", "dosage": "1 sachet in 1L water", "frequency": "Sip frequently", "duration": "3 days", "route": "oral", "purpose": "Hydration and electrolyte balance"}
            ],
            "phc_pharmacy_status": "Available under NEML at PHC",
            "icmr_guideline_reference": "ICMR Primary Care Guidelines"
        }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Main chat endpoint - routes text, image, or audio messages through the ADK agent pipeline.

    Executes Triage -> Diagnose -> Prescribe pipeline deterministically when triage
    is complete or an image/report/audio is provided, mirroring exact legacy API behavior.
    """
    try:
        session_id = request.session_id or f"session_{request.user_id}_{id(request)}"

        # Prepare user input content
        parts = []
        if request.message and request.message.strip():
            parts.append(types.Part(text=request.message))
        elif not request.audio_base64 and not request.image_base64:
            parts.append(types.Part(text="Hello"))

        if request.image_base64:
            clean_base64 = request.image_base64
            mime_type = "image/jpeg"
            if "," in clean_base64:
                header, clean_base64 = clean_base64.split(",", 1)
                if "png" in header:
                    mime_type = "image/png"
                elif "pdf" in header:
                    mime_type = "application/pdf"
            image_bytes = base64.b64decode(clean_base64)
            parts.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

        if request.audio_base64:
            clean_audio = request.audio_base64
            mime_type = "audio/ogg"
            if "," in clean_audio:
                header, clean_audio = clean_audio.split(",", 1)
                if "mp3" in header or "mpeg" in header:
                    mime_type = "audio/mp3"
                elif "wav" in header:
                    mime_type = "audio/wav"
                elif "m4a" in header:
                    mime_type = "audio/m4a"
            audio_bytes = base64.b64decode(clean_audio)
            parts.append(types.Part.from_bytes(data=audio_bytes, mime_type=mime_type))
            parts.append(types.Part(text="[Patient sent a voice audio note. Transcribe the symptoms spoken in the audio and process as patient input in the spoken language.]"))

        user_content = types.Content(role="user", parts=parts)

        # ── Step 1: Run Triage Agent ──────────────────────────────────────────
        triage_runner = Runner(
            agent=triage_agent,
            app_name=APP_NAME,
            session_service=session_service,
        )

        triage_output = ""
        async for event in triage_runner.run_async(
            user_id=request.user_id,
            session_id=session_id,
            new_message=user_content,
        ):
            if event.is_final_response() and event.content and event.content.parts:
                triage_output = "".join(p.text for p in event.content.parts if p.text).strip()

        triage_data = _safe_json_parse(triage_output)

        is_complete = bool(
            (triage_data and triage_data.get("is_assessment_complete")) or request.image_base64
        )
        severity = (triage_data.get("severity_level") if triage_data else "HIGH").upper()
        transfer_target = triage_data.get("transfer_to") if triage_data else "diagnose_agent"

        diagnose_data = None
        prescribe_data = None
        emergency_data = None

        # ── Step 2: Pipeline Escalation / Diagnosis ──────────────────────────
        if is_complete:
            if severity == "CRITICAL" or transfer_target == "emergency_agent":
                # Emergency Agent
                emergency_runner = Runner(
                    agent=emergency_agent,
                    app_name=APP_NAME,
                    session_service=session_service,
                )
                emergency_output = ""
                async for event in emergency_runner.run_async(
                    user_id=request.user_id,
                    session_id=session_id + "_emg",
                    new_message=user_content,
                ):
                    if event.is_final_response() and event.content and event.content.parts:
                        emergency_output = "".join(p.text for p in event.content.parts if p.text).strip()

                emergency_data = _safe_json_parse(emergency_output)
            else:
                # ── Step 2a: Diagnose Agent ─────────────────────────────────
                diagnose_runner = Runner(
                    agent=diagnose_agent,
                    app_name=APP_NAME,
                    session_service=session_service,
                )

                diag_prompt = f"Evaluate case history: Patient symptoms: '{request.message}'. Triage findings: {json.dumps(triage_data or {})}"
                diag_parts = [types.Part(text=diag_prompt)]

                if request.image_base64:
                    clean_base64 = request.image_base64
                    mime_type = "image/jpeg"
                    if "," in clean_base64:
                        header, clean_base64 = clean_base64.split(",", 1)
                        if "png" in header:
                            mime_type = "image/png"
                        elif "pdf" in header:
                            mime_type = "application/pdf"
                    image_bytes = base64.b64decode(clean_base64)
                    diag_parts.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

                diag_content = types.Content(role="user", parts=diag_parts)

                diagnose_output = ""
                async for event in diagnose_runner.run_async(
                    user_id=request.user_id,
                    session_id=session_id + "_diag",
                    new_message=diag_content,
                ):
                    if event.is_final_response() and event.content and event.content.parts:
                        diagnose_output = "".join(p.text for p in event.content.parts if p.text).strip()

                diagnose_data = _safe_json_parse(diagnose_output)

                # ── Step 2b: Prescribe Agent ────────────────────────────────
                if diagnose_data:
                    prescribe_runner = Runner(
                        agent=prescribe_agent,
                        app_name=APP_NAME,
                        session_service=session_service,
                    )

                    presc_prompt = f"Generate treatment protocol for diagnostic report: {json.dumps(diagnose_data)}. Patient age: 30, Allergies: []."
                    presc_content = types.Content(role="user", parts=[types.Part(text=presc_prompt)])

                    prescribe_output = ""
                    async for event in prescribe_runner.run_async(
                        user_id=request.user_id,
                        session_id=session_id + "_presc",
                        new_message=presc_content,
                    ):
                        if event.is_final_response() and event.content and event.content.parts:
                            prescribe_output = "".join(p.text for p in event.content.parts if p.text).strip()

                    prescribe_data = _safe_json_parse(prescribe_output)

                    # Fallback guardrail: if prescribing output is missing/empty/unparseable, use ICMR protocol fallback for primary condition
                    if not prescribe_data or not prescribe_data.get("prescriptions") or len(prescribe_data.get("prescriptions", [])) == 0:
                        primary_cond = diagnose_data.get("primary_diagnosis") or (
                            diagnose_data.get("differential_diagnoses", [{}])[0].get("condition_name", "General Medical Condition")
                        )
                        prescribe_data = _get_fallback_prescription(primary_cond)

        # ── Step 3: Composite Reply Formatting ────────────────────────────────
        reply_sections = []

        # Triage section
        triage_reply = triage_data.get("conversational_reply") if triage_data else triage_output
        if not triage_reply:
            if request.image_base64:
                triage_reply = "Thank you for providing the X-ray image. Submitting your case to Diagnose-Agent for preliminary clinical evaluation..."
            else:
                triage_reply = "Hello! How can I help you today? Please tell me about your symptoms."

        reply_sections.append(f"Triage Assistant:\n{triage_reply}")

        # English translation section (if present and distinct)
        english_trans = triage_data.get("english_translation") if triage_data else ""
        if english_trans and english_trans.strip().lower() != (triage_reply or "").strip().lower():
            reply_sections.append(f"English translation:\n{english_trans}")

        # Emergency section (if present)
        if emergency_data and emergency_data.get("patient_message"):
            reply_sections.append(f"Emergency Assistant:\n{emergency_data['patient_message']}")

        # Diagnose section (if present)
        if diagnose_data:
            primary = diagnose_data.get("primary_diagnosis") or (
                diagnose_data.get("differential_diagnoses", [{}])[0].get("condition_name")
                if diagnose_data.get("differential_diagnoses")
                else None
            )
            confidence = (
                diagnose_data.get("differential_diagnoses", [{}])[0].get("confidence_score")
                if diagnose_data.get("differential_diagnoses")
                else None
            )
            if primary:
                conf_str = f" ({confidence})" if confidence else ""
                reply_sections.append(f"Diagnose-Agent probable diagnosis:\n- {primary}{conf_str}")

        # Prescribe section (if present)
        if prescribe_data and prescribe_data.get("prescriptions"):
            meds = prescribe_data.get("prescriptions", [])
            if meds:
                med_lines = []
                for idx, m in enumerate(meds[:3], 1):
                    name = m.get("medication_name", "")
                    dosage = m.get("dosage", "")
                    freq = m.get("frequency", "")
                    dur = m.get("duration", "")
                    med_lines.append(f"{idx}. {name} - {dosage}, {freq}, {dur}")
                reply_sections.append(f"Prescribe-Agent Suggested Medications:\n" + "\n".join(med_lines))

        final_reply = "\n\n".join(reply_sections)

        last_agent = "prescribe_agent" if prescribe_data else "diagnose_agent" if diagnose_data else "emergency_agent" if emergency_data else "triage_agent"

        return ChatResponse(
            reply=final_reply,
            session_id=session_id,
            agent_name=last_agent,
            handoffs=[
                {"from": "triage_agent", "to": "diagnose_agent"},
                {"from": "diagnose_agent", "to": "prescribe_agent"},
            ] if prescribe_data else [],
            metadata={
                "user_id": request.user_id,
                "triage_data": triage_data,
                "diagnose_data": diagnose_data,
                "prescribe_data": prescribe_data,
            },
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent pipeline error: {str(e)}")


@app.post("/triage")
async def triage_only(request: ChatRequest):
    """Direct triage endpoint - bypasses orchestrator for quick severity check."""
    try:
        session_id = f"triage_{request.user_id}_{id(request)}"
        triage_runner = Runner(
            agent=triage_agent,
            app_name=APP_NAME,
            session_service=session_service,
        )

        content = types.Content(
            role="user",
            parts=[types.Part(text=request.message)],
        )

        final_response = ""
        async for event in triage_runner.run_async(
            user_id=request.user_id,
            session_id=session_id,
            new_message=content,
        ):
            if event.is_final_response() and event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        final_response = part.text.strip()

        return {"success": True, "reply": final_response, "agent": "triage_agent"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
