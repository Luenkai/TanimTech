"""Soil reference dataset and opt-in image analysis."""
from flask import Blueprint, jsonify, request

from ..soil_analysis import DATASET, analyze_image

bp = Blueprint("soil", __name__)


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
