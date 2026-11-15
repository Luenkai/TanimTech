"""Soil reference data and optional vision analysis helpers."""
import base64
import json
import os
import urllib.error
import urllib.request


DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "soil_profiles.json")


def load_dataset():
    try:
        with open(DATA_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {"version": "1.0", "profiles": []}


DATASET = load_dataset()
PROFILES = {p["slug"]: p for p in DATASET.get("profiles", [])}


def profile_for(texture):
    return PROFILES.get(str(texture or "").strip().lower())


def soil_matches(crop_slug, context, crop=None):
    """Return a non-scoring soil suitability signal for transparent ranking.
    Core crops use the curated soil_profiles.json; extended-catalog plants use their ECOCROP
    texture/drainage requirements (crop record passed in)."""
    if crop is not None and "soil_texture" in crop:
        from .plant_catalog import soil_match
        return soil_match(crop, context)
    texture = str(context.get("soilTexture") or context.get("soilType") or "").strip().lower()
    profile = profile_for(texture)
    if not profile:
        return {"status": "unknown", "points": None, "label": "No soil profile"}
    status = profile.get("cropSuitability", {}).get(crop_slug, "unknown")
    return {"status": status, "points": {"good": 100, "caution": 60, "poor": 20}.get(status), "label": profile["name"]}


def _vision_request(image_bytes, mime_type, details):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Soil image analysis is not configured. Set OPENAI_API_KEY on the backend.")
    base_url = os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = os.environ.get("SOIL_VISION_MODEL", "gpt-6-luna")
    prompt = (
        "Assess this soil image only as a cautious visual screening aid. Do not claim laboratory measurements. "
        "Return JSON with keys suggestedTexture (one of clay, loam, sandy, silty, peaty, unknown), "
        "confidence (low, medium, high), observations (array of short strings), limitations (array of short strings), "
        "and recommendedChecks (array of short strings). Use unknown when the image is unclear. "
        f"User-provided soil details, which may be more reliable than appearance: {json.dumps(details, ensure_ascii=False)}"
    )
    payload = {
        "model": model,
        "reasoning": {"effort": "low"},
        "max_completion_tokens": 1200,
        "response_format": {"type": "json_schema", "json_schema": {"name": "soil_visual_review", "strict": True, "schema": {
            "type": "object",
            "properties": {
                "suggestedTexture": {"type": "string", "enum": ["clay", "loam", "sandy", "silty", "peaty", "unknown"]},
                "confidence": {"type": "string", "enum": ["low", "medium", "high"]},
                "observations": {"type": "array", "items": {"type": "string"}},
                "limitations": {"type": "array", "items": {"type": "string"}},
                "recommendedChecks": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["suggestedTexture", "confidence", "observations", "limitations", "recommendedChecks"],
            "additionalProperties": False,
        }}},
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64.b64encode(image_bytes).decode()}"}},
        ]}],
    }
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            result = json.loads(response.read().decode())
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError("The soil analysis service could not be reached. Try again or continue manually.") from exc
    if result.get("error"):
        error = result["error"]
        raise RuntimeError(error.get("message", "The soil analysis service returned an error.") if isinstance(error, dict) else str(error))
    content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
    if isinstance(content, list):
        content = "".join(item.get("text", "") for item in content if isinstance(item, dict))
    content = str(content).strip().removeprefix("```json").removesuffix("```").strip()
    try:
        return json.loads(content)
    except (TypeError, ValueError) as exc:
        raise RuntimeError("The soil analysis service returned an unreadable result. Try again or continue manually.") from exc


def analyze_image(image_bytes, mime_type, details=None):
    raw = _vision_request(image_bytes, mime_type, details or {})
    texture = str(raw.get("suggestedTexture", "unknown")).lower()
    if texture not in PROFILES:
        texture = "unknown"
    profile = profile_for(texture)
    return {
        "suggestedTexture": texture,
        "suggestedSoilType": profile["name"] if profile else "Unknown",
        "confidence": raw.get("confidence", "low"),
        "observations": [str(x) for x in raw.get("observations", [])][:6],
        "limitations": [str(x) for x in raw.get("limitations", [])][:6] or ["A photo cannot measure pH, nutrients, salinity, or drainage."],
        "recommendedChecks": [str(x) for x in raw.get("recommendedChecks", [])][:6],
        "datasetProfile": profile,
    }
