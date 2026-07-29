import { NextResponse } from 'next/server';
import { VertexAI, FunctionDeclarationSchemaType } from '@google-cloud/vertexai';

export const maxDuration = 30;

const projectId = (process.env.GCP_PROJECT_ID || '').trim();
const location = process.env.GCP_LOCATION || 'us-central1';
const vertexAI = new VertexAI({ project: projectId, location });

function cleanConditionTerm(term: string): string {
  return term
    .replace(/\(.*?\)/g, '')
    .replace(/high|moderate|low|acute|severe|chronic/gi, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim();
}

// ── 1. UMLS METATHESAURUS REST API ────────────────────────────────────
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
      const primaryCode = results.find((r: any) => r.ui && (r.ui.startsWith('J') || r.ui.startsWith('A') || r.ui.startsWith('R')));
      const match = primaryCode || results[0];
      return { icd_10_code: match.ui, canonical_name: match.name };
    }
    return null;
  } catch (err) {
    console.warn('[UMLS API Warning] Lookup failed:', err);
    return null;
  }
}

// ── 2. NLM CLINICAL TABLE API (Fallback) ─────────────────────────────
async function validateICD10WithNLM(conditionName: string): Promise<{ icd_10_code: string; canonical_name: string } | null> {
  try {
    const cleanTerm = cleanConditionTerm(conditionName);
    const url = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(cleanTerm)}&maxList=10`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    const matches = data[3];

    if (matches && matches.length > 0) {
      const primaryCode = matches.find((m: string[]) => m[0].startsWith('J') || m[0].startsWith('A') || m[0].startsWith('R'));
      const [icdCode, canonicalName] = primaryCode || matches[0];
      return { icd_10_code: icdCode, canonical_name: canonicalName };
    }
    return null;
  } catch (err) {
    console.warn('[NLM API Warning] Lookup failed:', err);
    return null;
  }
}

// ── MAIN POST HANDLER ──────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { 
      history = [], 
      imageBase64, 
      ragContext = "", 
      patientAge = 30, 
      gender = "Unspecified",
      comorbidities = []
    } = await request.json();

    // Define Vertex AI Output Schema
    const responseSchema = {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        primary_diagnosis: { type: FunctionDeclarationSchemaType.STRING },
        diagnostic_confidence_percentage: { type: FunctionDeclarationSchemaType.NUMBER },
        risk_level: { type: FunctionDeclarationSchemaType.STRING },
        identified_risk_factors: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: { type: FunctionDeclarationSchemaType.STRING }
        },
        required_specialty: { type: FunctionDeclarationSchemaType.STRING },
        requires_dots_tracking: { type: FunctionDeclarationSchemaType.BOOLEAN },
        differential_diagnoses: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: {
            type: FunctionDeclarationSchemaType.OBJECT,
            properties: {
              condition_name: { type: FunctionDeclarationSchemaType.STRING },
              confidence_score: { type: FunctionDeclarationSchemaType.STRING },
              probability_percentage: { type: FunctionDeclarationSchemaType.NUMBER },
              clinical_rationale: { type: FunctionDeclarationSchemaType.STRING },
              icd_10_code: { type: FunctionDeclarationSchemaType.STRING },
            },
            required: ['condition_name', 'confidence_score', 'probability_percentage', 'clinical_rationale'],
          },
        },
        required_followup_tests: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: { type: FunctionDeclarationSchemaType.STRING },
        },
        patient_action_plan: { type: FunctionDeclarationSchemaType.STRING },
        triage_urgency_level: { type: FunctionDeclarationSchemaType.STRING },
      },
      required: [
        'primary_diagnosis',
        'diagnostic_confidence_percentage',
        'risk_level',
        'identified_risk_factors',
        'required_specialty',
        'requires_dots_tracking',
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
            text: `You are Diagnose-Agent for Nirog-Setu AI, operating under ICMR, NTEP (National TB Elimination Program), and MOHFW primary care guidelines.

CLINICAL EVALUATION RULES:
1. Primary Diagnosis Focus: Directly address chief complaints (e.g., Acute Cough, Bronchitis, Pneumonia, Typhoid). Avoid vague diagnoses like "Malaise" or "Fatigue" if localized symptoms exist.
2. Quantified Confidence: Calculate 'diagnostic_confidence_percentage' (0-100%) based on symptom specificity, duration, and objective clinical signals.
3. TB Screening Protocol: If cough duration >= 14 days, night sweats, unexplained weight loss, or X-ray apical lesions exist, evaluate for Pulmonary Tuberculosis (ICD-10: A15.0) and set 'requires_dots_tracking' to true.
4. Multimodal Vision Reasoning: Analyze uploaded Chest X-rays for opacities, consolidations, or pleural effusion, correlating findings with the user text.

TRIAGE URGENCY LEVEL GUIDELINES:
- CRITICAL: Massive hemoptysis (>100ml blood), acute chest pain, cyanosis, severe resting dyspnea, or loss of consciousness.
- HIGH: Minor blood flecks in sputum, high persistent fever (>102°F), suspected TB/Pneumonia without acute collapse. PHC referral + ASHA visit (NO 108 ambulance).
- MODERATE: Mild URTI, low-grade fever <3 days, throat discomfort.
- LOW: General health query or routine check-up.`,
          },
        ],
      },
    });

    const promptParts: any[] = [
      { 
        text: `Patient Context: Age ${patientAge}, Gender: ${gender}, Existing Conditions: ${JSON.stringify(comorbidities)}
Case Dialogue History: ${JSON.stringify(history, null, 2)}` 
      },
    ];

    if (ragContext) {
      promptParts.push({ text: `AlloyDB Guidelines Context: ${ragContext}` });
    }

    if (imageBase64 && typeof imageBase64 === 'string') {
      const mimeMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+-]+;base64,/, '').trim();

      if (cleanBase64) {
        promptParts.push({
          inlineData: { data: cleanBase64, mimeType },
        });
      }
    }

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: promptParts }],
    });

    let responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('Received empty response from Vertex AI engine.');

    responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const diagnosticReport = JSON.parse(responseText);

    // UMLS & NLM API Fallback Pipeline
    if (diagnosticReport.differential_diagnoses && Array.isArray(diagnosticReport.differential_diagnoses)) {
      const primaryDiagnosis = diagnosticReport.differential_diagnoses[0];
      if (primaryDiagnosis && primaryDiagnosis.condition_name) {
        let resolvedCode = await fetchICD10WithUMLS(primaryDiagnosis.condition_name);
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

    if (diagnosticReport.primary_diagnosis) {
      diagnosticReport.primary_diagnosis = cleanConditionTerm(diagnosticReport.primary_diagnosis);
    }

    // Safety Capping Guardrail
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
      report: diagnosticReport
    });
  } catch (error: any) {
    console.error('Diagnose-Agent Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Diagnostic execution failure' },
      { status: 500 }
    );
  }
}