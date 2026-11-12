"""Crop recommendations (screens 3 and 7)."""
from flask import Blueprint, jsonify, request
from .. import store
from ..scoring import recommend
from ..validate import validate_conditions
from ..kaggle_data import status as kaggle_status

bp = Blueprint("recommendations", __name__)


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
    return jsonify({
        "inputs": core, "context": context,
        "results": recommend(store.crops.all(), core, context),
        "note": "Illustrative demo scoring. Not a forecast, planting instruction or yield guarantee.",
    })
