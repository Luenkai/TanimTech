"""Soil reference data and optional vision analysis helpers."""
import base64
import json
import os
import urllib.error
import urllib.request


DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "soil_profiles.json")
MAX_IMAGE_BYTES = 10 * 1024 * 1024
DEFAULT_VISION_MODEL = "gpt-5-mini"
ALLOWED_TEXTURES = {"clay", "loam", "sandy", "silty", "peaty", "unknown"}
ALLOWED_CONFIDENCE = {"low", "medium", "high"}


class SoilAnalysisError(RuntimeError):
    """Actionable soil image analysis failure with an HTTP status for the client API."""

    def __init__(self, message, status_code=503):
        super().__init__(message)
        self.status_code = status_code


def load_dataset():
    try:
        with open(DATA_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {"version": "1.0", "profiles": []}


DATASET = load_dataset()
PROFILES = {p["slug"]: p for p in DATASET.get("profiles", [])}


def _setting(name, default=""):
    """Read a process setting, then a local .env without requiring python-dotenv."""
    value = os.environ.get(name)
    if value:
        return value.strip().strip('"').strip("'")
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    for path in (os.path.join(project_root, ".env"), os.path.join(project_root, "backend", ".env")):
        try:
            with open(path, encoding="utf-8") as fh:
                for raw in fh:
                    line = raw.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, candidate = line.split("=", 1)
                    if key.strip() == name and candidate.strip():
                        return candidate.strip().strip('"').strip("'")
        except OSError:
            continue
    return default


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


def _response_text(response):
    if hasattr(response, "read"):
        body = response.read()
    else:
        body = response
    if isinstance(body, bytes):
        return body.decode("utf-8", errors="replace")
    return str(body)


def _error_message(exc):
    body = getattr(exc, "read", lambda: b"")()
    try:
        decoded = json.loads(body.decode("utf-8", errors="replace") if isinstance(body, bytes) else str(body))
    except (TypeError, ValueError):
        decoded = {}
    error = decoded.get("error", {}) if isinstance(decoded, dict) else {}
    message = error.get("message") if isinstance(error, dict) else None
    status = getattr(exc, "code", None)
    if message:
        return f"The soil analysis service rejected the request (HTTP {status}): {message}"
    return f"The soil analysis service rejected the request (HTTP {status}). Check SOIL_VISION_MODEL and the configured API endpoint."


def _vision_request(image_bytes, mime_type, details):
    api_key = _setting("OPENAI_API_KEY") or _setting("OPENAI_API_TOKEN")
    if not api_key:
        raise SoilAnalysisError("Soil image analysis is not configured. Set OPENAI_API_KEY on the backend.")
    if not image_bytes:
        raise SoilAnalysisError("The selected image is empty.", status_code=400)
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise SoilAnalysisError("The soil image must be 10 MB or smaller.", status_code=413)
    if mime_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise SoilAnalysisError("Upload a JPG, PNG, or WebP soil image.", status_code=400)

    base_url = _setting("OPENAI_API_BASE", "https://api.openai.com/v1").rstrip("/")
    model = _setting("SOIL_VISION_MODEL") or DEFAULT_VISION_MODEL
    if base_url.endswith("/chat/completions"):
        endpoint = base_url
    elif base_url.endswith("/v1"):
        endpoint = f"{base_url}/chat/completions"
    else:
        endpoint = f"{base_url}/v1/chat/completions"
    prompt = (
        "Assess this soil image only as a cautious visual screening aid. Do not claim laboratory measurements. "
        "Return JSON with keys suggestedTexture (one of clay, loam, sandy, silty, peaty, unknown), "
        "confidence (low, medium, high), observations (array of short strings), limitations (array of short strings), "
        "and recommendedChecks (array of short strings). Use unknown when the image is unclear. "
        f"User-provided soil details, which may be more reliable than appearance: {json.dumps(details, ensure_ascii=False)}"
    )
    payload = {
        "model": model,
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
            {"type": "image_url", "image_url": {"url": "data:{};base64,{}".format(mime_type, base64.b64encode(image_bytes).decode("ascii"))}},
        ]}],
    }
    # Reasoning controls are accepted by some GPT-5 endpoints but rejected by many
    # OpenAI-compatible providers. Keep them opt-in so an existing key works with
    # both the default model and a provider-specific vision model.
    reasoning = _setting("SOIL_REASONING").lower()
    if model.lower().startswith("gpt-5") and reasoning in {"low", "medium", "high"}:
        payload["reasoning"] = {"effort": reasoning}
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            result = json.loads(_response_text(response))
    except urllib.error.HTTPError as exc:
        raise SoilAnalysisError(_error_message(exc), status_code=502) from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SoilAnalysisError("The soil analysis service could not be reached. Try again or continue manually.") from exc
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise SoilAnalysisError("The soil analysis service returned an invalid response. Try again or continue manually.") from exc

    if result.get("error"):
        error = result["error"]
        message = error.get("message", "The soil analysis service returned an error.") if isinstance(error, dict) else str(error)
        raise SoilAnalysisError(message, status_code=502)
    choices = result.get("choices") or []
    content = choices[0].get("message", {}).get("content", "") if choices else ""
    if isinstance(content, list):
        content = "".join(item.get("text", "") for item in content if isinstance(item, dict))
    content = str(content).strip().removeprefix("```json").removesuffix("```").strip()
    try:
        parsed = json.loads(content)
    except (TypeError, ValueError) as exc:
        raise SoilAnalysisError("The soil analysis service returned an unreadable result. Try again or continue manually.") from exc

    texture = str(parsed.get("suggestedTexture", "unknown")).lower()
    confidence = str(parsed.get("confidence", "low")).lower()
    if texture not in ALLOWED_TEXTURES or confidence not in ALLOWED_CONFIDENCE:
        raise SoilAnalysisError("The soil analysis service returned an invalid assessment. Try again or continue manually.")
    for key in ("observations", "limitations", "recommendedChecks"):
        if not isinstance(parsed.get(key), list):
            parsed[key] = []
        parsed[key] = [str(item) for item in parsed[key]][:6]
    return parsed


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
