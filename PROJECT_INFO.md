# NIROG-SETU AI - Complete Project Documentation

## Project Overview

**Name:** Nirog-Setu AI - Voice-First Rural Healthcare Platform  
**Version:** 0.1.0  
**Description:** A multilingual AI healthcare platform for rural India powered by Gemini and Bhashini, offering voice-based healthcare access through intelligent AI agents.

**Target Regions:** Bihar, Uttar Pradesh, and nationwide deployment potential  
**Supported Languages:** 10 Indian languages (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Assamese)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 13.5.1, React 18, TypeScript 5.2.2 |
| Styling | Tailwind CSS 3.3.3 + shadcn/ui components |
| State | Zustand + TanStack Query |
| Charts | Recharts |
| Backend | Next.js API Routes |
| AI Engine | Google Cloud Vertex AI (Gemini 2.5 Flash) |
| Database | Supabase (PostgreSQL + pgvector) |
| Messaging | WhatsApp Business API |
| Translation | Bhashini |
| Maps | Google Maps API |
| Drug Safety | OpenFDA API |
| Medical Codes | UMLS API (ICD-10) |
| Deployment | Netlify / Docker |

---

## NPM Scripts

```json
{
  "dev": "next dev --port 3000 --hostname 0.0.0.0",
  "build": "next build",
  "start": "next start --port 3000 --hostname 0.0.0.0",
  "lint": "next lint",
  "typecheck": "tsc --noEmit"
}
```

---

## Dependencies

### Core
- `@google-cloud/vertexai`: ^1.12.0
- `@google/genai`: ^2.12.0
- `@supabase/supabase-js`: ^2.58.0
- `@tanstack/react-query`: ^5.101.2
- `zustand`: ^5.0.14

### UI (40+ Radix UI components)
- `react`: 18.2.0
- `next`: 13.5.1
- `lucide-react`: ^0.446.0
- `recharts`: ^2.12.7
- `@radix-ui/react-*` (accordion, dialog, dropdown, tabs, etc.)

### Forms & Validation
- `react-hook-form`: ^7.53.0
- `@hookform/resolvers`: ^3.9.0
- `zod`: ^3.23.8

### Utilities
- `date-fns`: ^3.6.0
- `clsx`: ^2.1.1
- `tailwind-merge`: ^2.5.2
- `sonner`: ^1.5.0

---

## AI Agent Architecture

The platform uses a **multi-agent pipeline** where each agent specializes in one healthcare task:

```
Patient Message → Triage Agent → Diagnose Agent → Prescribe Agent
                       ↓                                    ↓
                 Emergency Agent                     Refer Agent
                       ↓                                    ↓
                 108 Ambulance                      ASHA Worker Agent
```

### Agent Details

| Agent | Model | Purpose |
|-------|-------|---------|
| Triage | Gemini 2.5 Flash | Symptom classification, severity routing, multilingual |
| Diagnose | Gemini 2.5 Flash | Differential diagnosis, X-ray analysis, ICD-10 codes |
| Prescribe | Gemini 2.5 Flash + FDA | Treatment protocols (ICMR/WHO), drug safety checks |
| Refer | Gemini 2.5 Flash | Hospital finder, bed availability, doctor schedules |
| Emergency | Gemini 2.5 Flash | Critical detection, 108 ambulance dispatch, first-aid |
| ASHA | Gemini 2.5 Flash | Community health worker coordination, DOTS tracking |

---

## API Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/triage` | Symptom triage & severity classification |
| POST | `/api/diagnose` | Differential diagnosis with confidence scores |
| POST | `/api/prescribe` | Treatment protocols & drug safety |
| POST | `/api/refer` | Hospital finder with bed availability |
| POST | `/api/emergency` | Critical condition detection & ambulance dispatch |
| POST | `/api/asha` | ASHA worker coordination & DOTS tracking |
| POST/GET | `/api/whatsapp` | WhatsApp webhook (incoming messages & responses) |
| POST | `/api/seed` | Seed database with mock data |
| GET | `/api/stats` | Dashboard statistics |

### Key Route Behaviors

**`/api/triage`**
- Accepts: `{ message, imageBase64?, history[] }`
- Uses Gemini 2.5 Flash with structured JSON output
- Responds in patient's language (dynamic multilingual)
- Collects symptoms over 1-2 turns, then marks assessment complete
- Returns: `{ reply, isComplete, detectedLanguage, translation, evaluation }`

