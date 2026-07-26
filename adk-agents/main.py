"""
Nirog Setu AI - ADK Agent Service
FastAPI server exposing ADK agents as HTTP endpoints for Cloud Run deployment.

Replaces all Next.js app/api/* routes:
  /api/triage      → POST /triage   (also embedded in POST /chat pipeline)
  /api/diagnose    → POST /diagnose (also embedded in POST /chat pipeline)
  /api/prescribe   → POST /prescribe
  /api/asha        → POST /asha
  /api/refer       → POST /refer
  /api/emergency   → POST /emergency
  /api/whatsapp    → GET /whatsapp  (webhook verify)
                     POST /whatsapp (webhook receive)
  /api/seed        → proxied to Supabase (unchanged logic)
  /api/stats       → proxied to Supabase (unchanged logic)
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

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

load_dotenv()

# Import all specialized agents and orchestrator
from agents.orchestrator import orchestrator
from agents.triage_agent import triage_agent
from agents.diagnose_agent import diagnose_agent, sanitize_diagnose_output
from agents.prescribe_agent import prescribe_agent
from agents.refer_agent import refer_agent, build_referral_response
from agents.emergency_agent import emergency_agent, build_emergency_payload
from agents.asha_agent import asha_agent, build_asha_dispatch
from tools.openfda import check_drug_safety
from tools.whatsapp import send_whatsapp_message, download_whatsapp_media, transcribe_whatsapp_audio

APP_NAME = "nirog_setu_ai"
session_service = InMemorySessionService()


async def _ensure_session(user_id: str, session_id: str) -> None:
    """Create a session if it doesn't already exist.

    ADK's InMemorySessionService raises 'Session not found' when run_async is
    called with a session_id that was never created.  This helper is idempotent:
    calling it on an already-existing session is a no-op.
    """
    try:
        await session_service.get_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )
    except Exception:
        # Session does not exist — create it now
        await session_service.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )

WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "whatsapp_verify")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")

# In-memory deduplication set for WhatsApp messages (mirrors route.ts processedMessages)
_processed_wa_messages: set[str] = set()
_MAX_WA_CACHE = 1000


def _is_wa_message_processed(message_id: str) -> bool:
    if message_id in _processed_wa_messages:
        return True
    _processed_wa_messages.add(message_id)
    if len(_processed_wa_messages) > _MAX_WA_CACHE:
        _processed_wa_messages.pop()
    return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    print("🏥 Nirog Setu AI ADK Service starting...")
    print(f"   GCP Project: {os.getenv('GCP_PROJECT_ID', 'not set')}")
    print("   Agents: triage, diagnose, prescribe, refer, emergency, asha")
    print("   Orchestrator: nirog_setu_orchestrator")
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


# ─── Request / Response Models ────────────────────────────────────────────────


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


class AshaRequest(BaseModel):
    patient_name: str = "Patient"
    patient_lang: str = "Hindi"
    location: str = ""
    primary_diagnosis: str = ""
    urgency_level: str = "HIGH"


class ReferRequest(BaseModel):
    patient_lang: str = "English"
    urgency_level: str = "HIGH"
    required_specialty: str = ""


class EmergencyRequest(BaseModel):
    patient_name: str = "Patient"
    patient_lang: str = "Hindi"
    primary_diagnosis: str = ""


class DiagnoseRequest(BaseModel):
    history: list[dict] = []
    image_base64: str | None = None


class PrescribeRequest(BaseModel):
    diagnostic_report: dict | None = None
    # Also accept camelCase from frontend
    diagnosticReport: dict | None = None
    patient_age: int = 30
    patientAge: int | None = None
    allergies: list[str] = []


# ─── Helpers ──────────────────────────────────────────────────────────────────


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
    """Standard ICMR/NTEP guideline prescriptions as a safety fallback."""
    cond_lower = (condition_name or "").lower()
    if "tuberculosis" in cond_lower or "tb" in cond_lower:
        return {
            "prescriptions": [
                {"medication_name": "Rifampicin",   "dosage": "600 mg",   "frequency": "Once daily",             "duration": "9-12 months", "route": "oral", "purpose": "First-line anti-TB bactericidal antibiotic"},
                {"medication_name": "Isoniazid",    "dosage": "300 mg",   "frequency": "Once daily",             "duration": "9-12 months", "route": "oral", "purpose": "First-line anti-TB antibiotic"},
                {"medication_name": "Pyrazinamide", "dosage": "1500 mg",  "frequency": "Once daily",             "duration": "2 months",    "route": "oral", "purpose": "Intensive phase sterilizing anti-TB drug"},
            ],
            "phc_pharmacy_status": "Available under NTEP at PHC",
            "icmr_guideline_reference": "NTEP Guidelines 2025",
        }
    elif "bronchitis" in cond_lower or "cough" in cond_lower or "cold" in cond_lower:
        return {
            "prescriptions": [
                {"medication_name": "Dextromethorphan Syrup",        "dosage": "10 ml",               "frequency": "Thrice daily",          "duration": "5 days",   "route": "oral",       "purpose": "Cough suppression and airway relief"},
                {"medication_name": "Paracetamol",                   "dosage": "500 mg",              "frequency": "Thrice daily as needed","duration": "3-5 days", "route": "oral",       "purpose": "Fever and chest discomfort relief"},
                {"medication_name": "Steam Inhalation / Warm Saline","dosage": "2-3 times daily",     "frequency": "Daily",                 "duration": "5 days",   "route": "inhalation", "purpose": "Mucus clearance and throat soothing"},
            ],
            "phc_pharmacy_status": "Available under NEML at PHC",
            "icmr_guideline_reference": "ICMR Bronchitis & Respiratory Care Protocol",
        }
    elif "pneumonia" in cond_lower:
        return {
            "prescriptions": [
                {"medication_name": "Amoxicillin", "dosage": "500 mg", "frequency": "Thrice daily",          "duration": "7 days",   "route": "oral", "purpose": "Antibacterial therapy"},
                {"medication_name": "Paracetamol", "dosage": "500 mg", "frequency": "As needed (max 4x/day)","duration": "5 days",   "route": "oral", "purpose": "Fever and pain relief"},
            ],
            "phc_pharmacy_status": "Available under NEML at PHC",
            "icmr_guideline_reference": "ICMR Pneumonia Treatment Protocol",
        }
    else:
        return {
            "prescriptions": [
                {"medication_name": "Paracetamol",                 "dosage": "500 mg",           "frequency": "Thrice daily",   "duration": "5 days",   "route": "oral", "purpose": "Symptomatic fever and pain management"},
                {"medication_name": "Dextromethorphan Syrup",      "dosage": "10 ml",            "frequency": "Thrice daily",   "duration": "5 days",   "route": "oral", "purpose": "Symptomatic cough relief"},
                {"medication_name": "ORS (Oral Rehydration Salts)","dosage": "1 sachet in 1L water","frequency": "Sip frequently","duration": "3 days",  "route": "oral", "purpose": "Hydration and electrolyte balance"},
            ],
            "phc_pharmacy_status": "Available under NEML at PHC",
            "icmr_guideline_reference": "ICMR Primary Care Guidelines",
        }


def _decode_image_part(image_base64: str) -> types.Part:
    """Decode a base64 image string (with or without data-URI header) into an ADK Part."""
    clean = image_base64
    mime_type = "image/jpeg"
    if "," in clean:
        header, clean = clean.split(",", 1)
        if "png" in header:
            mime_type = "image/png"
        elif "pdf" in header:
            mime_type = "application/pdf"
    image_bytes = base64.b64decode(clean)
    return types.Part.from_bytes(data=image_bytes, mime_type=mime_type)


# ─── Health check ─────────────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint for Cloud Run."""
    return HealthResponse(
        status="healthy",
        service="nirog-setu-adk-agents",
        agents=["triage", "diagnose", "prescribe", "refer", "emergency", "asha"],
    )


