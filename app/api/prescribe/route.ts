import { NextResponse } from 'next/server';
import { VertexAI, FunctionDeclarationSchemaType } from '@google-cloud/vertexai';

export const maxDuration = 30;

const projectId = process.env.GCP_PROJECT_ID || 'project-ad67eb63-a729-4ed5-a89d';
const location = process.env.GCP_LOCATION || 'us-central1';
const vertexAI = new VertexAI({ project: projectId, location });

// ── Dynamic openFDA Warning Fetcher ──────────────────────────────────
async function fetchFDASafetyNotice(drugName: string): Promise<string | null> {
  if (!drugName) return null;

  // Clean drug string: remove dosages like "500mg", "10ml", "tabs", etc.
  const cleanDrug = drugName
    .replace(/\d+(\.\d+)?\s*(mg|g|ml|mcg|iu|tablet|capsule|syrup|vial)/gi, '')
    .trim();

  // Primary active ingredient word
  const searchName = cleanDrug || drugName.split(' ')[0].trim();

  try {
    // Attempt 1: Search by generic_name
    let fdaRes = await fetch(
      `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(searchName)}"${process.env.OPENFDA_API_KEY ? `&api_key=${process.env.OPENFDA_API_KEY}` : ''}&limit=1`,
      { cache: 'no-store' }
    );

    // Attempt 2: Fallback search by general query if generic_name yields 404
    if (!fdaRes.ok) {
      fdaRes = await fetch(
        `https://api.fda.gov/drug/label.json?search="${encodeURIComponent(searchName)}"${process.env.OPENFDA_API_KEY ? `&api_key=${process.env.OPENFDA_API_KEY}` : ''}&limit=1`,
        { cache: 'no-store' }
      );
    }

    if (!fdaRes.ok) return null;

    const fdaData = await fdaRes.json();
    const result = fdaData.results?.[0];

    // Priority order for safety warnings: Boxed Warnings > Contraindications > Warnings
    const warningText =
      result?.boxed_warning?.[0] ||
      result?.contraindications?.[0] ||
      result?.warnings?.[0] ||
      null;

    if (!warningText) return null;

    // Truncate long FDA text cleanly for display on UI card
    return warningText.length > 280 ? warningText.slice(0, 277) + '...' : warningText;
  } catch (err) {
    console.warn(`[openFDA Warning] Fetch failed dynamically for ${searchName}:`, err);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { diagnosticReport, patientAge = 30, allergies = [] } = await request.json();

    if (!diagnosticReport) {
      return NextResponse.json(
        { success: false, error: 'diagnosticReport is required' },
        { status: 400 }
      );
    }

    // ── 1. Define Prescribe-Agent JSON Output Schema ─────────────
    const responseSchema = {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        prescriptions: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: {
            type: FunctionDeclarationSchemaType.OBJECT,
            properties: {
              medication_name: { type: FunctionDeclarationSchemaType.STRING },
              dosage: { type: FunctionDeclarationSchemaType.STRING },
              frequency: { type: FunctionDeclarationSchemaType.STRING },
              duration: { type: FunctionDeclarationSchemaType.STRING },
              route: { type: FunctionDeclarationSchemaType.STRING },
              purpose: { type: FunctionDeclarationSchemaType.STRING },
            },
            required: ['medication_name', 'dosage', 'frequency', 'duration', 'route', 'purpose'],
          },
        },
        contraindicated_drugs: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: { type: FunctionDeclarationSchemaType.STRING },
        },
        phc_pharmacy_status: { type: FunctionDeclarationSchemaType.STRING },
        icmr_guideline_reference: { type: FunctionDeclarationSchemaType.STRING },
      },
      required: [
        'prescriptions',
        'contraindicated_drugs',
        'phc_pharmacy_status',
        'icmr_guideline_reference',
      ],
    };

    // ── 2. Configure Model with ICMR / WHO System Prompt ──────────
    const generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.1,
        maxOutputTokens: 4096,
      },
      systemInstruction: {
        role: 'system',
        parts: [
          {
            text: `You are Prescribe-Agent for Nirog-Setu AI.
Generate safe, evidence-based treatment recommendations aligned with ICMR and WHO guidelines for Indian Primary Health Centres (PHCs).
Check for drug interactions and explicit contraindications (e.g. strict avoidance of NSAIDs like Aspirin/Ibuprofen in Dengue).
State PHC inventory availability status for essential medicines under National Essential Medicines List (NEML).`,
          },
        ],
      },
    });

    // ── 3. Execute Model Call ─────────────────────────────────────
    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Generate prescription plan for diagnosis report: ${JSON.stringify(
                diagnosticReport
              )}. Patient age: ${patientAge}, Allergies: ${JSON.stringify(allergies)}`,
            },
          ],
        },
      ],
    });

    let responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Empty response from Prescribe-Agent model.');
    }

    // Clean markdown wrappers if present
    responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const prescriptionPlan = JSON.parse(responseText);

    // ── 4. Dynamic openFDA Fetch Step ──────────────────────────────
    // Dynamically pull the primary drug prescribed by Gemini
    const primaryDrug = prescriptionPlan.prescriptions?.[0]?.medication_name;
    
    let fdaNotice = null;
    if (primaryDrug) {
      fdaNotice = await fetchFDASafetyNotice(primaryDrug);
    }

    // Attach dynamic notice to returned response
    return NextResponse.json({
      success: true,
      prescription: {
        ...prescriptionPlan,
        fda_safety_notice: fdaNotice,
      },
    });
  } catch (error: any) {
    console.error('Prescribe-Agent Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Prescription execution failed' },
      { status: 500 }
    );
  }
}