**`/api/diagnose`**
- Accepts: `{ history[], imageBase64? }`
- Multimodal: analyzes X-rays, skin lesion images
- Integrates UMLS API for ICD-10 code resolution
- Fallback: NLM Clinical Tables API
- Returns: differential diagnoses with confidence scores

**`/api/prescribe`**
- Accepts: `{ diagnosticReport, patientAge, allergies[] }`
- Cross-references OpenFDA for drug safety
- Follows ICMR/WHO/NTEP treatment guidelines
- Returns: medication prescriptions with dosage, frequency, duration

**`/api/whatsapp`**
- GET: Webhook verification (hub.mode, hub.verify_token, hub.challenge)
- POST: Incoming message processing
- Features:
  - Message deduplication (prevents duplicate responses)
  - Image download from WhatsApp → base64 → Gemini analysis
  - Audio transcription via Gemini 2.5 Flash
  - Conversational closers detection (ok, thanks, bye → closing message)
  - Full pipeline: Triage → Diagnose → Prescribe → Reply

---

## Application Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page with stats & live demo |
| `/login` | Authentication |
| `/dashboard` | Admin KPI cards, charts, live activity |
| `/screenings` | Health screening records with timeline |
| `/patients` | Patient registry & health history |
| `/emergencies` | Live emergency alerts & response tracking |
| `/analytics` | Disease surveillance & population health |
| `/asha-workers` | Community health worker management |
| `/hospitals` | Facility locator with bed availability |
| `/agents/[agent]` | Individual agent performance & logs |
| `/test-chat` | Demo chat interface |
| `/chat` | Patient-facing chat |

---

## Database Schema (Supabase PostgreSQL)

### Tables

#### `patients`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| phone | text | UNIQUE |
| name | text | |
| language | text | Default: 'hi' |
| location_district | text | |
| location_state | text | |
| location_lat | double precision | |
| location_lng | double precision | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `screenings`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| patient_id | UUID | FK → patients |
| language | text | |
| symptoms | text | |
| agent_type | text | triage/diagnose/prescribe/refer/asha/emergency |
| diagnosis | text | |
| confidence_score | double precision | |
| severity | text | low/medium/high/critical |
| status | text | pending/in_progress/completed/escalated |
| raw_audio_url | text | |
| image_url | text | |
| agent_handoffs | JSONB | Array of agent interactions |
| created_at | timestamptz | |

#### `conversations`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| patient_id | UUID | FK → patients |
| screening_id | UUID | FK → screenings |
| messages | JSONB | Array of {role, content, agent_type, timestamp} |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### `hospitals`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| name | text | |
| type | text | Default: 'PHC' |
| location_district | text | |
| location_state | text | |
| location_lat | double precision | |
| location_lng | double precision | |
| specialties | text[] | Array of specialties |
| beds_available | integer | |
| beds_total | integer | |
| contact_phone | text | |
| contact_email | text | |
| created_at | timestamptz | |

#### `asha_workers`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| name | text | |
| phone | text | UNIQUE |
| assigned_district | text | |
| assigned_area | text | |
| active_cases | integer | |
| total_visits | integer | |
| status | text | active/inactive/on_leave |
| created_at | timestamptz | |

#### `emergencies`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| patient_id | UUID | FK → patients |
| screening_id | UUID | FK → screenings |
| symptoms | text | |
| location_lat | double precision | |
| location_lng | double precision | |
| location_address | text | |
| severity | text | low/medium/high/critical |
| status | text | pending/dispatched/in_transit/resolved/cancelled |
| ambulance_dispatched | boolean | Default: false |
| ambulance_eta_minutes | integer | |
| hospital_assigned | UUID | FK → hospitals |
| created_at | timestamptz | |
| resolved_at | timestamptz | |

#### `medical_kb` (RAG Knowledge Base)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary Key |
| title | text | |
| content | text | |
| source | text | Default: 'WHO' |
| category | text | |
| embedding | vector(1536) | pgvector for semantic search |
| created_at | timestamptz | |

**Security:** All tables have Row Level Security (RLS) enabled.

---

## Component Architecture

