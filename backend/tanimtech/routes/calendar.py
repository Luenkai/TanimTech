"""Seasonal planting calendar (screen 11)."""
from flask import Blueprint, jsonify, request
from .. import store
from ..planting_calendar import demo_calendar, climate_calendar
from ..validate import check_number, validate_monthly_climate

bp = Blueprint("calendar", __name__)


def _pick(slugs):
    items = store.crops.all()
    if slugs:
        items = [c for c in items if c["slug"] in slugs]
    return items


@bp.get("")
def get_calendar():
    """GET /api/calendar?crops=pechay,kangkong   (omit crops = all)"""
    raw = request.args.get("crops")
    slugs = [s.strip() for s in raw.split(",")] if raw else None
    return jsonify(demo_calendar(_pick(slugs)))


@bp.post("")
def post_calendar():
    """body: { soilPh, monthlyClimate: [12 x {temperature,humidity,rainfall}], crops?: ["pechay"] }"""
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        body = {}
    errors, climate = validate_monthly_climate(body.get("monthlyClimate"))
    ph, err = check_number("soilPh", body.get("soilPh"))
    if err:
        errors.append(err)
    if errors:
        return jsonify({"errors": errors}), 400
    slugs = body.get("crops") if isinstance(body.get("crops"), list) else None
    return jsonify(climate_calendar(_pick(slugs), climate, ph))
