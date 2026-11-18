"""Soil reference dataset and opt-in image analysis."""
from flask import Blueprint, jsonify, request

from .. import soilgrids
from ..soil_analysis import DATASET, analyze_image
from ..upstream import UpstreamError

bp = Blueprint("soil", __name__)


def _coord(name, lo, hi):
    raw = request.args.get(name) or request.args.get({"lat": "latitude", "lon": "longitude"}[name])
    try:
        value = float(raw)
        if value != value or not lo <= value <= hi:
            raise ValueError
        return value, None
    except (TypeError, ValueError):
        return None, f"{name} must be a number between {lo} and {hi}."


@bp.get("/lookup")
def lookup():
    """GET /api/soil/lookup?lat=14.2&lon=121.1  — soil type, texture, pH and organic matter for a coordinate
    (ISRIC SoilGrids 2.0, no API key). Also accepts latitude= / longitude=."""
    lat, e1 = _coord("lat", -90, 90)
    lon, e2 = _coord("lon", -180, 180)
    if e1 or e2:
        return jsonify({"errors": [e for e in (e1, e2) if e]}), 400
    try:
        return jsonify(soilgrids.lookup(lat, lon))
    except UpstreamError as exc:
        response = jsonify({"error": exc.message})
        response.status_code = exc.status
        if exc.retry_after:
            response.headers["Retry-After"] = str(exc.retry_after)
        return response


@bp.get("/classify")
def classify():
    """GET /api/soil/classify?clay=30&silt=40&sand=30[&soc=15] — USDA texture class from percentages (offline, no API call)."""
    try:
        clay, silt, sand = (float(request.args[k]) for k in ("clay", "silt", "sand"))
        soc = float(request.args["soc"]) if request.args.get("soc") else None
        if min(clay, silt, sand) < 0 or clay + silt + sand <= 0:
            raise ValueError
    except (KeyError, ValueError):
        return jsonify({"error": "Send clay, silt and sand as non-negative percentages (soc in g/kg is optional)."}), 400
    total = clay + silt + sand
    return jsonify({"percentages": {"clay": round(100 * clay / total, 1), "silt": round(100 * silt / total, 1), "sand": round(100 * sand / total, 1)},
                    **soilgrids.classify(sand, silt, clay, soc)})


@bp.get("/dataset")
def dataset():
    return jsonify(DATASET)


@bp.post("/analyze")
def analyze():
    uploaded = request.files.get("image")
    if not uploaded or not uploaded.filename:
        return jsonify({"error": "Choose a soil image first."}), 400
    if uploaded.mimetype not in {"image/jpeg", "image/png", "image/webp"}:
        return jsonify({"error": "Upload a JPG, PNG, or WebP soil image."}), 400
    image = uploaded.read()
    if not image:
        return jsonify({"error": "The selected image is empty."}), 400
    if len(image) > 10 * 1024 * 1024:
        return jsonify({"error": "The soil image must be 10 MB or smaller."}), 413
    details = request.form.get("details", "{}")
    try:
        import json
        details = json.loads(details)
    except (TypeError, ValueError):
        details = {}
    try:
        return jsonify({"analysis": analyze_image(image, uploaded.mimetype, details)})
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503


@bp.errorhandler(413)
def too_large(_):
    return jsonify({"error": "The soil image must be 10 MB or smaller."}), 413
