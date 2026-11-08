"""Crop explorer (screen 9) + crop details (screen 8)."""
from flask import Blueprint, jsonify, request
from .. import store
from ..crop_shape import shape_crop

bp = Blueprint("crops", __name__)


@bp.get("")
def list_crops():
    """GET /api/crops?q=pech&category=Legumes&lifeForm=Vine&maxDays=60&sort=days"""
    a = request.args
    items = list(store.crops.all())
    if a.get("q"):
        s = a["q"].lower()
        items = [c for c in items if s in c["name"].lower() or s in c["scientific"].lower()]
    if a.get("category"):
        items = [c for c in items if c["category"] == a["category"]]
    if a.get("lifeForm"):
        items = [c for c in items if c["life_form"] == a["lifeForm"]]
    if a.get("maxDays"):
        try:
            limit = float(a["maxDays"])
            items = [c for c in items if c["days_max"] <= limit]
        except ValueError:
            pass
    items.sort(key=(lambda c: c["days_min"]) if a.get("sort") == "days" else (lambda c: c["name"]))
    return jsonify({
        "count": len(items),
        "categories": sorted({c["category"] for c in store.crops.all()}),
        "crops": [shape_crop(c) for c in items],
    })


@bp.get("/<slug>")
def get_crop(slug):
    crop = store.crops.by_slug(slug)
    if not crop:
        return jsonify({"error": "Crop not found."}), 404
    return jsonify(shape_crop(crop))
