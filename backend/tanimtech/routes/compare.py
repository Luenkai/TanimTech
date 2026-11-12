"""Crop comparison (screen 10)."""
from flask import Blueprint, jsonify, request
from .. import store
from ..crop_shape import shape_crop
from ..scoring import recommend
from ..validate import validate_conditions, CORE

bp = Blueprint("compare", __name__)


@bp.post("")
def compare():
    """body: { "slugs": ["pechay","kangkong","mongo"], ...optional conditions }"""
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        body = {}
    slugs = body.get("slugs")
    slugs = list(dict.fromkeys(s for s in slugs if isinstance(s, str))) if isinstance(slugs, list) else []
    if not 2 <= len(slugs) <= 3:
        return jsonify({"errors": ["Choose 2 or 3 crops to compare."]}), 400
    found = []
    for s in slugs:
        crop = store.crops.by_slug(s)
        if not crop:
            return jsonify({"error": f"Crop not found: {s}"}), 404
        found.append(crop)

    fits = None
    if any(k in body for k in CORE):
        errors, core, context = validate_conditions(body)
        if errors:
            return jsonify({"errors": errors}), 400
        fits = {r["slug"]: r for r in recommend(found, core, context)}
    return jsonify({
        "crops": [{**shape_crop(c), "fit": fits[c["slug"]] if fits else None} for c in found],
        "note": "Neither crop is automatically a better choice. Fit is a demo score, not a probability of success.",
    })
