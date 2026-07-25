"""OpenFDA Drug Safety Tool - checks drug interactions and adverse effects."""

import httpx


async def check_drug_safety(drug_name: str) -> dict:
    """Checks drug safety information from OpenFDA including adverse events and interactions.

    Args:
        drug_name: The name of the medication to check safety for.

    Returns:
        dict: Drug safety information including adverse events, warnings, and interaction data.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Search for adverse events
            url = f"https://api.fda.gov/drug/event.json?search=patient.drug.medicinalproduct:{drug_name}&limit=5"
            response = await client.get(url)

            if response.status_code != 200:
                return {"status": "no_data", "message": f"No FDA data found for {drug_name}"}

            data = response.json()
            results = data.get("results", [])

            adverse_events = []
            for result in results[:5]:
                reactions = result.get("patient", {}).get("reaction", [])
                for reaction in reactions[:3]:
                    adverse_events.append(reaction.get("reactionmeddrapt", "Unknown"))

            # Search for drug label warnings
            label_url = f"https://api.fda.gov/drug/label.json?search=openfda.brand_name:{drug_name}&limit=1"
            label_response = await client.get(label_url)
            warnings = ""
            if label_response.status_code == 200:
                label_data = label_response.json()
                label_results = label_data.get("results", [])
                if label_results:
                    warnings = label_results[0].get("warnings", [""])[0][:500] if label_results[0].get("warnings") else ""

            return {
                "status": "found",
                "drug_name": drug_name,
                "common_adverse_events": list(set(adverse_events))[:10],
                "warnings_excerpt": warnings,
                "total_reports": data.get("meta", {}).get("results", {}).get("total", 0),
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_drug_interaction(drug_a: str, drug_b: str) -> dict:
    """Checks potential interaction between two drugs using OpenFDA data.

    Args:
        drug_a: First medication name.
        drug_b: Second medication name.

    Returns:
        dict: Interaction information between the two drugs.
    """
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
            total_reports = data.get("meta", {}).get("results", {}).get("total", 0)

            return {
                "status": "found",
                "drug_a": drug_a,
                "drug_b": drug_b,
                "co_reported_adverse_events": total_reports,
                "risk_level": "high" if total_reports > 100 else "moderate" if total_reports > 10 else "low",
            }
    except Exception as e:
        return {"status": "error", "message": str(e)}
