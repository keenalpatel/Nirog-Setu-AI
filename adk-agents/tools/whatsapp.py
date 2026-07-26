"""WhatsApp Messaging Tool - sends messages to patients via WhatsApp Business API.

Also exposes helpers for media download and Gemini-based audio transcription,
ported from app/api/whatsapp/route.ts.
"""

import os
import httpx
from google.genai import types as genai_types


async def send_whatsapp_message(phone_number: str, message_text: str) -> dict:
    """Sends a text message to a patient via WhatsApp Business API.

    Args:
        phone_number: The recipient's phone number in international format (e.g., '918668988741').
        message_text: The text message to send to the patient.

    Returns:
        dict: Status of the message delivery including message ID if successful.
    """
    token = os.getenv("WHATSAPP_TOKEN", "")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    api_version = os.getenv("WHATSAPP_API_VERSION", "v25.0")

    if not token or not phone_number_id:
        return {"status": "error", "message": "WhatsApp credentials not configured"}

    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": phone_number,
        "type": "text",
        "text": {"body": message_text},
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    "status": "sent",
                    "message_id": data.get("messages", [{}])[0].get("id", ""),
                    "recipient": phone_number,
                }
            else:
                return {
                    "status": "failed",
                    "http_status": response.status_code,
                    "error": response.text[:200],
                }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def download_whatsapp_media(media_id: str) -> tuple[bytes, str] | None:
    """Download a WhatsApp media object and return (raw_bytes, mime_type).

    Ported from app/api/whatsapp/route.ts downloadWhatsappMedia.
    Returns None if credentials are missing or the download fails.
    """
    token = os.getenv("WHATSAPP_TOKEN", "")
    api_version = os.getenv("WHATSAPP_API_VERSION", "v25.0")
    if not token or not media_id:
        return None

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Step 1: resolve the media URL
            info_res = await client.get(
                f"https://graph.facebook.com/{api_version}/{media_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if not info_res.is_success:
                return None
            media_url = info_res.json().get("url")
            if not media_url:
                return None

            # Step 2: download the binary
            dl_res = await client.get(media_url, headers={"Authorization": f"Bearer {token}"})
            if not dl_res.is_success:
                return None

            mime_type = dl_res.headers.get("content-type", "image/jpeg")
            return dl_res.content, mime_type
    except Exception:
        return None


async def transcribe_whatsapp_audio(media_id: str) -> str | None:
    """Download a WhatsApp audio message and transcribe it using Gemini.

    Ported from app/api/whatsapp/route.ts transcribeAudio.
    Returns the transcribed text, or None on failure.
    """
    result = await download_whatsapp_media(media_id)
    if not result:
        return None

    audio_bytes, mime_type = result

    try:
        import google.genai as genai
        client = genai.Client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                genai_types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                genai_types.Part(
                    text=(
                        "Transcribe this audio message exactly as spoken. "
                        "Output ONLY the transcribed text, nothing else. "
                        "If the audio is in Hindi, Marathi, Telugu, or any other language, "
                        "transcribe it in that language using the original script."
                    )
                ),
            ],
        )
        return response.text.strip() if response.text else None
    except Exception:
        return None
