"""Crop recommendations (screens 3 and 7)."""
from flask import Blueprint, jsonify, request
from .. import plant_catalog, store
from ..scoring import recommend
from ..validate import validate_conditions
from ..kaggle_data import status as kaggle_status
from .. import auth

bp = Blueprint("recommendations", __name__)


def crop_pool(context):
    """Core crops, plus the edible ECOCROP catalog when the request asks for catalog='extended'.
    Core records win when the same plant is in both (matched by EcoPort code)."""
    core = list(store.crops.all())
    if context.get("catalog") != "extended":
        return core
    core_codes = {c.get("data_source", "").split("EcoPortCode ")[-1].rstrip(")") for c in core}
    return core + [p for p in plant_catalog.as_crops() if str(p["ecoport_code"]) not in core_codes]


@bp.get("/data-status")
def data_status():
    """Report whether the cleaned Kaggle profile artifacts are installed."""
    return jsonify(kaggle_status())


@bp.post("")
def create_recommendations():
    """body: soilPh, temperature, humidity, rainfall (+ optional context)"""
    errors, core, context = validate_conditions(request.get_json(silent=True))
    if errors:
        return jsonify({"errors": errors}), 400
    pool = crop_pool(context)
    return jsonify({
        "inputs": core, "context": context,
        "poolSize": len(pool),
        "results": recommend(pool, core, context),
        "note": "Illustrative demo scoring. Not a forecast, planting instruction or yield guarantee.",
    })


@bp.get("/saved")
def saved_recommendations():
    user = auth.current_user()
    if not user:
        return jsonify({"error": "Sign in to view saved recommendations."}), 401
    return jsonify({"recommendations": store.recommendations.list_for_user(user["id"])})


@bp.post("/saved")
def save_recommendations():
    user = auth.current_user()
    if not user:
        return jsonify({"error": "Sign in to save recommendations."}), 401
    body = request.get_json(silent=True) or {}
    errors, core, context = validate_conditions(body)
    if errors:
        return jsonify({"errors": errors}), 400
    label = body.get("label") if isinstance(body.get("label"), str) else "Saved crop shortlist"
    results = recommend(crop_pool(context), core, context)
    return jsonify(store.recommendations.add(user["id"], label[:100], {**core, **context}, results)), 201
