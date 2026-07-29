import { NextResponse } from 'next/server';
import { VertexAI, FunctionDeclarationSchemaType } from '@google-cloud/vertexai';

// Initialize GCP Project parameters from your environment variables
const project = (process.env.GCP_PROJECT_ID || '').trim();
const location = process.env.GCP_LOCATION || 'us-central1';

const vertexAI = new VertexAI({ project, location });

// Configure Gemini 2.5 Flash model with updated system directives and strict JSON schema
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
      3. ALWAYS respond in the EXACT SAME language and script the user used in their LATEST message. If the user writes in Telugu script, reply ONLY in Telugu script. If user writes in Hindi (Devanagari), reply in Hindi (Devanagari). If user writes in Hinglish, reply in Hinglish. If user writes in Marathi, reply in Marathi. If user writes in Tamil, reply in Tamil. This rule is ABSOLUTE — never transliterate, never switch scripts, never respond in a different language than the one the user wrote in.
      4. Systematically collect all of the following clinical details across multiple turns before completing — do not rush:
         (a) Primary symptom(s) and exact location, (b) Onset and duration, (c) Severity (1–10 scale), (d) Associated symptoms (fever, nausea, cough, etc.), (e) Aggravating or relieving factors, (f) Relevant medical history or chronic conditions, (g) Current medications or allergies.
         Ask about one or two of these per turn. Do not bundle all questions into one turn.
      5. COMPLETION RULES — Set 'is_assessment_complete' to TRUE ONLY when ALL of the following are satisfied:
         a) The conversation contains at least 7 user messages (not counting the first greeting).
         b) AND at least items (a), (b), (c), and (d) from directive 4 have been covered.
         OR: An image/report attachment is present — in that case skip the turn minimum.
      6. When 'is_assessment_complete' is TRUE:
         - Do NOT ask any more questions.
         - Summarize the triage urgency in 'conversational_reply' and state: "Submitting your case to Diagnose-Agent for preliminary clinical evaluation..."`
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