"""Trefle plant API client (https://trefle.io) — edible plants, vegetables and fruit trees.

Needs a free token:  set TREFLE_TOKEN in the server environment (get one at https://trefle.io).
The token stays on the server; the browser only ever talks to /api/plants/*.

What Trefle adds on top of the bundled ECOCROP catalog: many more species and common names,
photos, edible parts (fruits, leaves, roots …), vegetable flag and — where Trefle has them —
growth limits. Trefle's growth fields are sparse, and its temperature/precipitation fields are
tolerance limits, not optimum bands, so a Trefle plant is only SCORED when it can be matched to an
ECOCROP record (see routes/plants.py). Otherwise it is shown as reference information.
"""
import os

from .upstream import TTLCache, UpstreamError, fetch_json

BASE = "https://trefle.io/api/v1"
_cache = TTLCache(ttl=6 * 3600)

# Our UI groups -> Trefle filters (documented in https://docs.trefle.io/docs/guides/filtering)
GROUP_FILTERS = {
    "all": {"filter[edible]": "true"},
    "fruit-tree": {"filter[edible]": "true", "filter[edible_part]": "fruits", "filter[ligneous_type]": "tree"},
    "fruit": {"filter[edible]": "true", "filter[edible_part]": "fruits"},
    "vegetable": {"filter[vegetable]": "true"},
    "root": {"filter[edible]": "true", "filter[edible_part]": "roots,tubers"},
    "legume": {"filter[edible]": "true", "filter[edible_part]": "seeds"},
    "grain": {"filter[edible]": "true", "filter[edible_part]": "seeds"},
}


def token():
    return (os.environ.get("TREFLE_TOKEN") or "").strip()


def configured():
    return bool(token())


def status():
    return {"configured": configured(), "baseUrl": BASE,
            "setup": None if configured() else "Set TREFLE_TOKEN (free at https://trefle.io) and restart the server."}


def _get(path, params=None):
    if not configured():
        raise UpstreamError("Trefle is not configured. Set TREFLE_TOKEN on the server (free token at https://trefle.io).", 503)
    key = (path, tuple(sorted((params or {}).items())))
    cached = _cache.get(key)
    if cached is not None:
        return cached
    data = fetch_json(f"{BASE}{path}", {**(params or {}), "token": token()}, provider="Trefle")
    return _cache.set(key, data)


def _unit(value, *names):
    """Trefle measurements look like {"deg_c": 12, "deg_f": 53} or {"mm": 500}."""
    if isinstance(value, dict):
        for n in names:
            if value.get(n) is not None:
                return value[n]
        return None
    return value if isinstance(value, (int, float)) else None


def shape_item(item):
    """A row from /species or /species/search."""
    return {
        "id": f"trefle-{item.get('id')}", "source": "trefle", "name": item.get("common_name") or item.get("scientific_name"),
        "scientific": item.get("scientific_name"), "family": item.get("family_common_name") or item.get("family"),
        "genus": item.get("genus"), "imageUrl": item.get("image_url"), "edible": True,
        "dataSource": "Trefle (trefle.io)",
    }


def search(q="", group="all", page=1):
    params = {"page": max(1, int(page)), **GROUP_FILTERS.get(group, GROUP_FILTERS["all"])}
    if q:
        params["q"] = q
        payload = _get("/species/search", params)
    else:
        params["order[common_name]"] = "asc"
        params["filter_not[common_name]"] = "null"
        payload = _get("/species", params)
    meta = payload.get("meta") or {}
    return {"items": [shape_item(i) for i in payload.get("data", [])], "total": meta.get("total"), "page": params["page"]}


def detail(trefle_id):
    payload = _get(f"/species/{int(trefle_id)}")
    d = payload.get("data") or {}
    growth, spec = d.get("growth") or {}, d.get("specifications") or {}
    out = shape_item(d)
    out.update({
        "edible": bool(d.get("edible")), "edibleParts": d.get("edible_part") or [], "vegetable": d.get("vegetable"),
        "commonNames": sorted({n for names in (d.get("common_names") or {}).values() for n in (names or [])})[:15],
        "lifeForm": spec.get("ligneous_type") or spec.get("growth_habit"), "growthHabit": spec.get("growth_habit"),
        "toxicity": spec.get("toxicity"),
        "growingDays": [growth.get("days_to_harvest")] * 2 if growth.get("days_to_harvest") else None,
        "growth": {
            "description": growth.get("description"), "sowing": growth.get("sowing"),
            "daysToHarvest": growth.get("days_to_harvest"), "light": growth.get("light"),
            "soilTexture": growth.get("soil_texture"), "soilHumidity": growth.get("soil_humidity"),
            "soilNutriments": growth.get("soil_nutriments"), "soilSalinity": growth.get("soil_salinity"),
            "fruitMonths": growth.get("fruit_months"), "growthMonths": growth.get("growth_months"),
        },
        # Trefle gives tolerance LIMITS (not optimum bands); kept separate from the scored bands.
        "toleranceLimits": {
            "soilPh": [growth.get("ph_minimum"), growth.get("ph_maximum")],
            "temperature": [_unit(growth.get("minimum_temperature"), "deg_c"), _unit(growth.get("maximum_temperature"), "deg_c")],
            "rainfall": [_unit(growth.get("minimum_precipitation"), "mm"), _unit(growth.get("maximum_precipitation"), "mm")],
        },
    })
    return out
