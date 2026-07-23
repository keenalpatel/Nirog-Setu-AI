import { NextResponse } from 'next/server';
import { VertexAI, FunctionDeclarationSchemaType } from '@google-cloud/vertexai';

export const maxDuration = 30;

const projectId = process.env.GCP_PROJECT_ID || 'project-ad67eb63-a729-4ed5-a89d';
const location = process.env.GCP_LOCATION || 'us-central1';

const vertexAI = new VertexAI({ project: projectId, location });

// ── 1. NLM CLINICAL TABLE API (Dynamic ICD-10 Resolution) ──────────────
async function validateICD10WithNLM(conditionName: string): Promise<{ icd_10_code: string; canonical_name: string } | null> {
  try {
    // Strip broad descriptors to get pure search terms (e.g. "Bacterial Pneumonia" -> "Pneumonia")
    const cleanTerm = conditionName.replace(/high|moderate|low|acute|severe|chronic/gi, '').trim();

    const url = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(cleanTerm)}&maxList=5`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    const data = await res.json();
    const matches = data[3]; // format: [[code, display_name], ...]

    if (matches && matches.length > 0) {
      // Find the first standard J-code if available (J00-J99 covers Respiratory System)
      const primaryRespiratoryCode = matches.find((m: string[]) => m[0].startsWith('J'));
      
      const selectedMatch = primaryRespiratoryCode || matches[0];
      const [icdCode, canonicalName] = selectedMatch;

      return { icd_10_code: icdCode, canonical_name: canonicalName };
    }
    return null;
  } catch (err) {
    console.warn('[NLM API Warning] ICD-10 lookup failed:', err);
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
Always include standard WHO/ICD-10 primary category codes (e.g., J18.9 for Pneumonia).
Keep clinical rationales concise and punchy (under 2-3 sentences per condition).`,
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

    // Dynamic ICD-10 Resolution with NLM API
    if (diagnosticReport.differential_diagnoses && Array.isArray(diagnosticReport.differential_diagnoses)) {
      const primaryDiagnosis = diagnosticReport.differential_diagnoses[0];

      if (primaryDiagnosis && primaryDiagnosis.condition_name) {
        const nlmData = await validateICD10WithNLM(primaryDiagnosis.condition_name);

        if (nlmData) {
          primaryDiagnosis.icd_10_code = nlmData.icd_10_code;
          primaryDiagnosis.validated_canonical_name = nlmData.canonical_name;
        } else if (!primaryDiagnosis.icd_10_code) {
          primaryDiagnosis.icd_10_code = 'J18.9'; // Fallback standard respiratory code
        }
      }
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