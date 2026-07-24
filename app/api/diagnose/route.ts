import { NextResponse } from 'next/server';
import { VertexAI, FunctionDeclarationSchemaType } from '@google-cloud/vertexai';

export const maxDuration = 30;

const projectId = process.env.GCP_PROJECT_ID || 'project-ad67eb63-a729-4ed5-a89d';
const location = process.env.GCP_LOCATION || 'us-central1';

const vertexAI = new VertexAI({ project: projectId, location });

// Helper function to sanitize condition terms before calling APIs
function cleanConditionTerm(term: string): string {
  return term
    .replace(/\(.*?\)/g, '') // Strips parenthetical text like (High), (Moderate)
    .replace(/high|moderate|low|acute|severe|chronic/gi, '') // Strips severity descriptors
    .replace(/[^a-zA-Z\s]/g, '') // Strips non-alphanumeric symbols
    .trim();
}

// ── 1. UMLS METATHESAURUS REST API ─────────────────────────────────────
async function fetchICD10WithUMLS(conditionName: string): Promise<{ icd_10_code: string; canonical_name: string } | null> {
  const apiKey = process.env.UMLS_API_KEY;
  if (!apiKey) return null;

  try {
    const cleanTerm = cleanConditionTerm(conditionName);
    const url = `https://uts-ws.nlm.nih.gov/rest/search/current?string=${encodeURIComponent(cleanTerm)}&sabs=ICD10CM&returnIdType=sourceUi&apiKey=${apiKey}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    const results = data.result?.results;

    if (results && results.length > 0) {
      // Prioritize standard Respiratory codes starting with 'J'
      const primaryRespiratory = results.find((r: any) => r.ui && r.ui.startsWith('J'));
      const match = primaryRespiratory || results[0];

      return {
        icd_10_code: match.ui,
        canonical_name: match.name,
      };
    }
    return null;
  } catch (err) {
    console.warn('[UMLS API Warning] Lookup failed:', err);
    return null;
  }
}

// ── 2. NLM CLINICAL TABLE API (Fallback) ──────────────────────────────
async function validateICD10WithNLM(conditionName: string): Promise<{ icd_10_code: string; canonical_name: string } | null> {
  try {
    const cleanTerm = cleanConditionTerm(conditionName);
    const url = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(cleanTerm)}&maxList=10`;
    
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    const matches = data[3];

    if (matches && matches.length > 0) {
      // Filter for J-codes (J00-J99 covers standard respiratory diseases)
      const primaryRespiratoryCode = matches.find((m: string[]) => m[0].startsWith('J'));
      const [icdCode, canonicalName] = primaryRespiratoryCode || matches[0];

      return { icd_10_code: icdCode, canonical_name: canonicalName };
    }
    return null;
  } catch (err) {
    console.warn('[NLM API Warning] Lookup failed:', err);
    return null;
  }
}

