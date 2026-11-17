"""Builds backend/data/edible_catalog.json: every EDIBLE plant in the full FAO ECOCROP database.

Why: the app's committed crops_clean.json only holds 7 crops. ECOCROP (via the OpenCLIM export) has
2,568 species. We keep the ones ECOCROP files under an edible use category and that have complete
pH, temperature, rainfall and crop-cycle requirement bands, so the existing fit score works on them.

Run (downloads the live file from GitHub, or pass --file to use a local copy):
    cd backend
    python -m data_pipeline.build_edible_catalog
    python -m data_pipeline.build_edible_catalog --file data_pipeline/raw/EcoCrop_DB.csv

Rules (same as build_crops.py, so scores stay comparable):
  * Scoring band = OPTIMUM range (…OPMN–…OPMX); falls back to the absolute range when missing.
  * Rainfall stays ANNUAL mm (that is what ECOCROP records and what the app asks the farmer for).
  * Humidity: ECOCROP has none, so 0–100 (zero score weight in the app anyway).
  * Edible categories kept: fruits & nuts, vegetables, roots/tubers, pulses, cereals & pseudocereals.
    Forage, forest/wood, ornamentals, weeds, materials and cover crops are NOT kept.
"""
import argparse
import csv
import io
import json
import os
import re
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "edible_catalog.json")
SOURCE_URL = ("https://raw.githubusercontent.com/OpenCLIM/ecocrop/"
              "ea43ecd418fd1a1ea08d32c7dce64b7fae02dec4/EcoCrop_DB.csv")

EDIBLE_CATS = {
    "fruits & nuts": "fruit",
    "vegetables": "vegetable",
    "roots/tubers": "root",
    "pulses (grain legumes)": "legume",
    "cereals & pseudocereals": "grain",
}
EDIBLE_PART = {"fruit": "Fruit / nut", "vegetable": "Vegetable", "root": "Root / tuber",
               "legume": "Pulse / grain legume", "grain": "Cereal / grain"}


def num(value):
    try:
        v = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return v if v == v else None


def band(row, opt_lo, opt_hi, abs_lo, abs_hi):
    lo, hi = num(row.get(opt_lo)), num(row.get(opt_hi))
    if lo is None or hi is None or lo >= hi:
        lo, hi = num(row.get(abs_lo)), num(row.get(abs_hi))
    if lo is None or hi is None or lo >= hi:
        return None
    return lo, hi


def split(value):
    return [p.strip() for p in str(value or "").split(",") if p.strip()]


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def common_names(raw):
    """ECOCROP COMNAME is a long multilingual list. Keep plain-ASCII names, drop the garbled ones."""
    names, seen = [], set()
    for n in split(raw):
        if not n.isascii() or "�" in n or len(n) > 40 or not re.search(r"[A-Za-z]", n):
            continue
        key = n.lower()
        if key not in seen:
            seen.add(key)
            names.append(n)
    return names[:25]


def display_name(names, scientific):
    return " ".join(w[:1].upper() + w[1:] for w in names[0].split()) if names else scientific


def life_form(lifo):
    parts = set(split(lifo))
    for form, label in (("tree", "Tree"), ("vine", "Vine"), ("shrub", "Shrub"), ("sub-shrub", "Shrub")):
        if form in parts:
            return label
    return "Herb"  # herbs and grasses (cereals) — same label the app already uses for maize


def category(kind, lifeform):
    if kind == "fruit":
        return "Fruit trees" if lifeform in ("Tree", "Shrub") else "Fruits & nuts"
    return {"vegetable": "Vegetables", "root": "Root crops", "legume": "Legumes", "grain": "Grains"}[kind]


def read_rows(path=None):
    if path:
        raw = open(path, "rb").read()
    else:
        with urllib.request.urlopen(SOURCE_URL, timeout=60) as r:
            raw = r.read()
    text = raw.decode("utf-8-sig") if raw[:3] == b"\xef\xbb\xbf" else raw.decode("cp1252", errors="replace")
    return list(csv.DictReader(io.StringIO(text)))


def build(rows):
    plants, used = [], set()
    for r in rows:
        cats = [c for c in split(r.get("CAT")) if c in EDIBLE_CATS]
        if not cats:
            continue
        ph, tp = band(r, "PHOPMN", "PHOPMX", "PHMIN", "PHMAX"), band(r, "TOPMN", "TOPMX", "TMIN", "TMAX")
        rn, gd = band(r, "ROPMN", "ROPMX", "RMIN", "RMAX"), (num(r.get("GMIN")), num(r.get("GMAX")))
        if not (ph and tp and rn) or None in gd:
            continue
        sci = (r.get("ScientificName") or "").strip()
        if not sci:
            continue
        kind = cats[0]
        kind = EDIBLE_CATS[kind]
        names = common_names(r.get("COMNAME"))
        lf = life_form(r.get("LIFO"))
        slug = slugify(sci)
        if slug in used:
            slug = f"{slug}-{r['EcoPortCode']}"
        used.add(slug)
        plants.append({
            "slug": slug, "ecoport_code": int(r["EcoPortCode"]), "name": display_name(names, sci),
            "common_names": names, "scientific": sci, "family": (r.get("FAMNAME") or "").split(":")[-1],
            "category": category(kind, lf), "edible_kind": kind, "edible_group": EDIBLE_PART[kind],
            "all_uses": split(r.get("CAT")), "life_form": lf, "life_form_raw": split(r.get("LIFO")),
            "summary": f"{display_name(names, sci)} ({sci}) requirement profile from FAO ECOCROP.",
            "ph_min": round(ph[0], 1), "ph_max": round(ph[1], 1),
            "temp_min": round(tp[0], 1), "temp_max": round(tp[1], 1),
            "rain_min": round(rn[0]), "rain_max": round(rn[1]),
            "humidity_min": 0, "humidity_max": 100,
            "days_min": int(gd[0]), "days_max": int(gd[1]),
            "best_months": [], "possible_months": [],
            "soil_texture": split(r.get("TEXT")), "soil_drainage": split(r.get("DRA")),
            "soil_depth": split(r.get("DEP")), "soil_fertility": split(r.get("FER")),
            "soil_salinity": split(r.get("SAL")),
            "abs_ph": [num(r.get("PHMIN")), num(r.get("PHMAX"))],
            "abs_temp": [num(r.get("TMIN")), num(r.get("TMAX"))],
            "abs_rain": [num(r.get("RMIN")), num(r.get("RMAX"))],
            "flood_note": "Check local drainage and flood exposure; ECOCROP does not replace a field assessment.",
            "typhoon_note": "Check local storm advisories and support needs; ECOCROP gives no storm-resilience guarantee.",
            "data_source": f"FAO ECOCROP via OpenCLIM export (EcoPortCode {r['EcoPortCode']})",
        })
    plants.sort(key=lambda p: p["name"].lower())
    return plants


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", help="local EcoCrop_DB.csv (otherwise downloaded from GitHub)")
    args = ap.parse_args()
    rows = read_rows(args.file)
    plants = build(rows)
    doc = {"version": "1.0", "source": SOURCE_URL, "license_note": "FAO ECOCROP; thresholds are expert estimates, not field trials.",
           "ecocrop_rows": len(rows), "count": len(plants), "plants": plants}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(",", ":"))
    by = {}
    for p in plants:
        by[p["category"]] = by.get(p["category"], 0) + 1
    print(f"edible_catalog.json: {len(plants)} edible plants kept out of {len(rows)} ECOCROP rows")
    for k, v in sorted(by.items()):
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
