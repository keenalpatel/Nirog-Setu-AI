"""WhatsApp Messaging Tool - sends messages to patients via WhatsApp Business API."""

import os
import httpx


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
