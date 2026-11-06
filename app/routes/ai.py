import os
import json
import httpx
import asyncio
import time
import re

from typing import Optional, Literal
from datetime import date

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.db import get_db
from app.models.catalog import ServiceCategory

router = APIRouter(
    prefix="/ai",
    tags=["AI Assistant"]
)


# -----------------------------
# 1. Request Schema
# -----------------------------

class AIRequest(BaseModel):
    message: str = Field(
        min_length=3,
        max_length=2000,
        description="Customer's service request"
    )


class AIFindVendorsRequest(AIRequest):
    max_radius_km: float = Field(default=100, gt=0, le=100)
    limit: int = Field(default=100, ge=1, le=100)


# -----------------------------
# 2. AI Response Schema
# -----------------------------

class ServiceIntent(BaseModel):

    @field_validator("urgency", mode="before")
    @classmethod
    def validate_urgency(cls, value):
        if value is None:
            return "normal"

        value = str(value).strip().lower()

        if value in ("", "null", "none"):
            return "normal"

        return value

    service_category: Optional[str] = None

    problem_description: Optional[str] = None

    preferred_date: Optional[str] = None

    preferred_time: Optional[str] = None

    location: Optional[str] = None

    urgency: Literal[
        "low",
        "normal",
        "high",
        "emergency"
    ] = "normal"

    needs_clarification: bool = False

    clarification_question: Optional[str] = None


class AIResponse(BaseModel):
    success: bool
    provider: str
    intent: ServiceIntent


# -----------------------------
# 3. AI System Prompt
# -----------------------------

SYSTEM_PROMPT = """
You are DailyDrill, an AI assistant for a hyperlocal
service marketplace in India.

Your job is to understand customer service requests.

For urgency, ALWAYS return exactly one of:
"low", "normal", "high", "emergency".

NEVER return null, "null", or an empty string for urgency.
If urgency is not specified by the user, return "normal".

Supported service categories:
- Electrician
- Plumber
- Carpenter
- Painter
- Maid/Housekeeping
- Cook
- Appliance Repair

Extract the following information:

1. service_category
2. problem_description
3. preferred_date
4. preferred_time
5. location
6. urgency
7. needs_clarification
8. clarification_question

Rules:

- Understand English, Hindi and Hinglish.
- Do not invent customer information.
- If the service category is unclear, return null and ask which service they need.
- This marketplace currently serves Palghar only. Do not ask the customer for
  their location or imply that another city can be searched.
- Do not invent dates or times.
- Use low, normal, high or emergency for urgency.
- Ask one concise clarification question only when the service category is
  unclear. A missing optional detail must not block a vendor search.
- Do not invent vendors, ratings, availability, completed jobs, or prices.
- Return ONLY valid JSON.

IMPORTANT JSON OUTPUT RULES:

- Always return valid JSON matching the ServiceIntent schema.
- problem_description must be a string or null.
- If the user has not described a specific problem, return null.
- Never invent a problem description.
- service_category must be null if the service is unclear.
- location must be null unless the user explicitly names a location.
- Set needs_clarification to true only when service_category is unclear.
- Never assume the user's personal/current location.

Expected JSON structure:

{
    "service_category": "Electrician",
    "problem_description": "Switchboard is damaged",
    "preferred_date": "tomorrow",
    "preferred_time": null,
    "location": "Palghar",
    "urgency": "normal",
    "needs_clarification": false,
    "clarification_question": null
}
"""


# -----------------------------
# 4. Ollama Provider
# -----------------------------

async def call_ollama(message: str) -> dict:

    base_url = os.getenv(
        "OLLAMA_BASE_URL",
        "http://localhost:11434"
    )

    model = os.getenv(
        "OLLAMA_MODEL",
        "llama3.2:3b"
    )

    payload = {
        "model": model,
        "stream": False,
        "format": "json",
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": message
            }
        ]
    }

    async with httpx.AsyncClient(timeout=90.0) as client:

        response = await client.post(
            f"{base_url}/api/chat",
            json=payload
        )

        response.raise_for_status()

        result = response.json()

        content = result["message"]["content"]

        return json.loads(content)


# -----------------------------
# 5. Groq Fallback Provider
# -----------------------------

async def call_groq(message: str) -> dict:

    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise RuntimeError("Groq API key is missing")

    model = os.getenv(
        "GROQ_MODEL",
        "llama-3.3-70b-versatile"
    )

    payload = {
        "model": model,
        "temperature": 0,
        "response_format": {
            "type": "json_object"
        },
        "messages": [
            {
                "role": "system",
                "content": SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": message
            }
        ]
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=60.0) as client:

        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            json=payload,
            headers=headers
        )

        response.raise_for_status()

        result = response.json()

        content = result["choices"][0]["message"]["content"]

        return json.loads(content)


