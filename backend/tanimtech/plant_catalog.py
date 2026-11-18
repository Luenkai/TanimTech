"""Extended edible-plant catalog (FAO ECOCROP, ~700 plants) used next to the 7 core crops.

Built by `python -m data_pipeline.build_edible_catalog`. Loaded once at start-up from
`data/edible_catalog.json`. Records use the same keys as crops_clean.json, so scoring.recommend()
works on them unchanged.
"""
import json
import os
import re

CATALOG_FILE = os.environ.get("TANIM_EDIBLE_CATALOG") or os.path.join(
    os.path.dirname(__file__), "..", "data", "edible_catalog.json")

# Friendly group names used by the API/UI -> the catalog's category values.
GROUPS = {
    "fruit-tree": {"label": "Fruit trees", "categories": ["Fruit trees"]},
    "fruit": {"label": "Fruits & nuts (non-tree)", "categories": ["Fruits & nuts"]},
    "vegetable": {"label": "Vegetables", "categories": ["Vegetables"]},
    "root": {"label": "Root crops", "categories": ["Root crops"]},
    "legume": {"label": "Legumes / pulses", "categories": ["Legumes"]},
    "grain": {"label": "Grains / cereals", "categories": ["Grains"]},
}


def _load():
    try:
        with open(CATALOG_FILE, encoding="utf-8") as fh:
            doc = json.load(fh)
    except (OSError, ValueError):
        return {"plants": [], "count": 0, "source": None}
    return doc


_DOC = _load()
PLANTS = _DOC.get("plants", [])
BY_SLUG = {p["slug"]: p for p in PLANTS}


def _norm(text):
    return re.sub(r"[^a-z0-9]+", " ", str(text or "").lower()).strip()


for _p in PLANTS:  # precompute the search haystack once
    _p["_haystack"] = " | ".join(_norm(x) for x in [_p["name"], _p["scientific"], *_p.get("common_names", [])])


def status():
    return {"available": bool(PLANTS), "count": len(PLANTS), "source": _DOC.get("source"),
            "file": os.path.abspath(CATALOG_FILE)}


def as_crops():
    """Records ready for scoring.recommend()."""
    return PLANTS


def get(slug):
    return BY_SLUG.get(slug)


def search(q="", group="", life_form="", category="", max_days=None, edible_kind=""):
    items = PLANTS
    if q:
        needle = _norm(q)
        items = [p for p in items if needle in p["_haystack"]]
        # exact/prefix name hits first
        items.sort(key=lambda p: (_norm(p["name"]) != needle, not _norm(p["name"]).startswith(needle), p["name"].lower()))
    else:
        items = sorted(items, key=lambda p: p["name"].lower())
    if group:
        cats = GROUPS.get(group, {}).get("categories", [])
        items = [p for p in items if p["category"] in cats]
    if category:
        items = [p for p in items if p["category"].lower() == category.lower()]
    if life_form:
        items = [p for p in items if p["life_form"].lower() == life_form.lower()]
    if max_days is not None:
        items = [p for p in items if p["days_max"] <= max_days]
    return items


def shape(p, brief=False):
    out = {
        "id": p["slug"], "source": "ecocrop", "name": p["name"], "scientific": p["scientific"],
        "commonNames": p.get("common_names", [])[:12], "family": p.get("family", ""),
        "category": p["category"], "edibleGroup": p["edible_group"], "lifeForm": p["life_form"],
        "edible": True, "growingDays": [p["days_min"], p["days_max"]],
        "bands": {"soilPh": [p["ph_min"], p["ph_max"]], "temperature": [p["temp_min"], p["temp_max"]],
                  "rainfall": [p["rain_min"], p["rain_max"]]},
        "dataSource": p["data_source"],
    }
    if not brief:
        out.update({
            "allUses": p.get("all_uses", []),
            "absoluteLimits": {"soilPh": p.get("abs_ph"), "temperature": p.get("abs_temp"), "rainfall": p.get("abs_rain")},
            "soil": {"texture": p.get("soil_texture", []), "drainage": p.get("soil_drainage", []),
                     "depth": p.get("soil_depth", []), "fertility": p.get("soil_fertility", []),
                     "salinity": p.get("soil_salinity", [])},
            "notes": {"flood": p["flood_note"], "typhoon": p["typhoon_note"]},
            "summary": p["summary"],
        })
    return out


# ---- soil-type matching (ECOCROP texture / drainage requirements) -------------------------------
# ECOCROP texture classes: light (sandy), medium (loamy), heavy (clay), organic, wide (tolerates all).
TEXTURE_CLASS = {"clay": "heavy", "loam": "medium", "silty": "medium", "sandy": "light", "peaty": "organic"}
_ADJACENT = {("heavy", "medium"), ("medium", "heavy"), ("medium", "light"), ("light", "medium")}
DRAINAGE_CLASS = {"poor": "poorly", "moderate": "well", "well-drained": "well", "rapid": "excessive"}


def _drainage_atoms(p):
    return {a.split(" ")[0] for a in p.get("soil_drainage", [])}


def soil_match(p, context):
    """Advisory soil suitability for one catalog plant, from ECOCROP texture + drainage.
    Returns the same shape as soil_analysis.soil_matches: {status, points, label} (+ reasons)."""
    texture = str(context.get("soilTexture") or context.get("soilType") or "").strip().lower()
    needs = TEXTURE_CLASS.get(texture)
    drainage = DRAINAGE_CLASS.get(str(context.get("drainage") or "").strip().lower())
    if not needs and not drainage:
        return {"status": "unknown", "points": None, "label": "No soil profile"}
    ranks, reasons = [], []
    if needs:
        have = set(p.get("soil_texture", []))
        if not have:
            reasons.append("ECOCROP lists no texture requirement")
        elif needs in have or "wide" in have:
            ranks.append(0)
            reasons.append(f"{needs} texture is listed as suitable")
        elif any((needs, h) in _ADJACENT for h in have):
            ranks.append(1)
            reasons.append(f"prefers {', '.join(sorted(have))} texture; {needs} is next to it")
        else:
            ranks.append(2)
            reasons.append(f"prefers {', '.join(sorted(have))} texture, not {needs}")
    if drainage:
        have = _drainage_atoms(p)
        if not have:
            reasons.append("ECOCROP lists no drainage requirement")
        elif drainage in have:
            ranks.append(0)
            reasons.append(f"{drainage} drainage is listed as suitable")
        else:
            ranks.append(1 if "well" in have and drainage == "excessive" else 2)
            reasons.append(f"prefers {', '.join(sorted(have))} drainage")
    if not ranks:
        return {"status": "unknown", "points": None, "label": texture.title() or "Soil", "reasons": reasons}
    worst = max(ranks)
    status = ("good", "caution", "poor")[worst]
    return {"status": status, "points": {"good": 100, "caution": 60, "poor": 20}[status],
            "label": (texture or "soil").title(), "reasons": reasons, "basis": "FAO ECOCROP texture and drainage fields"}
