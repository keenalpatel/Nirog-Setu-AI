import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'whatsapp_verify';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v25.0';

// Message deduplication: track processed message IDs to prevent duplicate responses
const processedMessages = new Set<string>();
const MAX_PROCESSED_CACHE = 1000;

function isMessageProcessed(messageId: string): boolean {
  if (processedMessages.has(messageId)) return true;
  processedMessages.add(messageId);
  // Prevent memory leak by clearing old entries
  if (processedMessages.size > MAX_PROCESSED_CACHE) {
    const firstEntry = processedMessages.values().next().value;
    if (firstEntry) processedMessages.delete(firstEntry);
  }
  return false;
}

function loadWhatsappToken(): string | null {
  if (process.env.WHATSAPP_TOKEN?.trim()) return process.env.WHATSAPP_TOKEN.trim();

  try {
    const tokenFile = path.join(process.cwd(), 'whatsapp-token');
    if (!fs.existsSync(tokenFile)) return null;

    const content = fs.readFileSync(tokenFile, 'utf8');
    const bearerMatch = content.match(/Authorization:\s*Bearer\s*([A-Za-z0-9._-]+)/i);
    if (bearerMatch?.[1]) return bearerMatch[1];

    const headerMatch = content.match(/-H ['\"]Authorization:\s*Bearer\s*([^'\"]+)['\"]/i);
    return headerMatch?.[1] ?? null;
  } catch (error) {
    console.warn('Unable to load WhatsApp token from file:', error);
    return null;
  }
}

function parseWhatsappWebhook(body: any) {
  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const metadata = body?.entry?.[0]?.changes?.[0]?.value?.metadata;
  if (!message) return null;

  const parsed: {
    from: string;
    phoneNumberId: string | undefined;
    messageText: string;
    hasAttachment: boolean;
    mediaId: string | null;
    messageId: string;
  } = {
    from: message.from,
    phoneNumberId: metadata?.phone_number_id,
    messageText: '',
    hasAttachment: false,
    mediaId: null,
    messageId: message.id || '',
  };

  if (message.type === 'text' && message.text?.body) {
    parsed.messageText = message.text.body;
  } else if (message.type === 'image') {
    parsed.messageText = message.image?.caption || 'Patient sent an X-ray/medical image for diagnosis.';
    parsed.hasAttachment = true;
    parsed.mediaId = message.image?.id || null;
  } else if (message.type === 'audio') {
    parsed.messageText = 'Patient sent an audio message via WhatsApp.';
    parsed.hasAttachment = true;
    parsed.mediaId = message.audio?.id || null;
  } else {
    parsed.messageText = `Received a WhatsApp ${message.type} message.`;
    parsed.hasAttachment = message.type !== 'text';
  }

  return parsed;
}

async function downloadWhatsappMedia(mediaId: string): Promise<string | null> {
  const token = loadWhatsappToken();
  if (!token || !mediaId) return null;

  try {
    // Step 1: Get media URL from WhatsApp
    const mediaInfoRes = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!mediaInfoRes.ok) return null;
    const mediaInfo = await mediaInfoRes.json();
    const mediaUrl = mediaInfo.url;
    if (!mediaUrl) return null;

    // Step 2: Download the actual media binary
    const mediaRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!mediaRes.ok) return null;

    const arrayBuffer = await mediaRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = mediaRes.headers.get('content-type') || 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Failed to download WhatsApp media:', error);
    return null;
  }
}

async function transcribeAudio(mediaId: string): Promise<string | null> {
  const token = loadWhatsappToken();
  if (!token || !mediaId) return null;

  try {
    // Download audio from WhatsApp
    const mediaInfoRes = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!mediaInfoRes.ok) return null;
    const mediaInfo = await mediaInfoRes.json();
    const mediaUrl = mediaInfo.url;
    if (!mediaUrl) return null;

    const audioRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!audioRes.ok) return null;

    const arrayBuffer = await audioRes.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = audioRes.headers.get('content-type') || 'audio/ogg';

    // Use Vertex AI Gemini to transcribe the audio
    const project = process.env.GCP_PROJECT_ID || '';
    const location = process.env.GCP_LOCATION || 'us-central1';
    const { VertexAI } = await import('@google-cloud/vertexai');
    const vertexAI = new VertexAI({ project, location });
    const model = vertexAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: base64Audio, mimeType } },
          { text: 'Transcribe this audio message exactly as spoken. Output ONLY the transcribed text, nothing else. If the audio is in Hindi, Marathi, Telugu, or any other language, transcribe it in that language using the original script.' }
        ]
      }]
    });

    const transcription = result.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return transcription || null;
  } catch (error) {
    console.error('Audio transcription failed:', error);
    return null;
  }
}

