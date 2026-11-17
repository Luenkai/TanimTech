"""Edible plant API: crops, vegetables, fruit trees, roots, legumes, grains.

Two sources behind one endpoint:
  * ECOCROP catalog  — ~700 edible plants bundled with the app (no key, always available, scorable)
  * Trefle           — live plant API (needs TREFLE_TOKEN); adds photos, edible parts, more species
"""
import re

from flask import Blueprint, jsonify, request

from .. import plant_catalog, trefle
from ..upstream import UpstreamError

bp = Blueprint("plants", __name__)


def _error(exc):
    body = {"error": exc.message}
    if exc.status == 503:
        body["setup"] = "Set the TREFLE_TOKEN environment variable (free token at https://trefle.io) and restart."
    response = jsonify(body)
    response.status_code = exc.status
    if exc.retry_after:
        response.headers["Retry-After"] = str(exc.retry_after)
    return response


def _int(name, default, lo, hi):
    try:
        return max(lo, min(hi, int(request.args.get(name, default))))
    except (TypeError, ValueError):
        return default


def _species_key(scientific):
    words = re.sub(r"[^a-z ]+", " ", str(scientific or "").lower()).split()
    return " ".join(words[:2])


def _ecocrop_for(scientific):
    """Best ECOCROP catalog record for a scientific name (exact first, else the plain species)."""
    key = _species_key(scientific)
    if not key:
        return None
    hits = [p for p in plant_catalog.PLANTS if _species_key(p["scientific"]) == key]
    if not hits:
        return None
    exact = [p for p in hits if p["scientific"].lower() == str(scientific).lower()]
    return (exact or sorted(hits, key=lambda p: len(p["scientific"])))[0]


@bp.get("/status")
def status():
    """Which plant data sources are available right now."""
    return jsonify({"ecocrop": plant_catalog.status(), "trefle": trefle.status(),
                    "groups": {k: v["label"] for k, v in plant_catalog.GROUPS.items()}})


@bp.get("/groups")
def groups():
    counts = {}
    for key, g in plant_catalog.GROUPS.items():
        counts[key] = {"label": g["label"], "count": sum(1 for p in plant_catalog.PLANTS if p["category"] in g["categories"])}
    return jsonify({"groups": counts, "total": len(plant_catalog.PLANTS)})


@bp.get("/search")
def search():
    """GET /api/plants/search?q=mango&group=fruit-tree&source=auto|ecocrop|trefle&lifeForm=Tree&maxDays=400&page=1&limit=24"""
    a = request.args
    q, group, source = (a.get("q") or "").strip()[:80], (a.get("group") or "").strip(), (a.get("source") or "auto").lower()
    if group and group not in plant_catalog.GROUPS:
        return jsonify({"error": f"group must be one of: {', '.join(plant_catalog.GROUPS)}."}), 400
    if source not in ("auto", "ecocrop", "trefle"):
        return jsonify({"error": "source must be auto, ecocrop or trefle."}), 400
    page, limit = _int("page", 1, 1, 10000), _int("limit", 24, 1, 100)
    try:
        max_days = float(a["maxDays"]) if a.get("maxDays") else None
    except ValueError:
        return jsonify({"error": "maxDays must be a number."}), 400

    body = {"query": q, "group": group or "all", "source": source}
    if source in ("auto", "ecocrop"):
        found = plant_catalog.search(q, group, a.get("lifeForm", ""), a.get("category", ""), max_days)
        start = (page - 1) * limit
        body.update({"count": len(found), "page": page, "limit": limit,
                     "plants": [plant_catalog.shape(p, brief=True) for p in found[start:start + limit]]})
    if source in ("auto", "trefle"):
        info = {"configured": trefle.configured(), "items": [], "total": None, "error": None}
        if trefle.configured():
            try:
                res = trefle.search(q, group or "all", page)
                for item in res["items"]:
                    match = _ecocrop_for(item["scientific"])
                    item["ecocropId"] = match["slug"] if match else None  # scorable when matched
                info.update(items=res["items"], total=res["total"])
            except UpstreamError as exc:
                if source == "trefle":
                    return _error(exc)
                info["error"] = exc.message  # auto mode: still return the ECOCROP results
        elif source == "trefle":
            return _error(UpstreamError("Trefle is not configured.", 503))
        else:
            info["error"] = "Trefle is not configured (set TREFLE_TOKEN to add live results)."
        body["trefle"] = info
    return jsonify(body)


@bp.get("/<plant_id>")
def detail(plant_id):
    """GET /api/plants/mangifera-indica   (ECOCROP catalog)   or   /api/plants/trefle-123456   (Trefle)"""
    m = re.fullmatch(r"trefle-(\d+)", plant_id)
    if m:
        try:
            plant = trefle.detail(m.group(1))
        except UpstreamError as exc:
            return _error(exc)
        match = _ecocrop_for(plant.get("scientific"))
        plant["ecocrop"] = plant_catalog.shape(match) if match else None
        plant["scoreable"] = bool(match)
        plant["note"] = ("Fit scoring uses the matching FAO ECOCROP requirement bands." if match else
                         "No matching ECOCROP record, so this plant is shown as reference information and not scored.")
        return jsonify(plant)
    p = plant_catalog.get(plant_id)
    if not p:
        return jsonify({"error": "Plant not found."}), 404
    out = plant_catalog.shape(p)
    out["scoreable"] = True
    return jsonify(out)
