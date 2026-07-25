"""
Nirog Setu AI - ADK Agent Service
FastAPI server exposing ADK agents as HTTP endpoints for Cloud Run deployment.
"""

import os
import base64
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

# Import the orchestrator (root agent)
from agents.orchestrator import orchestrator

APP_NAME = "nirog_setu_ai"
session_service = InMemorySessionService()
runner = Runner(
    agent=orchestrator,
    app_name=APP_NAME,
    session_service=session_service,
)


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
    """Incoming patient message."""
    message: str
    user_id: str = "anonymous"
    session_id: str | None = None
    image_base64: str | None = None


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


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Main chat endpoint - routes messages through the ADK agent pipeline.

    This is the primary endpoint called by the Next.js frontend and WhatsApp webhook.
    The orchestrator agent handles routing to specialized sub-agents.
    """
    try:
        # Create or reuse session
        session_id = request.session_id or f"session_{request.user_id}_{id(request)}"

        # Always create a new session for simplicity (InMemorySessionService)
        # For production, use Firestore-based session service for persistence
        try:
            session = await session_service.get_session(
                app_name=APP_NAME,
                user_id=request.user_id,
                session_id=session_id,
            )
            if session is None:
                raise ValueError("Session not found")
        except Exception:
            session = await session_service.create_session(
                app_name=APP_NAME,
                user_id=request.user_id,
                session_id=session_id,
            )

        # Build message content
        parts = [types.Part(text=request.message)]

        # Add image if present
        if request.image_base64:
            clean_base64 = request.image_base64
            mime_type = "image/jpeg"
            if "," in clean_base64:
                header, clean_base64 = clean_base64.split(",", 1)
                if "png" in header:
                    mime_type = "image/png"
                elif "pdf" in header:
                    mime_type = "application/pdf"
            # Blob.data requires bytes, not a base64 string — decode first
            image_bytes = base64.b64decode(clean_base64)
            parts.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

        content = types.Content(role="user", parts=parts)

        # Run the agent pipeline
        final_response = ""
        agent_name = "orchestrator"
        handoffs = []

        async for event in runner.run_async(
            user_id=request.user_id,
            session_id=session_id,
            new_message=content,
        ):
            # Track agent handoffs
            if event.author and event.author != agent_name:
                handoffs.append({
                    "from": agent_name,
                    "to": event.author,
                    "event_id": event.id,
                })
                agent_name = event.author

            # Capture final response
            if event.is_final_response() and event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        final_response = part.text.strip()

        if not final_response:
            final_response = "I'm sorry, I couldn't process your request. Please try again."

        # If response is JSON (legacy format), extract conversational_reply
        if final_response.startswith("{"):
            try:
                import json
                parsed = json.loads(final_response)
                if "conversational_reply" in parsed:
                    final_response = parsed["conversational_reply"]
            except (json.JSONDecodeError, KeyError):
                pass

        return ChatResponse(
            reply=final_response,
            session_id=session_id,
            agent_name=agent_name,
            handoffs=handoffs,
            metadata={
                "user_id": request.user_id,
                "agents_involved": list(set(h["to"] for h in handoffs)),
            },
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent pipeline error: {str(e)}")


@app.post("/triage")
async def triage_only(request: ChatRequest):
    """Direct triage endpoint - bypasses orchestrator for quick severity check."""
    from agents.triage_agent import triage_agent

    try:
        session_id = f"triage_{request.user_id}_{id(request)}"
        triage_runner = Runner(
            agent=triage_agent,
            app_name=APP_NAME,
            session_service=session_service,
        )

        await session_service.create_session(
            app_name=APP_NAME,
            user_id=request.user_id,
            session_id=session_id,
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
