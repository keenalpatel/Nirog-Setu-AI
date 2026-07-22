import { NextResponse } from 'next/server';
import { VertexAI, FunctionDeclarationSchemaType } from '@google-cloud/vertexai';

const projectId = process.env.GCP_PROJECT_ID || 'project-ad67eb63-a729-4ed5-a89d';
const location = process.env.GCP_LOCATION || 'us-central1';

const vertexAI = new VertexAI({ project: projectId, location });

export async function POST(request: Request) {
  try {
    const { diagnosticReport, patientLang = 'English' } = await request.json();

    if (!diagnosticReport) {
      return NextResponse.json(
        { success: false, error: 'Missing diagnostic report payload.' },
        { status: 400 }
      );
    }

    const responseSchema = {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        primary_condition: { type: FunctionDeclarationSchemaType.STRING },
        supportive_care: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: { type: FunctionDeclarationSchemaType.STRING },
          description: 'Non-prescription supportive steps (e.g., ORS, hydration, rest, steam inhalation).'
        },
        preliminary_medications: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: { type: FunctionDeclarationSchemaType.STRING },
          description: 'Basic OTC remedies aligned with ICMR/PHC first-line care standards.'
        },
        warning_signs: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: { type: FunctionDeclarationSchemaType.STRING },
          description: 'Red-flag symptoms requiring immediate emergency medical attention.'
        },
        clinical_disclaimer: { type: FunctionDeclarationSchemaType.STRING }
      },
      required: [
        'primary_condition',
        'supportive_care',
        'preliminary_medications',
        'warning_signs',
        'clinical_disclaimer'
      ]
    };

    const generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.1
      },
      systemInstruction: {
        role: 'system',
        parts: [
          {
            text: `You are Prescribe-Agent for Nirog-Setu AI.
Your role is to formulate safe, preliminary, supportive care plans based on diagnostic findings.
Always adhere to ICMR/WHO guidelines for primary health centers. Never prescribe restricted prescription antibiotics or high-risk drugs without direct physician validation.`
          }
        ]
      }
    });

    const promptText = `
Evaluate the following diagnostic summary and produce a patient-centric care plan in ${patientLang}:

[DIAGNOSTIC REPORT]
${JSON.stringify(diagnosticReport, null, 2)}
`;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptText }] }]
    });

    const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Received empty response from Vertex AI Prescribe-Agent.');
    }

    const prescriptionPlan = JSON.parse(responseText.trim());

    return NextResponse.json({ success: true, plan: prescriptionPlan });
  } catch (error: any) {
    console.error('Prescribe Engine Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}