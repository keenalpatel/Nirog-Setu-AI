import { NextResponse } from 'next/server';
import { VertexAI, FunctionDeclarationSchemaType } from '@google-cloud/vertexai';

// Initialize Vertex AI client using GCP environment variables
const projectId = process.env.GCP_PROJECT_ID || 'project-ad67eb63-a729-4ed5-a89d';
const location = process.env.GCP_LOCATION || 'us-central1';

const vertexAI = new VertexAI({ project: projectId, location: location });

// AlloyDB RAG Grounding Simulation (National TB & PHC Clinical Guidelines)
const MOCK_RAG_KNOWLEDGE_BASE = {
  respiratory: {
    guideline: "National TB Elimination Program (NTEP) Protocol: Chronic cough > 2 weeks accompanied by unremitting fever, night sweats, or hemoptysis requires immediate sputum microscopy/NAAT and chest radiographs showing apical infiltrates or cavitation.",
    keywords: ["cough", "fever", "x-ray", "breathing", "chest", "tb", "sputum"]
  },
  gastrointestinal: {
    guideline: "Acute Gastroenteritis / Appendicitis Triage Protocol: Severe localized lower quadrant abdominal pain with persistent vomiting requires physical palpation to rule out acute abdomen. Hydration tracking is critical.",
    keywords: ["stomach", "pain", "vomiting", "vomit", "belly", "abdomen"]
  }
};

export async function POST(request: Request) {
  try {
    const { history = [], imageBase64 } = await request.json();

    // 1. AlloyDB RAG Simulation Layer: Dynamically match patient context to guidelines
    const fullTextHistory = history
      .map((msg: any) => msg.content || '')
      .join(" ")
      .toLowerCase();

    let groundedGuideline = "General PHC Primary Assessment Guidelines.";
    if (MOCK_RAG_KNOWLEDGE_BASE.respiratory.keywords.some(k => fullTextHistory.includes(k))) {
      groundedGuideline = MOCK_RAG_KNOWLEDGE_BASE.respiratory.guideline;
    } else if (MOCK_RAG_KNOWLEDGE_BASE.gastrointestinal.keywords.some(k => fullTextHistory.includes(k))) {
      groundedGuideline = MOCK_RAG_KNOWLEDGE_BASE.gastrointestinal.guideline;
    }

    // 2. Define the exact JSON Schema output for structured clinical evaluation
    const responseSchema = {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        differential_diagnoses: {
          type: FunctionDeclarationSchemaType.ARRAY,
          items: {
            type: FunctionDeclarationSchemaType.OBJECT,
            properties: {
              condition_name: { type: FunctionDeclarationSchemaType.STRING },
              confidence_score: { 
                type: FunctionDeclarationSchemaType.STRING, 
                description: 'e.g., 85%' 
              },
              clinical_rationale: { type: FunctionDeclarationSchemaType.STRING }
            },
            required: ['condition_name', 'confidence_score', 'clinical_rationale']
          }
        },
        severity_tier: { 
          type: FunctionDeclarationSchemaType.STRING, 
          description: 'low, medium, high, critical' 
        },
        required_followup_tests: { 
          type: FunctionDeclarationSchemaType.ARRAY, 
          items: { type: FunctionDeclarationSchemaType.STRING },
          description: 'Tests or questions needed if confidence is low.'
        },
        patient_action_plan: { type: FunctionDeclarationSchemaType.STRING }
      },
      required: ['differential_diagnoses', 'severity_tier', 'required_followup_tests', 'patient_action_plan'],
    };

    // 3. Initialize Gemini 2.5 Flash model on Vertex AI
    const generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.2, // Low temperature for consistent clinical reasoning
      },
      systemInstruction: {
        role: 'system',
        parts: [{
          text: `You are Diagnose-Agent, an expert clinical diagnostic system for Nirog-Setu AI.
Analyze patient history alongside any uploaded visual medical records (X-ray, lab reports, skin lesions).
Ground your diagnoses on national medical protocols (ICMR / NTEP / WHO) provided in context. Always output valid structured JSON.`
        }]
      }
    });

    // 4. Build prompt parts (Text context + optional Base64 Multimodal Image)
    const promptText = `
Review the provided case history and any attached visual medical records.

[GROUNDED KNOWLEDGE RESOURCE (AlloyDB RAG Matching)]
${groundedGuideline}

[PATIENT CASE TIMELINE]
${history.map((msg: any) => `${(msg.type || msg.role || 'user').toUpperCase()}: ${msg.content}`).join("\n")}

Perform a thorough diagnostic evaluation. You must generate a primary differential diagnosis list complete with confidence metrics, severe warning signs, and concrete requests for follow-up testing if the evidence is insufficient.
`;

    const parts: any[] = [{ text: promptText }];

    // Inject Base64 image payload if provided (e.g., Chest X-Ray for TB analysis)
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: 'image/jpeg'
        }
      });
    }

    // 5. Execute multimodal inference on Vertex AI
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts }]
    });

    const responseText = result.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('Received an empty response from Vertex AI Diagnose-Agent.');
    }

    const diagnosticReport = JSON.parse(responseText.trim());

    return NextResponse.json({ success: true, report: diagnosticReport });
  } catch (error: any) {
    console.error('Diagnose Engine Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}