async function sendWhatsappText(phoneNumberId: string, to: string, bodyText: string) {
  const token = loadWhatsappToken();
  if (!token) {
    throw new Error('Missing WhatsApp API token. Set WHATSAPP_TOKEN or create whatsapp-token file.');
  }
  if (!phoneNumberId) {
    throw new Error('Missing WhatsApp phone number ID. Set WHATSAPP_PHONE_NUMBER_ID.');
  }

  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: bodyText },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const payloadText = await res.text();
    throw new Error(`WhatsApp send failed: ${res.status} ${res.statusText} ${payloadText}`);
  }

  return res.json();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge || '');
  }

  return new Response('Verification failed', { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const incoming = parseWhatsappWebhook(body);
    if (!incoming) {
      return NextResponse.json(
        { success: false, error: 'Invalid WhatsApp webhook payload.' },
        { status: 400 }
      );
    }

    console.log(`📱 [WHATSAPP INCOMING] From: ${incoming.from} | Message: "${incoming.messageText}" | Attachment: ${incoming.hasAttachment}`);

    // Deduplicate: skip if this message was already processed
    if (incoming.messageId && isMessageProcessed(incoming.messageId)) {
      return NextResponse.json({ success: true, deduplicated: true });
    }

    // Download image if present, or transcribe audio
    let imageBase64: string | undefined;
    let messageText = incoming.messageText;

    if (incoming.hasAttachment && incoming.mediaId) {
      if (incoming.messageText.includes('audio message')) {
        // Transcribe audio to text using Gemini
        const transcription = await transcribeAudio(incoming.mediaId);
        if (transcription) {
          messageText = transcription;
          incoming.hasAttachment = false; // Treat as text now
        }
      } else {
        // Download image
        const downloaded = await downloadWhatsappMedia(incoming.mediaId);
        if (downloaded) imageBase64 = downloaded;
      }
    }

    // Detect conversational closers — don't restart triage for these
    const closerPatterns = /^(ok|okay|alright|thanks|thank you|thankyou|dhanyavad|shukriya|bye|theek hai|thik hai|accha|got it|noted|hmm|haan|ji|good)\s*[.!]?$/i;
    if (closerPatterns.test(messageText.trim())) {
      const closingReply = 'Thank you for using Nirog Setu AI. If you need medical assistance in the future, feel free to message anytime. Take care! 🙏';
      const phoneNumberId = incoming.phoneNumberId || WHATSAPP_PHONE_NUMBER_ID;
      if (phoneNumberId) {
        await sendWhatsappText(phoneNumberId, incoming.from, closingReply);
      }
      return NextResponse.json({ success: true, closingMessage: true });
    }

    const baseUrl = process.env.INTERNAL_API_URL || 'http://localhost:3000';
    const adkServiceUrl = process.env.ADK_SERVICE_URL; // e.g., http://localhost:8080

    let whatsappReply = '';
    let diagnoseReport: any = null;
    let prescribeSummary = '';
    let triageData: any = null;

    // Track 1+2: Try ADK Agent Service first if configured
    if (adkServiceUrl) {
      try {
        const adkResponse = await fetch(`${adkServiceUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageText,
            user_id: incoming.from,
            session_id: `wa_${incoming.from}`,
            image_base64: imageBase64 || null,
          }),
        });

        if (adkResponse.ok) {
          const adkData = await adkResponse.json();
          if (adkData?.reply) {
            whatsappReply = adkData.reply;
            triageData = { reply: adkData.reply, isComplete: true };
          }
        }
      } catch (adkErr) {
        console.warn('ADK Agent Service unreachable or failed, falling back to Next.js internal routes:', adkErr);
      }
    }

    // Fallback: If ADK service failed or was not configured, try Next.js internal routes
    if (!whatsappReply) {
      try {
        const triageUrl = `${baseUrl}/api/triage`;
        const triageResponse = await fetch(triageUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: messageText,
            imageBase64: imageBase64,
            history: [{ type: 'user', content: messageText }],
          }),
        });

        if (triageResponse.ok) {
          triageData = await triageResponse.json();
          if (triageData?.reply) {
            whatsappReply = `Triage Assistant:\n${triageData.reply}`;
          }
        }

        if (triageData && (triageData.isComplete || incoming.hasAttachment)) {
          const diagnoseUrl = `${baseUrl}/api/diagnose`;
          const diagnoseResponse = await fetch(diagnoseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              history: [{ type: 'user', content: messageText }],
              imageBase64: imageBase64,
            }),
          });

          if (diagnoseResponse.ok) {
            const diagnoseData = await diagnoseResponse.json();
            if (diagnoseData?.success) {
              diagnoseReport = diagnoseData.report;
              const primary = diagnoseReport?.differential_diagnoses?.[0];
              if (primary) {
                whatsappReply += `\n\nDiagnose-Agent probable diagnosis:\n- ${primary.condition_name} (${primary.confidence_score || 'unknown confidence'})`;
              }

              const prescribeUrl = `${baseUrl}/api/prescribe`;
              const prescribeResponse = await fetch(prescribeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  diagnosticReport: diagnoseReport,
                  patientAge: 30,
                  allergies: [],
                }),
              });

              if (prescribeResponse.ok) {
                const prescribeData = await prescribeResponse.json();
                if (prescribeData?.success) {
                  const meds = prescribeData.prescription?.prescriptions || [];
                  if (meds.length > 0) {
                    prescribeSummary = meds
                      .slice(0, 3)
                      .map((item: any, index: number) =>
                        `${index + 1}. ${item.medication_name} - ${item.dosage}, ${item.frequency}, ${item.duration}`
                      )
                      .join('\n');
                    whatsappReply += `\n\nPrescribe-Agent Suggested Medications:\n${prescribeSummary}`;
                  }
                }
              }
            }
          }
        }
      } catch (internalErr) {
        console.warn('Internal Next.js routes failed:', internalErr);
      }
    }

    // Guarantee a response: If all AI services failed or returned empty, provide a welcoming fallback message
    if (!whatsappReply) {
      const greetingPatterns = /^(hello|hi|hey|namaste|pranam|greetings|hola|good morning|good evening|good afternoon)\b/i;
      if (greetingPatterns.test(messageText.trim())) {
        whatsappReply = 'Hello! Welcome to Nirog-Setu AI health assistant. 🙏\n\nHow can I assist you with your health today? Please describe any symptoms you are experiencing (such as fever, cough, chest pain, or headache) so I can guide you.';
      } else {
        whatsappReply = 'Hello! Welcome to Nirog-Setu AI. We received your message. Please describe your symptoms in detail so our medical AI team can assist you.';
      }
    }

    const phoneNumberId = incoming.phoneNumberId || WHATSAPP_PHONE_NUMBER_ID;
    let sentToWhatsApp = false;
    let sendError: string | null = null;

    if (phoneNumberId) {
      try {
        await sendWhatsappText(phoneNumberId, incoming.from, whatsappReply);
        sentToWhatsApp = true;
      } catch (error: any) {
        console.error('Failed to send WhatsApp reply message:', error);
        sendError = error.message;
      }
    }

    console.log(`💬 [WHATSAPP OUTGOING] To: ${incoming.from} | Sent: ${sentToWhatsApp} | Error: ${sendError || 'None'}\nReply text:\n${whatsappReply}\n---`);

    return NextResponse.json({
      success: true,
      whatsappWebhook: true,
      sentToWhatsApp,
      sendError,
      triageData,
      diagnoseReport,
      prescribeSummary,
      whatsappReply,
    });
  } catch (error: any) {
    console.error('WhatsApp webhook processing error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'WhatsApp webhook processing failure.' },
      { status: 500 }
    );
  }
}

