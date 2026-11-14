"""Saved farm profiles (screen 12) + farm overview (screen 2) + "Save this shortlist"."""
from flask import Blueprint, jsonify, request
from .. import store
from ..planting_calendar import seasonal_calendar, climate_calendar
from ..scoring import recommend
from ..validate import validate_conditions, validate_monthly_climate

bp = Blueprint("profiles", __name__)


def _parse_profile(body):
    if not isinstance(body, dict):
        body = {}
    errors, core, context = validate_conditions(body)
    name = body["name"].strip()[:100] if isinstance(body.get("name"), str) else ""
    if not name:
        errors.append("Profile name is required.")
    data = {"name": name, **core, **context}
    data.setdefault("soilType", "Unknown")
    data.setdefault("soilTypeSource", "manual")  # never "lab-verified"
    if body.get("monthlyClimate") is not None:
        errs, climate = validate_monthly_climate(body["monthlyClimate"])
        errors.extend(errs)
        if climate:
            data["monthlyClimate"] = climate
    return errors, data


def _ctx(p, **extra):
    return {"soilType": p.get("soilType"), "soilTexture": p.get("soilTexture"), "drainage": p.get("drainage"), "moisture": p.get("moisture"), "salinity": p.get("salinity"), "organicMatter": p.get("organicMatter"), "soilNotes": p.get("soilNotes"), "season": p.get("season"), "monthlyRisk": p.get("monthlyRisk"), **extra}


def _missing():
    return jsonify({"error": "Profile not found."}), 404


def _calendar_for(p):
    crops = store.crops.all()
    if p.get("monthlyClimate"):
        return climate_calendar(crops, p["monthlyClimate"], p["soilPh"])
    return seasonal_calendar(crops)


@bp.get("")
def list_profiles():
    return jsonify({"profiles": store.profiles.list()})


@bp.post("")
def create_profile():
    errors, data = _parse_profile(request.get_json(silent=True))
    if errors:
        return jsonify({"errors": errors}), 400
    return jsonify(store.profiles.create(data)), 201


@bp.get("/<int:pid>")
def get_profile(pid):
    p = store.profiles.get(pid)
    return jsonify(p) if p else _missing()


@bp.put("/<int:pid>")
def update_profile(pid):
    errors, data = _parse_profile(request.get_json(silent=True))
    if errors:
        return jsonify({"errors": errors}), 400
    p = store.profiles.update(pid, data)
    return jsonify(p) if p else _missing()


@bp.delete("/<int:pid>")
def delete_profile(pid):
    return ("", 204) if store.profiles.remove(pid) else _missing()


@bp.get("/<int:pid>/recommendations")
def profile_recommendations(pid):
    p = store.profiles.get(pid)
    if not p:
        return _missing()
    ctx = _ctx(p, plantCategory=request.args.get("plantCategory"), lifeForm=request.args.get("lifeForm"))
    return jsonify({"profile": p, "results": recommend(store.crops.all(), p, ctx)})


@bp.get("/<int:pid>/calendar")
def profile_calendar(pid):
    p = store.profiles.get(pid)
    return jsonify(_calendar_for(p)) if p else _missing()


@bp.get("/<int:pid>/overview")
def profile_overview(pid):
    p = store.profiles.get(pid)
    if not p:
        return _missing()
    results = recommend(store.crops.all(), p, _ctx(p))
    top = results[0]["slug"] if results else None
    return jsonify({
        "profile": p,
        "snapshot": {k: p[k] for k in ("soilPh", "temperature", "humidity", "rainfall")},
        "topCrops": results[:3],
        "calendarForTopCrop": next((r for r in _calendar_for(p)["rows"] if r["slug"] == top), None),
        "savedShortlists": len(store.shortlists.list_for_profile(pid)),
    })


@bp.post("/<int:pid>/shortlists")
def save_shortlist(pid):
    p = store.profiles.get(pid)
    if not p:
        return _missing()
    body = request.get_json(silent=True)
    label = body.get("label")[:100] if isinstance(body, dict) and isinstance(body.get("label"), str) else None
    return jsonify(store.shortlists.add(pid, label, recommend(store.crops.all(), p, _ctx(p)))), 201


@bp.get("/<int:pid>/shortlists")
def list_shortlists(pid):
    if not store.profiles.get(pid):
        return _missing()
    return jsonify({"shortlists": store.shortlists.list_for_profile(pid)})
