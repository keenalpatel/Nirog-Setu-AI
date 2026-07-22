import { NextResponse } from 'next/server';
import { VertexAI, FunctionDeclarationSchemaType } from '@google-cloud/vertexai';

// Initialize GCP Project parameters from your environment variables
const project = process.env.GCP_PROJECT_ID || 'your-gcp-project-id';
const location = process.env.GCP_LOCATION || 'us-central1';

const vertexAI = new VertexAI({ project, location });

// Configure Gemini 2.5 Flash model with system directives and strict JSON schema
const generativeModel = vertexAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: {
    role: 'system',
    parts: [{ 
      text: `You are the Nirog-Setu AI Triage Assistant, an expert digital clinician.
      You are analyzing a running dialogue history between yourself and the patient.
      
      Core Directives:
      1. Look over the entire thread history to see what symptoms were already discussed. Do not repeat questions you or the patient answered earlier.
      2. Translate the user's latest message to clean English for the 'english_translation' property field.
      3. Respond naturally with deep clinical empathy in the same script/language the user is using.
      4. Keep collecting details (onset, severity, localized area) over 2-3 turns naturally. If a major diagnostic indicator is raised (like deep respiratory distress or acute abdominal pain), ask the patient to upload an image report or X-ray slice if they have one.
      5. ONLY set 'is_assessment_complete' to true when a visual attachment (X-ray/Report image) has been uploaded AND you have enough chronological context across the whole history to render a safe clinical assessment.`
    }]
  },
  generationConfig: {
    temperature: 0.2,
    responseMimeType: 'application/json',
    responseSchema: {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        detected_language: { type: FunctionDeclarationSchemaType.STRING },
        english_translation: { type: FunctionDeclarationSchemaType.STRING },
        conversational_reply: { type: FunctionDeclarationSchemaType.STRING },
        is_assessment_complete: { type: FunctionDeclarationSchemaType.BOOLEAN },
        dynamic_diagnosis: { type: FunctionDeclarationSchemaType.STRING },
        severity_level: { type: FunctionDeclarationSchemaType.STRING },
        clinical_rationale: { type: FunctionDeclarationSchemaType.STRING }
      },
      required: ['detected_language', 'english_translation', 'conversational_reply', 'is_assessment_complete', 'severity_level'],
    },
  },
});

export async function POST(request: Request) {
  try {
    const { message, imageBase64, history } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const contents: any[] = [];

    // 1. Process thread chat history for multi-turn context
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        if (msg.type === 'user') {
          contents.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        } else if (msg.type === 'ai') {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      });
    }

    // 2. Format current turn text and optional multimodal attachments
    const currentParts: any[] = [{ text: `Current user input message: "${message}"` }];
    
    if (imageBase64) {
      // Strip base64 metadata headers safely if present
      const cleanBase64 = imageBase64.includes(',') 
        ? imageBase64.split(',')[1] 
        : imageBase64;

      currentParts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: imageBase64.includes('pdf') ? 'application/pdf' : 'image/jpeg'
        }
      });
    }

    contents.push({
      role: 'user',
      parts: currentParts
    });

    // 3. Trigger Vertex AI generation call
    const responseResult = await generativeModel.generateContent({
      contents: contents,
    });

    const responseText = responseResult.response?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('Empty response returned from Vertex AI generation engine.');
    }

    // Clean markdown formatting if returned and parse structured JSON
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiOutput = JSON.parse(cleanJson);

    return NextResponse.json({ 
      success: true, 
      reply: aiOutput.conversational_reply,
      isComplete: aiOutput.is_assessment_complete,
      detectedLanguage: aiOutput.detected_language,
      translation: aiOutput.english_translation,
      evaluation: {
        condition: aiOutput.dynamic_diagnosis || "Under Evaluation",
        severity: aiOutput.severity_level || "low",
        rationale: aiOutput.clinical_rationale || ""
      }
    });

  } catch (error: any) {
    console.error('Triage History Engine Crash:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Server error occurred during triage processing.' 
    }, { status: 500 });
  }
}