# -----------------------------
# 6. AI Provider Router
# -----------------------------

async def generate_intent(message: str):

    # Try Ollama first

    try:

        result = await call_ollama(message)

        intent = ServiceIntent.model_validate(result)

        return "ollama", intent

    except Exception as ollama_error:

        print("Ollama failed:", str(ollama_error))

    # Fallback to Groq

    try:

        result = await call_groq(message)

        intent = ServiceIntent.model_validate(result)

        return "groq", intent

    except Exception as groq_error:

        print("Groq failed:", str(groq_error))

        raise HTTPException(
            status_code=503,
            detail="AI services are currently unavailable."
        )



# -----------------------------
# Location Geocoding
# -----------------------------

GEOCODING_CACHE = {}
GEOCODING_LOCK = asyncio.Lock()
LAST_GEOCODING_REQUEST = 0.0
# Default service location: Palghar city
DEFAULT_CITY = "Palghar"
DEFAULT_LATITUDE = 19.69693
DEFAULT_LONGITUDE = 72.76543


async def geocode_location(location: str):
    cache_key = location.strip().casefold()

    if cache_key in GEOCODING_CACHE:
        return GEOCODING_CACHE[cache_key]

    api_key = settings.geoapify_api_key

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEOAPIFY_API_KEY is not configured."
        )

    params = {
        "text": f"{location}, India",
        "format": "json",
        "limit": 1,
        "filter": "countrycode:in",
        "apiKey": api_key
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                "https://api.geoapify.com/v1/geocode/search",
                params=params
            )

            response.raise_for_status()
            data = response.json()

    except httpx.HTTPStatusError as exc:
        print("GEOAPIFY STATUS:", exc.response.status_code)
        print("GEOAPIFY RESPONSE:", exc.response.text[:1000])

        raise HTTPException(
            status_code=503,
            detail="Location service returned an error."
        ) from exc

    except httpx.RequestError as exc:
        print("GEOAPIFY CONNECTION ERROR:", repr(exc))

        raise HTTPException(
            status_code=503,
            detail="Unable to connect to location service."
        ) from exc

    results = data.get("results", [])

    if not results:
        GEOCODING_CACHE[cache_key] = None
        return None

    result = results[0]

    coordinates = {
        "latitude": float(result["lat"]),
        "longitude": float(result["lon"]),
        "display_name": result.get("formatted", location)
    }

    GEOCODING_CACHE[cache_key] = coordinates

    return coordinates
# -----------------------------
# 7. AI API Endpoint
# -----------------------------

@router.post(
    "/interpret",
    response_model=AIResponse
)
async def interpret_request(request: AIRequest):

    provider, intent = await generate_intent(
        request.message
    )

    return AIResponse(
        success=True,
        provider=provider,
        intent=intent
    )
    

SKILL_SYNONYMS = {
    "switchboard": [
        "switchboard",
        "switch board",
        "electrical panel"
    ],
    "damaged": [
        "damaged",
        "broken",
        "faulty",
        "repair",
        "fix",
        "not working",
        "fault"
    ],
    "wiring": [
        "wiring",
        "wire",
        "cable",
        "electrical connection"
    ],
    "fan": [
        "fan",
        "ceiling fan",
        "fan repair"
    ],
    "light": [
        "light",
        "lighting",
        "light fitting",
        "bulb"
    ],
    "installation": [
        "installation",
        "install",
        "fitting",
        "setup"
    ],
    "troubleshooting": [
        "troubleshooting",
        "diagnosis",
        "electrical fault"
    ],
    "plumbing": [
    "plumbing",
    "plumbing work",
    "plumber",
    "pipe repair",
    "pipe leakage",
    "water leakage",
    "tap repair",
    "bathroom fitting",
    "drainage",
    "water pipeline"
],

"leakage": [
    "leakage",
    "water leak",
    "pipe leak",
    "water leakage",
    "leaking pipe"
],

"tap": [
    "tap",
    "faucet",
    "tap repair",
    "tap installation"
],
}


