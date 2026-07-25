"""Google Maps / Hospital Finder Tool - locates nearest healthcare facilities."""

import httpx
import os


async def find_nearest_hospitals(latitude: float, longitude: float, specialty: str = "") -> dict:
    """Finds the nearest hospitals or PHCs based on patient location.

    Args:
        latitude: Patient's latitude coordinate.
        longitude: Patient's longitude coordinate.
        specialty: Optional medical specialty needed (e.g., 'pulmonology', 'cardiology').

    Returns:
        dict: List of nearest hospitals with distance, bed availability, and contact info.
    """
    api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")

    if not api_key:
        # Return mock data for testing without API key
        return {
            "status": "mock_data",
            "hospitals": [
                {
                    "name": "District Hospital, Patna",
                    "type": "District Hospital",
                    "distance_km": 3.2,
                    "beds_available": 12,
                    "specialties": ["General Medicine", "Pulmonology", "Pediatrics"],
                    "contact": "+91-612-2222222",
                    "address": "Ashok Rajpath, Patna, Bihar 800004",
                },
                {
                    "name": "PHC Danapur",
                    "type": "PHC",
                    "distance_km": 5.8,
                    "beds_available": 4,
                    "specialties": ["General Medicine"],
                    "contact": "+91-612-3333333",
                    "address": "Danapur, Patna, Bihar 801503",
                },
                {
                    "name": "AIIMS Patna",
                    "type": "Tertiary Hospital",
                    "distance_km": 8.1,
                    "beds_available": 45,
                    "specialties": ["Pulmonology", "Cardiology", "Surgery", "TB Ward"],
                    "contact": "+91-612-4444444",
                    "address": "Phulwarisharif, Patna, Bihar 801507",
                },
            ],
        }

    # Real Google Maps Places API call
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            keyword = f"hospital {specialty}" if specialty else "hospital"
            url = (
                f"https://maps.googleapis.com/maps/api/place/nearbysearch/json"
                f"?location={latitude},{longitude}&radius=15000&type=hospital"
                f"&keyword={keyword}&key={api_key}"
            )
            response = await client.get(url)
            if response.status_code != 200:
                return {"status": "error", "message": "Google Maps API failed"}

            data = response.json()
            hospitals = []
            for place in data.get("results", [])[:5]:
                hospitals.append({
                    "name": place.get("name", ""),
                    "address": place.get("vicinity", ""),
                    "rating": place.get("rating", 0),
                    "open_now": place.get("opening_hours", {}).get("open_now", None),
                    "location": place.get("geometry", {}).get("location", {}),
                })

            return {"status": "found", "hospitals": hospitals}
    except Exception as e:
        return {"status": "error", "message": str(e)}
