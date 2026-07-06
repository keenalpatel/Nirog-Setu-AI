# Nirog-Setu AI - Voice-First Rural Healthcare Platform

A multilingual AI healthcare platform for rural India powered by Gemini and Bhashini.

## Prerequisites

- Node.js 18+ 
- npm or pnpm
- Supabase account (database is already configured)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

The `.env` file is already configured with Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DB_URL=your-database-url
```

### 3. Database Setup

The database schema is already migrated. Tables include:
- `patients` - Patient records
- `screenings` - Health screenings with AI agent interactions
- `conversations` - Chat history
- `hospitals` - Healthcare facilities
- `asha_workers` - Community health workers
- `emergencies` - Emergency cases
- `medical_kb` - Medical knowledge base (with vector embeddings)

To seed the database with mock data, visit:
```
http://localhost:3000/api/seed
```
Or make a POST request:
```bash
curl -X POST http://localhost:3000/api/seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

### Dashboard Pages

| Route | Description |
|-------|-------------|
| `/` | Overview dashboard with KPIs, charts, live activity |
| `/screenings` | Health screening records with filters & timeline |
| `/patients` | Patient registry with health history |
| `/emergencies` | Emergency response center with live alerts |
| `/analytics` | Disease surveillance & population health metrics |
| `/asha-workers` | ASHA worker coordination |
| `/hospitals` | Healthcare facility finder |
| `/test-chat` | Simulate patient conversations with AI agents |

### AI Agents

| Agent | Role |
|-------|------|
| Triage Agent | Symptom classification & routing |
| Diagnose Agent | Differential diagnosis with confidence |
| Prescribe Agent | Treatment protocols (ICMR/WHO guidelines) |
| Refer Agent | Hospital finder with bed availability |
| ASHA Agent | Community health worker coordination |
| Emergency Agent | SOS response & ambulance dispatch |

### Supported Languages (10)

- Hindi (हिंदी)
- Bengali (বাংলা)
- Tamil (தமிழ்)
- Telugu (తెలుగు)
- Marathi (मराठी)
- Gujarati (ગુજરાતી)
- Kannada (ಕನ್ನಡ)
- Malayalam (മലയാളം)
- Punjabi (ਪੰਜਾਬੀ)
- Assamese (অসমীয়া)

## Architecture

```
├── app/                    # Next.js 14 App Router
│   ├── (pages)            # Dashboard pages
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/
│   ├── agents/            # Agent status cards
│   ├── dashboard/         # KPI cards, charts
│   ├── layout/            # Sidebar, topbar
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── api.ts             # API client functions
│   ├── supabase.ts        # Supabase client
│   ├── store.ts          # Zustand state
│   └── types.ts          # TypeScript types
└── hooks/                 # Custom React hooks
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/seed` | Seed database with mock data |
| GET | `/api/stats` | Dashboard statistics |

## Build for Production

```bash
npm run build
npm run start
```

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, shadcn/ui
- **Charts**: Recharts
- **State**: Zustand, TanStack Query
- **Database**: Supabase (PostgreSQL + pgvector)
- **Realtime**: Supabase Realtime subscriptions
- **Icons**: Lucide React

## Mock Data Generated

- 500 patients across Bihar & Uttar Pradesh
- 2000 health screenings with varied conditions
- 150 emergency cases
- 50+ ASHA workers
- 30+ hospitals with real coordinates

## License

Built for healthcare accessibility in rural India.
