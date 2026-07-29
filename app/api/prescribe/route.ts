import { NextResponse } from 'next/server';
import { VertexAI, FunctionDeclarationSchemaType } from '@google-cloud/vertexai';

export const maxDuration = 30;

const projectId = (process.env.GCP_PROJECT_ID || '').trim();
const location = process.env.GCP_LOCATION || 'us-central1';
const vertexAI = new VertexAI({ project: projectId, location });

// ── 1. DYNAMIC openFDA SAFETY NOTICE ──────────────────────────────────
async function fetchFDASafetyNotice(drugName: string): Promise<string | null> {
  if (!drugName) return null;

  const cleanDrug = drugName
    .replace(/\d+(\.\d+)?\s*(mg|g|ml|mcg|iu|tablet|capsule|syrup|vial)/gi, '')
    .trim();

  const searchName = cleanDrug.split(' ')[0].trim() || drugName.split(' ')[0].trim();

  try {
    let fdaRes = await fetch(
      `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(searchName)}"${process.env.OPENFDA_API_KEY ? `&api_key=${process.env.OPENFDA_API_KEY}` : ''}&limit=1`,
      { cache: 'no-store' }
    );

    if (!fdaRes.ok) {
      fdaRes = await fetch(
        `https://api.fda.gov/drug/label.json?search="${encodeURIComponent(searchName)}"${process.env.OPENFDA_API_KEY ? `&api_key=${process.env.OPENFDA_API_KEY}` : ''}&limit=1`,
        { cache: 'no-store' }
      );
    }

    if (!fdaRes.ok) return null;

    const fdaData = await fdaRes.json();
    const result = fdaData.results?.[0];

    const warningText =
      result?.boxed_warning?.[0] ||
      result?.contraindications?.[0] ||
      result?.warnings?.[0] ||
      null;

    if (!warningText) return null;
    return warningText.length > 280 ? warningText.slice(0, 277) + '...' : warningText;
  } catch (err) {
    console.warn(`[openFDA Warning] Fetch failed dynamically for ${searchName}:`, err);
    return null;
  }
}

// ── 2. RxNAV DRUG-DRUG INTERACTION CHECKER ─────────────────────────────
async function checkDrugInteractions(drugNames: string[]): Promise<string[]> {
  if (!drugNames || drugNames.length < 2) return [];

  try {
    const rxCuiPromises = drugNames.map(async (drug) => {
      const cleanName = drug.replace(/\d+(\.\d+)?\s*(mg|g|ml|mcg)/gi, '').trim().split(' ')[0];
      const res = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(cleanName)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.idGroup?.rxnormId?.[0] || null;
    });

    const rxCuis = (await Promise.all(rxCuiPromises)).filter(Boolean);
    if (rxCuis.length < 2) return [];

    const interactionUrl = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxCuis.join('+')}`;
    const intRes = await fetch(interactionUrl);
    if (!intRes.ok) return [];

    const intData = await intRes.json();
    const interactionList: string[] = [];

    const fullInteractionTypeGroup = intData.fullInteractionTypeGroup;
    if (fullInteractionTypeGroup && fullInteractionTypeGroup[0]?.fullInteractionType) {
      for (const type of fullInteractionTypeGroup[0].fullInteractionType) {
        for (const pair of type.interactionPair) {
          interactionList.push(`[Interaction Warning] ${pair.description}`);
        }
      }
    }

    return interactionList;
  } catch (err) {
    console.warn('[RxNav Interaction API Warning] Lookup failed:', err);
    return [];
  }
}

// ── MAIN POST HANDLER ──────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { 
      diagnosticReport, 
      patientAge = 30, 
      patientWeightKg = null,
      allergies = [],
      isPregnant = false 
    } = await request.json();

    if (!diagnosticReport) {
      return NextResponse.json(
        { success: false, error: 'diagnosticReport is required' },
        { status: 400 }
      );
    }

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
              pediatric_dosage_note: { type: FunctionDeclarationSchemaType.STRING },
            },
            required: ['medication_name', 'dosage', 'frequency', 'duration', 'route', 'purpose'],
          },
        },
        non_pharmacological_advice: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: { type: FunctionDeclarationSchemaType.STRING },
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
        'non_pharmacological_advice',
        'contraindicated_drugs',
        'phc_pharmacy_status',
        'icmr_guideline_reference',
      ],
    };

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
            text: `You are Prescribe-Agent for Nirog-Setu AI, operating under ICMR treatment protocols and standard National Essential Medicines List (NEML) for Indian PHCs.

PRESCRIBING PROTOCOLS:
1. Target Symptom Alignment:
   - Primary Cough without high fever: Prescribe Dextromethorphan syrup or Ambroxol expectorant.
   - High Fever (>99.5°F) or Body Pain: Prescribe Paracetamol (500mg/650mg).
   - Confirmed/Suspected TB ('requires_dots_tracking': true): Prescribe ICMR CAT-1 FDC regimen (Rifampicin, Isoniazid, Pyrazinamide, Ethambutol) with instruction: "Collect free DOTS supply from local PHC".
2. Age & Weight Safety:
   - For pediatric cases (<12 years or <30 kg), adjust dosage to weight-based liquid syrups (e.g. Paracetamol syrup 15mg/kg/dose).
3. Safety & Contraindications:
   - Avoid NSAIDs (Ibuprofen/Aspirin) if Dengue or Bleeding is suspected.
   - Flag patient allergies strictly. Provide non-pharmacological care advice (hydration, rest, steam inhalation).
4. State PHC Inventory Status: Mark inventory status as 'In Stock at PHC Sub-Centre (NEML Standard)'.`,
          },
        ],
      },
    });

    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Generate prescription plan for diagnosis report: ${JSON.stringify(diagnosticReport)}. 
Patient Profile: Age ${patientAge}, Weight: ${patientWeightKg ? patientWeightKg + 'kg' : 'Not specified'}, Pregnant: ${isPregnant}, Allergies: ${JSON.stringify(allergies)}`,
            },
          ],
        },
      ],
    });

    let responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('Empty response from Prescribe-Agent model.');

    responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    const prescriptionPlan = JSON.parse(responseText);

    // Dynamic external checks
    const prescribedDrugs = prescriptionPlan.prescriptions?.map((p: any) => p.medication_name) || [];
    
    // 1. openFDA dynamic notice for primary drug
    const primaryDrug = prescribedDrugs[0];
    let fdaNotice = null;
    if (primaryDrug) {
      fdaNotice = await fetchFDASafetyNotice(primaryDrug);
    }

    // 2. RxNav Drug-Drug Interaction Check across all prescribed drugs
    const liveInteractionAlerts = await checkDrugInteractions(prescribedDrugs);

    return NextResponse.json({
      success: true,
      prescription: {
        ...prescriptionPlan,
        fda_safety_notice: fdaNotice,
        live_drug_interaction_alerts: liveInteractionAlerts,
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