# Nirog Setu AI - ADK Agent Service

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloud Run (ADK Service)                        │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │              Orchestrator Agent (Root)                      │   │
│  │  Routes patient cases through the pipeline                 │   │
│  └───────────────┬───────────────────────────────────────────┘   │
│                  │                                                │
│  ┌───────┐  ┌───────┐  ┌──────────┐  ┌───────┐  ┌──────────┐  │
│  │Triage │→ │Diagnose│→ │Prescribe │→ │ Refer │→ │  ASHA    │  │
│  │Agent  │  │ Agent  │  │  Agent   │  │ Agent │  │  Agent   │  │
│  └───────┘  └───────┘  └──────────┘  └───────┘  └──────────┘  │
│       │                                                          │
│  ┌──────────┐                                                    │
│  │Emergency │  (activated for CRITICAL severity)                 │
│  │  Agent   │                                                    │
│  └──────────┘                                                    │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                    Shared Tools                             │   │
│  │  • OpenFDA (drug safety)     • UMLS (ICD-10 codes)        │   │
│  │  • Google Maps (hospitals)   • WhatsApp (messaging)        │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          ↕ HTTP
┌─────────────────────────────────────────────────────────────────┐
│            Next.js Frontend (Netlify / Vercel)                    │
│  • Patient chat UI       • Admin dashboard                       │
│  • WhatsApp webhook      • Analytics                             │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
adk-agents/
├── Dockerfile              # Cloud Run container
├── requirements.txt        # Python dependencies
├── main.py                 # FastAPI server + ADK Runner
├── .env.example            # Environment variables template
├── agents/
│   ├── __init__.py
│   ├── orchestrator.py     # Root agent (routes between sub-agents)
│   ├── triage_agent.py     # Symptom classification + severity
│   ├── diagnose_agent.py   # Differential diagnosis + ICD-10
│   ├── prescribe_agent.py  # Treatment protocols + drug safety
│   ├── refer_agent.py      # Hospital finder + referral
│   ├── emergency_agent.py  # 108 ambulance dispatch + first-aid
│   └── asha_agent.py       # ASHA worker coordination + DOTS
└── tools/
    ├── __init__.py
    ├── openfda.py           # FDA drug safety & interactions
    ├── umls.py              # ICD-10 code lookup (UMLS + NLM)
    ├── google_maps.py       # Hospital finder (Places API)
    └── whatsapp.py          # WhatsApp Business messaging
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check for Cloud Run |
| POST | `/chat` | Main chat - routes through full agent pipeline |
| POST | `/triage` | Direct triage only (bypass orchestrator) |

### POST /chat

```json
{
  "message": "mujhe 3 din se bukhar hai",
  "user_id": "918668988741",
  "session_id": "optional-session-id",
  "image_base64": "optional-base64-image"
}
```

Response:
```json
{
  "reply": "Agent response in patient's language",
  "session_id": "session_918668988741_12345",
  "agent_name": "triage_agent",
  "handoffs": [
    {"from": "orchestrator", "to": "triage_agent", "event_id": "evt_1"}
  ],
  "metadata": {
    "user_id": "918668988741",
    "agents_involved": ["triage_agent"]
  }
}
```

## Local Development

```bash
cd adk-agents
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your values

# Run locally
python main.py
# Server starts at http://localhost:8080
```

## Deploy to Cloud Run

```bash
# Option 1: Using deploy script
chmod +x deploy.sh
./deploy.sh

# Option 2: Using Cloud Build
gcloud builds submit --config=cloudbuild.yaml

# Option 3: Direct gcloud deploy
cd adk-agents
gcloud run deploy nirog-setu-adk-agents \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

## Key Design Decisions

1. **ADK `sub_agents` pattern** - Orchestrator uses `sub_agents` for automatic agent routing instead of manual API calls between Next.js routes.

2. **Session-based context** - ADK's `InMemorySessionService` maintains conversation state across turns (solves the "no history" problem from the Next.js implementation).

3. **Tools as Python functions** - OpenFDA, UMLS, Google Maps, WhatsApp are plain async functions that ADK wraps as `FunctionTool` automatically.

4. **Structured output** - Each agent produces JSON with a `transfer_to` field that the orchestrator uses for routing decisions.

5. **Cloud Run deployment** - Stateless container with auto-scaling. Session state is in-memory per instance (upgrade to Firestore for production persistence).
