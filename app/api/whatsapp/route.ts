import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'whatsapp_verify';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v25.0';

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
  } = {
    from: message.from,
    phoneNumberId: metadata?.phone_number_id,
    messageText: '',
    hasAttachment: false,
  };

  if (message.type === 'text' && message.text?.body) {
    parsed.messageText = message.text.body;
  } else if (message.type === 'image') {
    parsed.messageText = 'Patient sent an image attachment via WhatsApp.';
    parsed.hasAttachment = true;
  } else if (message.type === 'audio') {
    parsed.messageText = 'Patient sent an audio message via WhatsApp.';
    parsed.hasAttachment = true;
  } else {
    parsed.messageText = `Received a WhatsApp ${message.type} message.`;
    parsed.hasAttachment = message.type !== 'text';
  }

  return parsed;
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

    const triageUrl = new URL('/api/triage', request.url).toString();
    const triageResponse = await fetch(triageUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: incoming.messageText,
        imageBase64: incoming.hasAttachment ? undefined : undefined,
        history: [{ type: 'user', content: incoming.messageText }],
      }),
    });

    const triageData = await triageResponse.json();
    if (!triageResponse.ok || !triageData) {
      return NextResponse.json(
        { success: false, error: triageData?.error || 'Triage route failed.' },
        { status: triageResponse.status || 500 }
      );
    }

    let whatsappReply = `Triage Assistant:
${triageData.reply}`;
    if (triageData?.translation && triageData.detectedLanguage?.toLowerCase() !== 'english') {
      whatsappReply += `\n\nEnglish translation:\n${triageData.translation}`;
    }

    let diagnoseReport: any = null;
    let prescribeSummary = '';

    if (triageData.isComplete || incoming.hasAttachment) {
      const diagnoseUrl = new URL('/api/diagnose', request.url).toString();
      const diagnoseResponse = await fetch(diagnoseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: [{ type: 'user', content: incoming.messageText }],
          imageBase64: incoming.hasAttachment ? undefined : undefined,
        }),
      });

      const diagnoseData = await diagnoseResponse.json();
      if (diagnoseResponse.ok && diagnoseData?.success) {
        diagnoseReport = diagnoseData.report;
        const primary = diagnoseReport?.differential_diagnoses?.[0];
        if (primary) {
          whatsappReply += `\n\nDiagnose-Agent probable diagnosis:\n- ${primary.condition_name} (${primary.confidence_score || 'unknown confidence'})`;
        }

        const prescribeUrl = new URL('/api/prescribe', request.url).toString();
        const prescribeResponse = await fetch(prescribeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            diagnosticReport: diagnoseReport,
            patientAge: 30,
            allergies: [],
          }),
        });

        const prescribeData = await prescribeResponse.json();
        if (prescribeResponse.ok && prescribeData?.success) {
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

    const phoneNumberId = incoming.phoneNumberId || WHATSAPP_PHONE_NUMBER_ID;
    let sentToWhatsApp = false;
    let sendError: string | null = null;

    if (phoneNumberId) {
      try {
        await sendWhatsappText(phoneNumberId, incoming.from, whatsappReply);
        sentToWhatsApp = true;
      } catch (error: any) {
        sendError = error.message;
      }
    }

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
