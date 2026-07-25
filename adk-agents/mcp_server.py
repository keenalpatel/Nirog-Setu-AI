"""
Nirog Setu AI - Medical MCP Tool Server
Exposes OpenFDA, UMLS, Google Maps, and WhatsApp integrations as MCP tools.
Any MCP-compliant client (ADK agents, Claude Desktop, etc.) can consume these.

Run: python mcp_server.py (stdio mode)
"""

import asyncio
import json
import os
from dotenv import load_dotenv

import httpx
from mcp import types as mcp_types
from mcp.server.lowlevel import Server, NotificationOptions
from mcp.server.models import InitializationOptions
import mcp.server.stdio

load_dotenv()

# --- MCP Server Instance ---
app = Server("nirog-setu-medical-tools")


# ═══════════════════════════════════════════════════════════════════════
# TOOL IMPLEMENTATIONS
# ═══════════════════════════════════════════════════════════════════════


async def _check_drug_safety(drug_name: str) -> dict:
    """OpenFDA drug safety lookup."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            url = f"https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:{drug_name}&limit=5"
            response = await client.get(url)
            if response.status_code != 200:
                return {"status": "no_data", "drug_name": drug_name}

            data = response.json()
            results = data.get("results", [])
            adverse_events = []
            for result in results[:5]:
                for reaction in result.get("patient", {}).get("reaction", [])[:3]:
                    adverse_events.append(reaction.get("reactionmeddrapt", "Unknown"))

            return {
                "status": "found",
                "drug_name": drug_name,
                "common_adverse_events": list(set(adverse_events))[:10],
                "total_reports": data.get("meta", {}).get("results", {}).get("total", 0),
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def _check_drug_interaction(drug_a: str, drug_b: str) -> dict:
    """OpenFDA drug interaction check."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            url = (
                f"https://api.fda.gov/drug/event.json?"
                f"search=patient.drug.medicinalproduct:{drug_a}+AND+patient.drug.medicinalproduct:{drug_b}"
                f"&limit=5"
            )
            response = await client.get(url)
            if response.status_code != 200:
                return {"status": "no_interaction_data", "drug_a": drug_a, "drug_b": drug_b}

            data = response.json()
            total = data.get("meta", {}).get("results", {}).get("total", 0)
            return {
                "status": "found",
                "drug_a": drug_a,
                "drug_b": drug_b,
                "co_reported_adverse_events": total,
                "risk_level": "high" if total > 100 else "moderate" if total > 10 else "low",
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def _lookup_icd10(condition_name: str) -> dict:
    """UMLS + NLM Clinical Tables ICD-10 lookup."""
    import re
    clean = re.sub(r'\(.*?\)', '', condition_name)
    clean = re.sub(r'high|moderate|low|acute|severe|chronic', '', clean, flags=re.IGNORECASE)
    clean = re.sub(r'[^a-zA-Z\s]', '', clean).strip()

    # Try UMLS
    api_key = os.getenv("UMLS_API_KEY")
    if api_key:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                url = f"https://uts-ws.nlm.nih.gov/rest/search/current?string={clean}&sabs=ICD10CM&returnIdType=sourceUi&apiKey={api_key}"
                resp = await client.get(url)
                if resp.status_code == 200:
                    results = resp.json().get("result", {}).get("results", [])
                    if results:
                        match = next((r for r in results if r.get("ui", "").startswith("J")), results[0])
                        return {"status": "found", "source": "UMLS", "icd_10_code": match["ui"], "canonical_name": match["name"]}
        except Exception:
            pass

    # Fallback: NLM Clinical Tables
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            url = f"https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms={clean}&maxList=10"
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                matches = data[3] if len(data) > 3 else []
                if matches:
                    m = next((x for x in matches if x[0].startswith("J")), matches[0])
                    return {"status": "found", "source": "NLM", "icd_10_code": m[0], "canonical_name": m[1]}
    except Exception:
        pass

    return {"status": "not_found", "condition": condition_name, "icd_10_code": "R69"}


async def _find_hospitals(latitude: float, longitude: float, specialty: str = "") -> dict:
    """Google Maps hospital finder."""
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")

    if not api_key:
        return {
            "status": "mock_data",
            "hospitals": [
                {"name": "District Hospital, Patna", "type": "District Hospital", "distance_km": 3.2, "beds_available": 12, "specialties": ["General Medicine", "Pulmonology"]},
                {"name": "PHC Danapur", "type": "PHC", "distance_km": 5.8, "beds_available": 4, "specialties": ["General Medicine"]},
                {"name": "AIIMS Patna", "type": "Tertiary", "distance_km": 8.1, "beds_available": 45, "specialties": ["Pulmonology", "Cardiology", "TB Ward"]},
            ],
        }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            keyword = f"hospital {specialty}" if specialty else "hospital"
            url = f"https://maps.googleapis.com/maps/api/place/nearbysearch/json?location={latitude},{longitude}&radius=15000&type=hospital&keyword={keyword}&key={api_key}"
            resp = await client.get(url)
            if resp.status_code != 200:
                return {"status": "error", "message": "Google Maps API failed"}
            data = resp.json()
            hospitals = [{"name": p.get("name"), "address": p.get("vicinity"), "rating": p.get("rating", 0)} for p in data.get("results", [])[:5]]
            return {"status": "found", "hospitals": hospitals}
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def _send_whatsapp(phone_number: str, message_text: str) -> dict:
    """Send WhatsApp message via Business API."""
    token = os.getenv("WHATSAPP_TOKEN", "")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    api_ver = os.getenv("WHATSAPP_API_VERSION", "v25.0")

    if not token or not phone_id:
        return {"status": "error", "message": "WhatsApp credentials not configured"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://graph.facebook.com/{api_ver}/{phone_id}/messages",
                json={"messaging_product": "whatsapp", "to": phone_number, "type": "text", "text": {"body": message_text}},
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"status": "sent", "message_id": data.get("messages", [{}])[0].get("id", "")}
            return {"status": "failed", "http_status": resp.status_code, "error": resp.text[:200]}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ═══════════════════════════════════════════════════════════════════════
# MCP PROTOCOL HANDLERS
# ═══════════════════════════════════════════════════════════════════════


@app.list_tools()
async def list_tools() -> list[mcp_types.Tool]:
    """Advertise all medical tools available via MCP."""
    return [
        mcp_types.Tool(
            name="check_drug_safety",
            description="Checks drug safety from OpenFDA including adverse events and warnings. Use before prescribing any medication.",
            inputSchema={
                "type": "object",
                "properties": {"drug_name": {"type": "string", "description": "Medication name to check (e.g., 'Rifampicin')"}},
                "required": ["drug_name"],
            },
        ),
        mcp_types.Tool(
            name="check_drug_interaction",
            description="Checks potential interaction between two drugs using OpenFDA adverse event co-reports.",
            inputSchema={
                "type": "object",
                "properties": {
                    "drug_a": {"type": "string", "description": "First medication name"},
                    "drug_b": {"type": "string", "description": "Second medication name"},
                },
                "required": ["drug_a", "drug_b"],
            },
        ),
        mcp_types.Tool(
            name="lookup_icd10_code",
            description="Looks up ICD-10 code for a medical condition using UMLS and NLM Clinical Tables. Returns standardized code and canonical name.",
            inputSchema={
                "type": "object",
                "properties": {"condition_name": {"type": "string", "description": "Medical condition to look up (e.g., 'Bacterial Pneumonia')"}},
                "required": ["condition_name"],
            },
        ),
        mcp_types.Tool(
            name="find_nearest_hospitals",
            description="Finds nearest hospitals/PHCs based on GPS coordinates and optional specialty. Returns distance, bed availability, and contacts.",
            inputSchema={
                "type": "object",
                "properties": {
                    "latitude": {"type": "number", "description": "Patient latitude"},
                    "longitude": {"type": "number", "description": "Patient longitude"},
                    "specialty": {"type": "string", "description": "Medical specialty needed (optional)", "default": ""},
                },
                "required": ["latitude", "longitude"],
            },
        ),
        mcp_types.Tool(
            name="send_whatsapp_message",
            description="Sends a text message to a patient via WhatsApp Business API. Use for appointment reminders, medication alerts, and emergency notifications.",
            inputSchema={
                "type": "object",
                "properties": {
                    "phone_number": {"type": "string", "description": "Recipient phone in international format (e.g., '918668988741')"},
                    "message_text": {"type": "string", "description": "Message text to send"},
                },
                "required": ["phone_number", "message_text"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[mcp_types.Content]:
    """Execute a tool call from an MCP client."""
    try:
        if name == "check_drug_safety":
            result = await _check_drug_safety(arguments["drug_name"])
        elif name == "check_drug_interaction":
            result = await _check_drug_interaction(arguments["drug_a"], arguments["drug_b"])
        elif name == "lookup_icd10_code":
            result = await _lookup_icd10(arguments["condition_name"])
        elif name == "find_nearest_hospitals":
            result = await _find_hospitals(
                arguments["latitude"], arguments["longitude"], arguments.get("specialty", "")
            )
        elif name == "send_whatsapp_message":
            result = await _send_whatsapp(arguments["phone_number"], arguments["message_text"])
        else:
            result = {"error": f"Unknown tool: {name}"}

        return [mcp_types.TextContent(type="text", text=json.dumps(result, indent=2))]
    except Exception as e:
        return [mcp_types.TextContent(type="text", text=json.dumps({"error": str(e)}))]


# ═══════════════════════════════════════════════════════════════════════
# SERVER RUNNER
# ═══════════════════════════════════════════════════════════════════════


async def run_stdio_server():
    """Run as stdio MCP server (for local/subprocess use)."""
    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="nirog-setu-medical-tools",
                server_version="1.0.0",
                capabilities=app.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )


if __name__ == "__main__":
    print("🏥 Nirog Setu Medical MCP Server starting (stdio mode)...")
    print("   Tools: check_drug_safety, check_drug_interaction, lookup_icd10_code, find_nearest_hospitals, send_whatsapp_message")
    asyncio.run(run_stdio_server())
