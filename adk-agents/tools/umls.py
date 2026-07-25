"""UMLS / NLM Clinical Tables Tool - ICD-10 code lookup for diagnoses."""

import httpx
import os


async def lookup_icd10_code(condition_name: str) -> dict:
    """Looks up the ICD-10 code for a medical condition using UMLS and NLM Clinical Tables.

    Args:
        condition_name: The medical condition name to look up (e.g., 'Bacterial Pneumonia').

    Returns:
        dict: ICD-10 code, canonical name, and source of the lookup.
    """
    # Clean the condition term
    import re
    clean_term = re.sub(r'\(.*?\)', '', condition_name)
    clean_term = re.sub(r'high|moderate|low|acute|severe|chronic', '', clean_term, flags=re.IGNORECASE)
    clean_term = re.sub(r'[^a-zA-Z\s]', '', clean_term).strip()

    # Try UMLS API first
    umls_result = await _try_umls(clean_term)
    if umls_result:
        return umls_result

    # Fallback to NLM Clinical Tables
    nlm_result = await _try_nlm(clean_term)
    if nlm_result:
        return nlm_result

    return {"status": "not_found", "condition": condition_name, "icd_10_code": "R69"}


async def _try_umls(term: str) -> dict | None:
    """Try UMLS Metathesaurus REST API for ICD-10 lookup."""
    api_key = os.getenv("UMLS_API_KEY")
    if not api_key:
        return None

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            url = (
                f"https://uts-ws.nlm.nih.gov/rest/search/current"
                f"?string={term}&sabs=ICD10CM&returnIdType=sourceUi&apiKey={api_key}"
            )
            response = await client.get(url)
            if response.status_code != 200:
                return None

            data = response.json()
            results = data.get("result", {}).get("results", [])
            if not results:
                return None

            # Prefer respiratory codes (J-prefix)
            match = next((r for r in results if r.get("ui", "").startswith("J")), results[0])
            return {
                "status": "found",
                "source": "UMLS",
                "icd_10_code": match["ui"],
                "canonical_name": match["name"],
            }
    except Exception:
        return None


async def _try_nlm(term: str) -> dict | None:
    """Fallback to NLM Clinical Tables API."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            url = f"https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms={term}&maxList=10"
            response = await client.get(url)
            if response.status_code != 200:
                return None

            data = response.json()
            matches = data[3] if len(data) > 3 else []
            if not matches:
                return None

            # Prefer J-codes for respiratory
            respiratory = next((m for m in matches if m[0].startswith("J")), None)
            match = respiratory or matches[0]

            return {
                "status": "found",
                "source": "NLM",
                "icd_10_code": match[0],
                "canonical_name": match[1],
            }
    except Exception:
        return None