# ─── /chat — full pipeline ────────────────────────────────────────────────────


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Main chat endpoint — routes text, image, or audio messages through the ADK agent pipeline.

    Executes Triage → Diagnose → Prescribe pipeline deterministically when triage
    is complete or an image/report/audio is provided, mirroring exact legacy API behavior.
    """
    try:
        session_id = request.session_id or f"session_{request.user_id}_{id(request)}"

        # Prepare user input content
        parts: list[types.Part] = []
        if request.message and request.message.strip():
            parts.append(types.Part(text=request.message))
        elif not request.audio_base64 and not request.image_base64:
            parts.append(types.Part(text="Hello"))

        if request.image_base64:
            parts.append(_decode_image_part(request.image_base64))

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

        # ── Step 1: Run Triage Agent ───────────────────────────────────────────
        triage_runner = Runner(
            agent=triage_agent,
            app_name=APP_NAME,
            session_service=session_service,
        )

        await _ensure_session(request.user_id, session_id)
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

        diagnose_data: dict | None = None
        prescribe_data: dict | None = None
        emergency_data: dict | None = None

        # ── Step 2: Pipeline Escalation / Diagnosis ───────────────────────────
        if is_complete:
            if severity == "CRITICAL" or transfer_target == "emergency_agent":
                # Emergency Agent
                emergency_runner = Runner(
                    agent=emergency_agent,
                    app_name=APP_NAME,
                    session_service=session_service,
                )
                await _ensure_session(request.user_id, session_id + "_emg")
                emergency_output = ""
                async for event in emergency_runner.run_async(
                    user_id=request.user_id,
                    session_id=session_id + "_emg",
                    new_message=user_content,
                ):
                    if event.is_final_response() and event.content and event.content.parts:
                        emergency_output = "".join(p.text for p in event.content.parts if p.text).strip()

                emergency_data = _safe_json_parse(emergency_output)
                # Guarantee fallback SOS payload if LLM fails
                if not emergency_data or not emergency_data.get("sos_ticket_id"):
                    emergency_data = build_emergency_payload(
                        patient_name="Patient",
                        primary_diagnosis=triage_data.get("dynamic_diagnosis", "Unknown") if triage_data else "Unknown",
                    )
            else:
                # ── Step 2a: Diagnose Agent ────────────────────────────────────
                diagnose_runner = Runner(
                    agent=diagnose_agent,
                    app_name=APP_NAME,
                    session_service=session_service,
                )

                diag_prompt = (
                    f"Evaluate case history: Patient symptoms: '{request.message}'. "
                    f"Triage findings: {json.dumps(triage_data or {})}"
                )
                diag_parts: list[types.Part] = [types.Part(text=diag_prompt)]
                if request.image_base64:
                    diag_parts.append(_decode_image_part(request.image_base64))

                diag_content = types.Content(role="user", parts=diag_parts)

                await _ensure_session(request.user_id, session_id + "_diag")
                diagnose_output = ""
                async for event in diagnose_runner.run_async(
                    user_id=request.user_id,
                    session_id=session_id + "_diag",
                    new_message=diag_content,
                ):
                    if event.is_final_response() and event.content and event.content.parts:
                        diagnose_output = "".join(p.text for p in event.content.parts if p.text).strip()

                diagnose_data = _safe_json_parse(diagnose_output)
                # Apply post-processing guardrails (mirrors diagnose/route.ts logic)
                if diagnose_data:
                    diagnose_data = sanitize_diagnose_output(diagnose_data, history_text=request.message)

                # ── Step 2b: Prescribe Agent ───────────────────────────────────
                if diagnose_data:
                    prescribe_runner = Runner(
                        agent=prescribe_agent,
                        app_name=APP_NAME,
                        session_service=session_service,
                    )

                    # Extract only the English clinical fields — prevents multilingual
                    # text from causing the model to switch language / emit non-JSON.
                    clinical_summary = {
                        "primary_diagnosis": diagnose_data.get("primary_diagnosis", ""),
                        "differential_diagnoses": diagnose_data.get("differential_diagnoses", []),
                        "triage_urgency_level": diagnose_data.get("triage_urgency_level", ""),
                        "required_followup_tests": diagnose_data.get("required_followup_tests", []),
                    }
                    presc_prompt = (
                        f"Generate treatment protocol for the following clinical diagnosis. "
                        f"Respond with valid JSON only, in English.\n"
                        f"Diagnostic report: {json.dumps(clinical_summary)}. "
                        f"Patient age: 30, Allergies: []."
                    )
                    presc_content = types.Content(role="user", parts=[types.Part(text=presc_prompt)])

                    await _ensure_session(request.user_id, session_id + "_presc")
                    prescribe_output = ""
                    async for event in prescribe_runner.run_async(
                        user_id=request.user_id,
                        session_id=session_id + "_presc",
                        new_message=presc_content,
                    ):
                        if event.is_final_response() and event.content and event.content.parts:
                            prescribe_output = "".join(p.text for p in event.content.parts if p.text).strip()

                    prescribe_data = _safe_json_parse(prescribe_output)

                    # Fallback guardrail: use ICMR protocol if output is missing/empty
                    if not prescribe_data or not prescribe_data.get("prescriptions") or len(prescribe_data.get("prescriptions", [])) == 0:
                        primary_cond = diagnose_data.get("primary_diagnosis") or (
                            diagnose_data.get("differential_diagnoses", [{}])[0].get("condition_name", "General Medical Condition")
                        )
                        prescribe_data = _get_fallback_prescription(primary_cond)

        # ── Step 3: Composite Reply Formatting ────────────────────────────────
        reply_sections: list[str] = []

        triage_reply = triage_data.get("conversational_reply") if triage_data else triage_output
        if not triage_reply:
            if request.image_base64:
                triage_reply = "Thank you for providing the X-ray image. Submitting your case to Diagnose-Agent for preliminary clinical evaluation..."
            else:
                triage_reply = "Hello! How can I help you today? Please tell me about your symptoms."
        reply_sections.append(f"Triage Assistant:\n{triage_reply}")

        english_trans = triage_data.get("english_translation") if triage_data else ""
        if english_trans and english_trans.strip().lower() != (triage_reply or "").strip().lower():
            reply_sections.append(f"English translation:\n{english_trans}")

        if emergency_data and emergency_data.get("patient_message"):
            reply_sections.append(f"Emergency Assistant:\n{emergency_data['patient_message']}")

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
                reply_sections.append("Prescribe-Agent Suggested Medications:\n" + "\n".join(med_lines))

        final_reply = "\n\n".join(reply_sections)
        last_agent = (
            "prescribe_agent" if prescribe_data
            else "diagnose_agent" if diagnose_data
            else "emergency_agent" if emergency_data
            else "triage_agent"
        )

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


# ─── /triage — direct endpoint ────────────────────────────────────────────────


@app.post("/triage")
async def triage_only(request: ChatRequest):
    """Direct triage endpoint — mirrors app/api/triage/route.ts."""
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

        await _ensure_session(request.user_id, session_id)
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

        parsed = _safe_json_parse(final_response) or {}
        return {
            "success": True,
            "reply": parsed.get("conversational_reply", final_response),
            "isComplete": parsed.get("is_assessment_complete", False),
            "detectedLanguage": parsed.get("detected_language", ""),
            "translation": parsed.get("english_translation", ""),
            "evaluation": {
                "condition": parsed.get("dynamic_diagnosis", "Under Evaluation"),
                "severity": parsed.get("severity_level", "low"),
                "rationale": parsed.get("clinical_rationale", ""),
            },
            "agent": "triage_agent",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── /diagnose — direct endpoint ─────────────────────────────────────────────


@app.post("/diagnose")
async def diagnose_only(request: DiagnoseRequest):
    """Direct diagnose endpoint — mirrors app/api/diagnose/route.ts.

    Accepts conversation history + optional base64 image.
    Runs diagnose_agent and applies post-processing guardrails.
    """
    try:
        session_id = f"diag_anon_{id(request)}"
        diagnose_runner = Runner(
            agent=diagnose_agent,
            app_name=APP_NAME,
            session_service=session_service,
        )

        history_text = " ".join(
            m.get("content", "") for m in request.history if isinstance(m.get("content"), str)
        )
        diag_parts: list[types.Part] = [
            types.Part(text=f"Evaluate this case history: {json.dumps(request.history, ensure_ascii=False)}")
        ]
        if request.image_base64:
            diag_parts.append(_decode_image_part(request.image_base64))

        diag_content = types.Content(role="user", parts=diag_parts)

        await _ensure_session("anon", session_id)
        diagnose_output = ""
        async for event in diagnose_runner.run_async(
            user_id="anon",
            session_id=session_id,
            new_message=diag_content,
        ):
            if event.is_final_response() and event.content and event.content.parts:
                diagnose_output = "".join(p.text for p in event.content.parts if p.text).strip()

        diagnose_data = _safe_json_parse(diagnose_output)
        if not diagnose_data:
            raise HTTPException(status_code=500, detail="Diagnose-Agent returned no parseable output.")

        # Apply post-processing guardrails (mirrors diagnose/route.ts)
        diagnose_data = sanitize_diagnose_output(diagnose_data, history_text=history_text)

        return {"success": True, "report": diagnose_data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagnostic execution failure: {str(e)}")


# ─── /prescribe — direct endpoint ────────────────────────────────────────────


@app.post("/prescribe")
async def prescribe_only(request: PrescribeRequest):
    """Direct prescribe endpoint — mirrors app/api/prescribe/route.ts."""
    try:
        # Accept both snake_case and camelCase field names
        report = request.diagnostic_report or request.diagnosticReport
        age = request.patientAge if request.patientAge is not None else request.patient_age

        if not report:
            raise HTTPException(status_code=400, detail="diagnosticReport is required")

        session_id = f"presc_anon_{id(request)}"
        prescribe_runner = Runner(
            agent=prescribe_agent,
            app_name=APP_NAME,
            session_service=session_service,
        )

        clinical_summary = {
            "primary_diagnosis": report.get("primary_diagnosis", ""),
            "differential_diagnoses": report.get("differential_diagnoses", []),
            "triage_urgency_level": report.get("triage_urgency_level", ""),
            "required_followup_tests": report.get("required_followup_tests", []),
        }
        presc_prompt = (
            f"Generate treatment protocol for the following clinical diagnosis. "
            f"Respond with valid JSON only, in English.\n"
            f"Diagnostic report: {json.dumps(clinical_summary)}. "
            f"Patient age: {age}, Allergies: {json.dumps(request.allergies)}."
        )
        presc_content = types.Content(role="user", parts=[types.Part(text=presc_prompt)])

        await _ensure_session("anon", session_id)
        prescribe_output = ""
        async for event in prescribe_runner.run_async(
            user_id="anon",
            session_id=session_id,
            new_message=presc_content,
        ):
            if event.is_final_response() and event.content and event.content.parts:
                prescribe_output = "".join(p.text for p in event.content.parts if p.text).strip()

        prescribe_data = _safe_json_parse(prescribe_output)
        if not prescribe_data or not prescribe_data.get("prescriptions") or len(prescribe_data.get("prescriptions", [])) == 0:
            primary_cond = report.get("primary_diagnosis") or (
                (report.get("differential_diagnoses") or [{}])[0].get("condition_name", "General Medical Condition")
            )
            prescribe_data = _get_fallback_prescription(primary_cond)

        # Dynamic FDA safety notice for primary drug (mirrors route.ts step 4)
        primary_drug = prescribe_data.get("prescriptions", [{}])[0].get("medication_name", "")
        fda_notice = None
        if primary_drug:
            try:
                fda_data = await check_drug_safety(primary_drug)
                warning = (fda_data or {}).get("warnings_excerpt") or None
                if warning:
                    fda_notice = warning[:280] + "..." if len(warning) > 280 else warning
            except Exception:
                pass

        return {
            "success": True,
            "prescription": {
                **prescribe_data,
                "fda_safety_notice": fda_notice,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prescription execution failed: {str(e)}")


# ─── /asha — direct endpoint ──────────────────────────────────────────────────


@app.post("/asha")
async def asha_dispatch(request: AshaRequest):
    """ASHA worker dispatch — mirrors app/api/asha/route.ts."""
    try:
        payload = build_asha_dispatch(
            patient_name=request.patient_name,
            patient_lang=request.patient_lang,
            primary_diagnosis=request.primary_diagnosis,
            urgency_level=request.urgency_level,
        )
        return {"success": True, "ashaDispatch": payload}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── /refer — direct endpoint ─────────────────────────────────────────────────


@app.post("/refer")
async def refer_patient(request: ReferRequest):
    """Referral endpoint — mirrors app/api/refer/route.ts."""
    try:
        payload = build_referral_response(
            patient_lang=request.patient_lang,
            urgency_level=request.urgency_level,
            required_specialty=request.required_specialty,
        )
        return {"success": True, "referral": payload}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── /emergency — direct endpoint ─────────────────────────────────────────────


@app.post("/emergency")
async def emergency_dispatch(request: EmergencyRequest):
    """Emergency 108 dispatch — mirrors app/api/emergency/route.ts."""
    try:
        payload = build_emergency_payload(
            patient_name=request.patient_name,
            primary_diagnosis=request.primary_diagnosis,
        )
        return {
            "success": True,
            "reply": payload["patient_message"],
            "emergency": payload,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── /whatsapp — webhook ──────────────────────────────────────────────────────


@app.get("/whatsapp")
async def whatsapp_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
):
    """WhatsApp webhook verification — mirrors app/api/whatsapp/route.ts GET."""
    if hub_mode == "subscribe" and hub_verify_token == WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(hub_challenge or "")
    return PlainTextResponse("Verification failed", status_code=403)


@app.post("/whatsapp")
async def whatsapp_webhook(raw_request: Request):
    """WhatsApp incoming message webhook — mirrors app/api/whatsapp/route.ts POST.

    Parses the webhook, deduplicates, fires off background processing,
    and returns 200 immediately to prevent Meta retries.
    """
    try:
        body = await raw_request.json()
    except Exception:
        return {"success": True, "ignored": True}

    incoming = _parse_whatsapp_webhook(body)
    if not incoming:
        return {"success": True, "ignored": True}

    if incoming.get("message_id") and _is_wa_message_processed(incoming["message_id"]):
        return {"success": True, "deduplicated": True}

    asyncio.create_task(_process_whatsapp_message(incoming))
    return {"success": True, "acknowledged": True}


def _parse_whatsapp_webhook(body: dict) -> dict | None:
    """Parse WhatsApp webhook body into a normalised dict."""
    message = (
        body.get("entry", [{}])[0]
        .get("changes", [{}])[0]
        .get("value", {})
        .get("messages", [{}])[0]
    )
    metadata = (
        body.get("entry", [{}])[0]
        .get("changes", [{}])[0]
        .get("value", {})
        .get("metadata", {})
    )
    if not message:
        return None

    msg_type = message.get("type", "")
    parsed = {
        "from": message.get("from", ""),
        "phone_number_id": metadata.get("phone_number_id"),
        "message_text": "",
        "has_attachment": False,
        "media_id": None,
        "message_id": message.get("id", ""),
    }

    if msg_type == "text":
        parsed["message_text"] = message.get("text", {}).get("body", "")
    elif msg_type == "image":
        parsed["message_text"] = message.get("image", {}).get("caption", "Patient sent an X-ray/medical image for diagnosis.")
        parsed["has_attachment"] = True
        parsed["media_id"] = message.get("image", {}).get("id")
    elif msg_type == "audio":
        parsed["message_text"] = "Patient sent an audio message via WhatsApp."
        parsed["has_attachment"] = True
        parsed["media_id"] = message.get("audio", {}).get("id")
    else:
        parsed["message_text"] = f"Received a WhatsApp {msg_type} message."
        parsed["has_attachment"] = msg_type != "text"

    return parsed


async def _process_whatsapp_message(incoming: dict) -> None:
    """Background processor — mirrors app/api/whatsapp/route.ts processWhatsappMessage."""
    try:
        message_text: str = incoming["message_text"]
        image_base64: str | None = None

        # Download image or transcribe audio
        if incoming.get("has_attachment") and incoming.get("media_id"):
            if "audio message" in message_text:
                transcription = await transcribe_whatsapp_audio(incoming["media_id"])
                if transcription:
                    message_text = transcription
                    incoming["has_attachment"] = False
            else:
                result = await download_whatsapp_media(incoming["media_id"])
                if result:
                    raw_bytes, mime = result
                    b64 = base64.b64encode(raw_bytes).decode()
                    image_base64 = f"data:{mime};base64,{b64}"

        # Conversational closer detection
        closer_pattern = re.compile(
            r'^(ok|okay|alright|thanks|thank you|thankyou|dhanyavad|shukriya|bye|theek hai|thik hai|accha|got it|noted|hmm|haan|ji|good)\s*[.!]?$',
            re.IGNORECASE,
        )
        if closer_pattern.match(message_text.strip()):
            reply = "Thank you for using Nirog Setu AI. If you need medical assistance in the future, feel free to message anytime. Take care! 🙏"
            phone_id = incoming.get("phone_number_id") or WHATSAPP_PHONE_NUMBER_ID
            if phone_id:
                await send_whatsapp_message(incoming["from"], reply)
            return

        # Build and run the agent pipeline via /chat internally
        session_id = f"wa_{incoming['from']}"
        chat_req = ChatRequest(
            message=message_text,
            user_id=incoming["from"],
            session_id=session_id,
            image_base64=image_base64,
        )

        chat_resp = await chat(chat_req)
        whatsapp_reply = chat_resp.reply if chat_resp.reply else _whatsapp_greeting_fallback(message_text)

        phone_id = incoming.get("phone_number_id") or WHATSAPP_PHONE_NUMBER_ID
        if phone_id:
            await send_whatsapp_message(incoming["from"], whatsapp_reply)

    except Exception as e:
        print(f"[WhatsApp] Background processing error: {e}")


def _whatsapp_greeting_fallback(message_text: str) -> str:
    greeting_pattern = re.compile(
        r'^(hello|hi|hey|namaste|pranam|greetings|hola|good morning|good evening|good afternoon)\b',
        re.IGNORECASE,
    )
    if greeting_pattern.match(message_text.strip()):
        return (
            "Hello! Welcome to Nirog-Setu AI health assistant. 🙏\n\n"
            "How can I assist you with your health today? Please describe any symptoms "
            "you are experiencing (such as fever, cough, chest pain, or headache) so I can guide you."
        )
    return "Hello! Welcome to Nirog-Setu AI. We received your message. Please describe your symptoms in detail so our medical AI team can assist you."


# ─── Startup ──────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