```
components/
├── providers.tsx              # QueryClient + Theme providers
├── screening-timeline.tsx     # Health screening timeline view
├── layout/
│   ├── app-shell.tsx          # Main layout wrapper
│   ├── sidebar-nav.tsx        # Sidebar navigation
│   └── admin-layout.tsx       # Admin-specific layout
├── dashboard/
│   └── kpi-cards.tsx          # KPI metric cards
├── agents/
│   └── agent-status-card.tsx  # Agent status display
└── ui/                        # 40+ shadcn/ui components
    ├── button.tsx, input.tsx, card.tsx, dialog.tsx
    ├── form.tsx, select.tsx, checkbox.tsx, radio-group.tsx
    ├── table.tsx, tabs.tsx, badge.tsx, avatar.tsx
    ├── toast.tsx, sonner.tsx, tooltip.tsx, progress.tsx
    └── ... (accordion, carousel, calendar, command, etc.)
```

---

## State Management (Zustand)

```typescript
interface AppState {
  language: LanguageCode;              // Current UI language
  sidebarOpen: boolean;                // Sidebar toggle
  theme: 'light' | 'dark' | 'system'; // Theme preference
  notifications: Notification[];       // In-app notifications (max 50)
}
```

Persists `language` and `theme` to localStorage.

---

## Authentication

Hardcoded test users (for prototype):

| Email | Password | Role |
|-------|----------|------|
| niha132@gmail.com | 8998856741 | user |
| keenal143@gmail.com | 8998996741 | admin |

- **Admin:** Access to dashboard, analytics, ASHA workers, hospitals
- **User:** Access to patient chat interface

---

## Environment Variables

```env
# Google Cloud / Vertex AI
GCP_PROJECT_ID=project-3d39fa0c-2d6a-41aa-948
GCP_LOCATION=us-central1

# WhatsApp Business API
WHATSAPP_TOKEN=<your-token>
WHATSAPP_PHONE_NUMBER_ID=1244663088735987
WHATSAPP_VERIFY_TOKEN=whatsapp_verify
WHATSAPP_API_VERSION=v25.0

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# APIs (Optional)
UMLS_API_KEY=<for ICD-10 code lookups>
OPENFDA_API_KEY=<for drug safety checks>

# Internal
INTERNAL_API_URL=http://localhost:3000
```

---

## Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

### Netlify
```toml
[build]
command = "npx next build"
publish = ".next"

[[plugins]]
package = "@netlify/plugin-nextjs"
```

---

## WhatsApp Integration Flow

```
User sends message → Meta Webhook → /api/whatsapp (POST)
                                          │
                                          ├── Deduplication check
                                          ├── Audio? → Gemini transcription
                                          ├── Image? → Download from WhatsApp
                                          ├── Closer? (ok/thanks/bye) → Closing message
                                          │
                                          ├── /api/triage (AI triage)
                                          │       │
                                          │       └── isComplete?
                                          │              │
                                          ├── /api/diagnose (differential diagnosis)
                                          │       │
                                          ├── /api/prescribe (treatment plan)
                                          │
                                          └── Send reply via WhatsApp API
```

---

## UI Theme

- **Color System:** Dark mode (default), Indigo palette
- **Fonts:** Inter (sans), Space Grotesk (display)
- **Animations:** Accordion, slide-in/out
- **Charts:** 5 preset chart color variables for Recharts

---

## Key Features

1. **Multilingual AI Triage** — Responds in patient's language (Hindi, Telugu, Marathi, English, etc.)
2. **Multimodal Diagnosis** — Analyzes X-rays, skin lesion images via Gemini vision
3. **Audio Transcription** — Voice messages transcribed by Gemini and processed as text
4. **Drug Safety** — Cross-references FDA for interactions and contraindications
5. **Emergency Detection** — Automatic 108 ambulance dispatch for critical cases
6. **ASHA Worker Coordination** — DOTS tracking, medication adherence, follow-up scheduling
7. **Hospital Finder** — Nearest facilities with real-time bed availability
8. **WhatsApp Bot** — Full healthcare pipeline accessible via WhatsApp
9. **Message Deduplication** — Prevents duplicate responses from webhook retries
10. **Conversational Closers** — Gracefully ends conversations on "ok", "thanks", "bye"
