# Nirog Setu AI — ADK Agent Service

FastAPI service built on **Google ADK (Agent Development Kit)**, deployable to **Cloud Run**.
This service **fully replaces** the Next.js `app/api/` routes — all six healthcare agents live
here and are exposed as REST endpoints that the Next.js frontend calls via `next.config.js` rewrites.

---

## Architecture

```
Next.js Frontend (app/chat/page.tsx)
        │  (ADK_SERVICE_URL rewrites in next.config.js)
        ▼
┌─────────────────────────────────────────────────────────┐
│               Cloud Run — ADK FastAPI Service           │
│                                                         │
│  POST /chat        ← full Triage→Diagnose→Prescribe     │
│  POST /triage      ← standalone triage                  │
│  POST /diagnose    ← standalone diagnose                │
│  POST /prescribe   ← standalone prescribe               │
│  POST /asha        ← ASHA worker dispatch               │
│  POST /refer       ← hospital referral                  │
│  POST /emergency   ← 108 SOS dispatch                   │
│  GET  /whatsapp    ← webhook verification               │
│  POST /whatsapp    ← incoming message handler           │
│  GET  /health      ← Cloud Run health probe             │
└───────────┬─────────────────────────────────────────────┘
            │ ADK LlmAgent pipeline
            ▼
┌───────────────────────────────────────┐
│  Orchestrator (nirog_setu_orchestrator)│
│  ├── triage_agent                     │
│  ├── diagnose_agent  ← UMLS/NLM tool  │
│  ├── prescribe_agent ← OpenFDA tool   │
│  ├── refer_agent     ← Google Maps    │
│  ├── emergency_agent ← WhatsApp+Maps  │
│  └── asha_agent      ← WhatsApp tool  │
└───────────────────────────────────────┘
            │ MCP tools
            ▼
┌───────────────────────────────────────┐
│  mcp_server.py (stdio MCP server)     │
│  check_drug_safety    (OpenFDA)       │
│  check_drug_interaction (OpenFDA)     │
│  lookup_icd10_code    (UMLS + NLM)    │
│  find_nearest_hospitals (Google Maps) │
│  send_whatsapp_message (Meta API)     │
└───────────────────────────────────────┘
```

---

## API → ADK Migration Map

| Deleted Next.js route          | ADK endpoint       | Notes                               |
|--------------------------------|--------------------|-------------------------------------|
| `app/api/triage/route.ts`      | `POST /triage`     | Full multi-turn triage, JSON output |
| `app/api/diagnose/route.ts`    | `POST /diagnose`   | ICD-10 lookup + guardrails          |
| `app/api/prescribe/route.ts`   | `POST /prescribe`  | ICMR/NTEP + OpenFDA notice          |
| `app/api/asha/route.ts`        | `POST /asha`       | Regional worker dispatch            |
| `app/api/refer/route.ts`       | `POST /refer`      | Regional PHC referral mapping       |
| `app/api/emergency/route.ts`   | `POST /emergency`  | 108 SOS ticket generation           |
| `app/api/whatsapp/route.ts`    | `GET+POST /whatsapp` | Full webhook + audio transcription |

`app/api/seed/` and `app/api/stats/` are **not** migrated here — they talk directly to Supabase
and should remain in Next.js (no LLM logic).

---

## Environment Variables

```env
# GCP / Vertex AI
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=true   # set automatically when GEMINI_API_KEY is absent

# OR: Direct Gemini API key (for local dev)
GEMINI_API_KEY=your-key

# Optional integrations
UMLS_API_KEY=your-umls-key
GOOGLE_MAPS_API_KEY=your-maps-key
OPENFDA_API_KEY=your-fda-key     # optional, increases rate limits

# WhatsApp Business API
WHATSAPP_TOKEN=your-wa-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-id
WHATSAPP_VERIFY_TOKEN=whatsapp_verify
WHATSAPP_API_VERSION=v25.0
```

---

## Running Locally

```bash
cd adk-agents
pip install -r requirements.txt
python main.py           # starts on :8080
```

## Running the MCP server

```bash
cd adk-agents
python mcp_server.py     # stdio mode — connect via Claude Desktop or ADK agent
```

## Cloud Run Deployment

```bash
cd adk-agents
gcloud run deploy nirog-setu-agents \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID=your-project \
  --port 8080
```

Once deployed, set in your Next.js environment:

```env
ADK_SERVICE_URL=https://nirog-setu-agents-xxxx-uc.a.run.app
```

Next.js `next.config.js` rewrites all `/api/triage`, `/api/diagnose`, etc. calls to the ADK service automatically — no frontend code changes required.