def normalize_text(value: str) -> str:
    if not value:
        return ""
    
    value = value.lower()
    value = re.sub(r"[^a-z0-9\s]", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def phrase_matches(phrase: str, text: str) -> bool:
    pattern = r"(?<![a-z0-9])" + re.escape(phrase) + r"(?![a-z0-9])"
    return bool(re.search(pattern, text))


def rank_vendor_candidates(
    rows,
    problem_description: str,
    radius_km: float,
    limit: int
):
    problem = normalize_text(problem_description)

    # Identify relevant concepts from the customer's problem.
    matched_concepts = []

    for concept, synonyms in SKILL_SYNONYMS.items():
        if any(
            phrase_matches(normalize_text(term), problem)
            for term in synonyms
        ):
            matched_concepts.append((concept, synonyms))

    ranked_vendors = []

    for row in rows:
        vendor = dict(row)

        # Distance score: maximum 70 points.
        distance = vendor["distance_km"]

        distance_score = max(
            0,
            1 - distance / radius_km
        ) * 70

        # Skill relevance score: maximum 30 points.
        skill_text = normalize_text(
            vendor.get("skill_description") or ""
        )

        matched_skill_terms = []
        matched_skill_concepts = 0

        for concept, synonyms in matched_concepts:
            matched_term = next(
                (
                    term for term in synonyms
                    if phrase_matches(
                        normalize_text(term),
                        skill_text
                    )
                ),
                None
            )

            if matched_term:
                matched_skill_concepts += 1
                matched_skill_terms.append(matched_term)

        if matched_concepts:
            relevance_ratio = (
                matched_skill_concepts / len(matched_concepts)
            )
        else:
            relevance_ratio = 0

        skill_score = relevance_ratio * 30

        total_score = distance_score + skill_score

        vendor["ranking_score"] = round(total_score, 2)

        vendor["ranking_breakdown"] = {
            "distance_score": round(distance_score, 2),
            "skill_relevance_score": round(skill_score, 2),
            "matched_skill_terms": matched_skill_terms
        }

        vendor.pop("skill_description", None)

        ranked_vendors.append(vendor)

    ranked_vendors.sort(
        key=lambda vendor: (
            -vendor["ranking_score"],
            vendor["distance_km"]
        )
    )

    return ranked_vendors[:limit]

def normalize(value: str) -> str:
    return "".join(
        character.lower()
        for character in value
        if character.isalnum()
    )


def add_vendor_recommendations(
    vendors: list[dict],
    service_name: str
) -> list[dict]:
    if not vendors:
        return vendors

    closest_distance = min(vendor["distance_km"] for vendor in vendors)

    for index, vendor in enumerate(vendors):
        reasons = []

        if index == 0:
            reasons.append(f"Listed for {service_name}")

        matched_terms = vendor["ranking_breakdown"]["matched_skill_terms"]
        if matched_terms:
            reasons.append(
                "Relevant experience: " + ", ".join(matched_terms)
            )

        distance = vendor["distance_km"]
        if distance == closest_distance:
            reasons.append(f"Closest match at {distance:.1f} km from Palghar")
        else:
            reasons.append(f"{distance:.1f} km from Palghar")

        if vendor["total_reviews"] > 0:
            reasons.append(
                f'{vendor["average_rating"]:.1f}/5 from '
                f'{vendor["total_reviews"]} customer reviews'
            )

        if vendor["completed_jobs"] > 0:
            reasons.append(
                f'{vendor["completed_jobs"]} completed service'
                f'{"s" if vendor["completed_jobs"] != 1 else ""}'
            )

        vendor["recommendation_reasons"] = reasons
        vendor["is_recommended"] = index == 0

    return vendors


@router.post("/find-vendors")
async def find_vendors(
    request: AIFindVendorsRequest,
    db: Session = Depends(get_db)
):
    # 1. Interpret customer request
    provider, intent = await generate_intent(request.message)

    # 2. Validate service category
    if not intent.service_category or intent.needs_clarification:
        return {
            "success": True,
            "status": "needs_clarification",
            "provider": provider,
            "intent": intent.model_dump(),
            "clarification_question": (
                intent.clarification_question
                or "Aapko kaunsi service chahiye?"
            ),
            "vendors": []
        }

    # 3. Match category with database
    categories = db.query(ServiceCategory).filter(
        ServiceCategory.is_active.is_(True)
    ).all()

    requested_category = normalize(intent.service_category)

    matched_category = next(
        (
            category for category in categories
            if requested_category in {
                normalize(category.name),
                normalize(category.slug)
            }
        ),
        None
    )

    if not matched_category:
        return {
            "success": True,
            "status": "category_not_found",
            "provider": provider,
            "intent": intent.model_dump(),
            "available_categories": [
                category.name for category in categories
            ],
            "vendors": []
        }

    # 4. Always use Palghar city coordinates
    latitude = DEFAULT_LATITUDE
    longitude = DEFAULT_LONGITUDE

    location_resolution = {
        "requested_location": intent.location,
        "display_name": DEFAULT_CITY,
        "latitude": latitude,
        "longitude": longitude,
        "source": "default_city"
    }

    print("\n========== AI VENDOR SEARCH DEBUG ==========")
    print("AI Provider:", provider)
    print("Extracted Intent:", intent.model_dump())
    print("Matched Category:", matched_category.name)
    print("Matched Category ID:", matched_category.id)
    print("Search City:", DEFAULT_CITY)
    print("Latitude:", latitude)
    print("Longitude:", longitude)
    print("Maximum Radius:", request.max_radius_km)
    print("============================================")

    # 5. PostGIS vendor search
    search_sql = text("""
        SELECT
            v.id AS vendor_id,
            v.business_name,
            v.description,
            vl.address_label,
            v.accepting_requests,
            vs.category_id,
            vs.skill_description,
            COALESCE(review_stats.average_rating, 0)::float AS average_rating,
            COALESCE(review_stats.total_reviews, 0)::int AS total_reviews,
            COALESCE(booking_stats.completed_jobs, 0)::int AS completed_jobs,

            ROUND(
                (
                    ST_Distance(
                        ST_SetSRID(
                            ST_MakePoint(vl.longitude, vl.latitude), 4326
                        )::geography,
                        ST_SetSRID(
                            ST_MakePoint(:longitude, :latitude), 4326
                        )::geography
                    ) / 1000.0
                )::numeric, 2
            )::float AS distance_km

        FROM vendors v

        JOIN vendor_locations vl
            ON vl.vendor_id = v.id

        JOIN vendor_services vs
            ON vs.vendor_id = v.id

        LEFT JOIN (
            SELECT
                vendor_id,
                AVG(rating) AS average_rating,
                COUNT(*) AS total_reviews
            FROM reviews
            GROUP BY vendor_id
        ) review_stats
            ON review_stats.vendor_id = v.id

        LEFT JOIN (
            SELECT
                vendor_id,
                COUNT(*) AS completed_jobs
            FROM bookings
            WHERE status = 'completed'
            GROUP BY vendor_id
        ) booking_stats
            ON booking_stats.vendor_id = v.id

        WHERE v.status = 'approved'
          AND v.is_active IS TRUE
          AND v.accepting_requests IS TRUE
          AND vs.category_id = :category_id

          AND ST_DWithin(
              ST_SetSRID(
                  ST_MakePoint(vl.longitude, vl.latitude), 4326
              )::geography,

              ST_SetSRID(
                  ST_MakePoint(:longitude, :latitude), 4326
              )::geography,

              :radius_meters
          )

        ORDER BY distance_km ASC
        LIMIT :candidate_limit
    """)

    # 6. Fetch extra candidates for ranking
    candidate_limit = min(
        max(request.limit * 5, 50),
        250
    )

    # 7. Progressive radius search
   # Progressive radius search
    search_radii = [3, 5, 10, 20, 30, 50, 75, 100]

    search_radii = [
        radius
        for radius in search_radii
        if radius <= request.max_radius_km
    ]

    if not search_radii or search_radii[-1] < request.max_radius_km:
        search_radii.append(request.max_radius_km)

    candidates = []
    radius_used = None

    for radius in search_radii:

        print(f"\nSearching vendors within {radius} KM")

        rows = db.execute(
            search_sql,
            {
                "category_id": matched_category.id,
                "latitude": latitude,
                "longitude": longitude,
                "radius_meters": radius * 1000,
                "candidate_limit": candidate_limit
            }
        ).mappings().all()

        print("Candidates Found:", len(rows))

        if rows:
            candidates = rows
            radius_used = radius
            break

    # 8. Rank candidates
    ranked_vendors = rank_vendor_candidates(
        rows=candidates,
        problem_description=intent.problem_description or "",
        radius_km=radius_used or request.max_radius_km,
        limit=request.limit
    )

    add_vendor_recommendations(ranked_vendors, matched_category.name)

    # 9. Return results
    return {
        "success": True,

        "status": (
            "vendors_found"
            if ranked_vendors
            else "no_vendors_found"
        ),

        "provider": provider,

        "intent": intent.model_dump(),

        "matched_category": {
            "id": matched_category.id,
            "name": matched_category.name,
            "slug": matched_category.slug
        },

        "location_resolution": location_resolution,

        "ranking": {
            "algorithm": "distance_and_skill_relevance",
            "distance_weight": 70,
            "skill_relevance_weight": 30
        },

        "search": {
            "radius_used_km": radius_used,
            "max_radius_km": request.max_radius_km,
            "candidate_count": len(candidates),
            "result_count": len(ranked_vendors)
        },

        "vendors": ranked_vendors
    }