// ── MAIN POST ROUTE ────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { history = [], imageBase64 } = await request.json();

    const responseSchema = {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        primary_diagnosis: { type: FunctionDeclarationSchemaType.STRING },
        differential_diagnoses: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: {
            type: FunctionDeclarationSchemaType.OBJECT,
            properties: {
              condition_name: { type: FunctionDeclarationSchemaType.STRING },
              confidence_score: { type: FunctionDeclarationSchemaType.STRING },
              clinical_rationale: { type: FunctionDeclarationSchemaType.STRING },
              icd_10_code: { type: FunctionDeclarationSchemaType.STRING },
            },
            required: ['condition_name', 'confidence_score', 'clinical_rationale'],
          },
        },
        required_followup_tests: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: {
            type: FunctionDeclarationSchemaType.STRING,
          },
        },
        patient_action_plan: { type: FunctionDeclarationSchemaType.STRING },
        triage_urgency_level: { type: FunctionDeclarationSchemaType.STRING },
      },
      required: [
        'primary_diagnosis',
        'differential_diagnoses',
        'required_followup_tests',
        'patient_action_plan',
        'triage_urgency_level',
      ],
    };

    const generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
      systemInstruction: {
        role: 'system',
        parts: [
          {
            text: `You are Diagnose-Agent for Nirog-Setu AI.
Evaluate patient symptom history and attached medical images (e.g. Chest X-rays).
Provide clear differential diagnoses under Primary Health Centre (PHC) guidelines.

TRIAGE URGENCY LEVEL GUIDELINES (triage_urgency_level):
1. CRITICAL: Reserve strictly for immediate life-threatening conditions (e.g., massive hemoptysis/coughing large amounts of blood, severe chest pain, shortness of breath at rest, cyanosis, unconsciousness).
2. HIGH: Minor/occasional blood-tinged sputum or trace blood while coughing slowly/dryly, high fever (>102°F) for several days without respiratory collapse, or moderate respiratory distress. This requires PHC Doctor referral & ASHA Visit, but NOT 108 Emergency Ambulance dispatch.
3. MODERATE: Mild cold, low-grade fever, sore throat, or routine mild symptoms.
4. LOW: Informational or general hygiene queries.

CRITICAL FORMATTING:
- Do NOT append urgency levels or brackets like '(High)' into condition_name or primary_diagnosis. Output clean standard condition names (e.g. 'Bacterial Pneumonia', 'Acute Bronchitis').
- Always include standard WHO/ICD-10 primary category codes (e.g., J18.9 for Pneumonia).
- Keep clinical rationales concise and punchy (under 2-3 sentences per condition).`,
          },
        ],
      },
    });

    const promptParts: any[] = [
      { text: `Evaluate this case history: ${JSON.stringify(history, null, 2)}` },
    ];

    if (imageBase64 && typeof imageBase64 === 'string') {
      const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+-]+;base64,/, '').trim();

      if (cleanBase64) {
        promptParts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType,
          },
        });
      }
    }

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: promptParts }],
    });

    let responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Received empty response from Vertex AI engine.');
    }

    responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const diagnosticReport = JSON.parse(responseText);

    // Dynamic ICD-10 Resolution Pipeline: UMLS API -> NLM API -> Default J18.9
    if (diagnosticReport.differential_diagnoses && Array.isArray(diagnosticReport.differential_diagnoses)) {
      const primaryDiagnosis = diagnosticReport.differential_diagnoses[0];

      if (primaryDiagnosis && primaryDiagnosis.condition_name) {
        // Step A: Try UMLS API
        let resolvedCode = await fetchICD10WithUMLS(primaryDiagnosis.condition_name);

        // Step B: Fallback to NLM Clinical Tables
        if (!resolvedCode) {
          resolvedCode = await validateICD10WithNLM(primaryDiagnosis.condition_name);
        }

        if (resolvedCode) {
          primaryDiagnosis.icd_10_code = resolvedCode.icd_10_code;
          primaryDiagnosis.validated_canonical_name = resolvedCode.canonical_name;
        } else if (!primaryDiagnosis.icd_10_code) {
          primaryDiagnosis.icd_10_code = 'J18.9';
        }
      }
    }

    // EDGE-CASE FIX: Sanitize top-level primary_diagnosis string
    if (diagnosticReport.primary_diagnosis) {
      diagnosticReport.primary_diagnosis = cleanConditionTerm(diagnosticReport.primary_diagnosis);
    }

    // SAFETY GUARDRAIL: Demote 'Critical' to 'High' if blood cough is mild/occasional without severe shortness of breath
    const fullHistoryText = JSON.stringify(history).toLowerCase();
    const hasMinorBlood = /slowly|sometimes|flecks|streaks|few drops|little/i.test(fullHistoryText);
    const hasSevereDistress = /shortness of breath|breathless|severe chest pain|unconscious|fainted|massive/i.test(fullHistoryText);

    if (
      diagnosticReport.triage_urgency_level?.toUpperCase() === 'CRITICAL' &&
      hasMinorBlood &&
      !hasSevereDistress
    ) {
      diagnosticReport.triage_urgency_level = 'High';
    }

    return NextResponse.json({
      success: true,
      report: diagnosticReport,
    });

  } catch (error: any) {
    console.error('Diagnose-Agent Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Diagnostic execution failure' },
      { status: 500 }
    );
  }
}