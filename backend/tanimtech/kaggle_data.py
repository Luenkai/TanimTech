"""Runtime access to committed cleaned Kaggle profile artifacts.

Only compact crop-level profile CSVs are read during requests. Raw observations
remain pipeline outputs and are not loaded into the Flask process.
"""
from __future__ import annotations
import csv
import os
import re
from functools import lru_cache

CLEAN_DIR = os.environ.get("TANIM_CLEAN_DIR") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data_pipeline", "clean"))
FILES = {"soil": "kaggle_soil_crop_profiles.csv", "yield": "kaggle_yield_crop_profiles.csv"}

def _key(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold())

ALIASES = {
    "pechay": {"pechay", "bokchoy", "chinesecabbage"},
    "mongo": {"mongo", "mungbean", "mungbeans", "greengram", "moonggreengram"},
    "mais": {"mais", "maize", "corn"},
    "kangkong": {"kangkong", "waterspinach"},
}

@lru_cache(maxsize=1)
def _load():
    profiles = {"soil": {}, "yield": {}, "available": False, "directory": CLEAN_DIR}
    for kind, filename in FILES.items():
        path = os.path.join(CLEAN_DIR, filename)
        try:
            with open(path, newline="", encoding="utf-8") as handle:
                rows = list(csv.DictReader(handle))
        except (OSError, csv.Error):
            continue
        for row in rows:
            if row.get("crop"):
                profiles[kind][_key(row["crop"])] = row
                profiles["available"] = True
    return profiles

def refresh():
    _load.cache_clear()

def _find(rows, slug):
    wanted = {_key(slug)} | {_key(value) for value in ALIASES.get(slug, set())}
    return next((row for name, row in rows.items() if name in wanted), None)

def evidence_for(slug):
    data = _load()
    soil = _find(data["soil"], slug)
    yield_profile = _find(data["yield"], slug)
    if not soil and not yield_profile:
        return {"available": False, "source": "No cleaned Kaggle profile found; curated reference bands used."}
    return {"available": True, "source": "Cleaned Kaggle crop-soil and yield-condition profiles", "soilProfile": soil, "yieldProfile": yield_profile}

def status():
    data = _load()
    return {"available": data["available"], "directory": data["directory"], "artifacts": {kind: bool(rows) for kind, rows in (("soil", data["soil"]), ("yield", data["yield"]))}}
