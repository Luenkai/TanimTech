"""---------------------------------------------------------------
Temporary storage (NO database). Profiles and shortlists are kept in memory
and saved to storage/store.json so they survive a restart.

LATER: to add MySQL, re-implement the methods of Crops, Profiles and Shortlists below
with SQL queries. Keep the same method names and return shapes and nothing else
in the project needs to change.
---------------------------------------------------------------"""
import json
import os
import threading
from datetime import datetime, timezone

from .data.crops import CROPS as DEMO_CROPS

# If the data pipeline has produced clean/crops_clean.json, use it instead of the demo placeholders.
CROPS_JSON = os.environ.get("TANIM_CROPS_FILE") or os.path.join(
    os.path.dirname(__file__), "..", "data_pipeline", "clean", "crops_clean.json")


def _months(v):
    """'11,12,1' -> [11, 12, 1]; lists pass through; empty -> []."""
    if isinstance(v, list):
        return [int(m) for m in v]
    return [int(m) for m in str(v or "").replace(" ", "").split(",") if m]


def _load_crops():
    try:
        with open(CROPS_JSON, encoding="utf-8") as fh:
            rows = json.load(fh)
    except (OSError, ValueError):
        return DEMO_CROPS
    crops = []
    for r in rows:
        r = {k: ("" if v is None else v) for k, v in r.items()}
        for k, fallback in (("humidity_min", 0), ("humidity_max", 100)):
            if r.get(k) == "":
                r[k] = fallback  # no humidity source (needs_review = 1): do not let it penalise the crop
        r["best_months"], r["possible_months"] = _months(r.get("best_months")), _months(r.get("possible_months"))
        crops.append(r)
    return crops or DEMO_CROPS


CROPS = _load_crops()

FILE = os.environ.get("TANIM_STORE_FILE") or os.path.join(
    os.path.dirname(__file__), "..", "storage", "store.json")
_lock = threading.RLock()
_db = {"nextProfileId": 1, "nextShortlistId": 1, "profiles": [], "shortlists": []}

try:
    with open(FILE, encoding="utf-8") as fh:
        _db.update(json.load(fh))
except (OSError, ValueError):
    pass  # first run


def _save():
    os.makedirs(os.path.dirname(os.path.abspath(FILE)), exist_ok=True)
    with open(FILE, "w", encoding="utf-8") as fh:
        json.dump(_db, fh, indent=2, ensure_ascii=False)


def _now():
    return datetime.now(timezone.utc).isoformat()


class Crops:
    def all(self):
        return CROPS

    def by_slug(self, slug):
        return next((c for c in CROPS if c["slug"] == slug), None)


class Profiles:
    def list(self):
        with _lock:
            return sorted(_db["profiles"], key=lambda p: p["updatedAt"], reverse=True)

    def get(self, pid):
        with _lock:
            return next((p for p in _db["profiles"] if p["id"] == int(pid)), None)

    def create(self, data):
        with _lock:
            p = {"id": _db["nextProfileId"], **data, "createdAt": _now(), "updatedAt": _now()}
            _db["nextProfileId"] += 1
            _db["profiles"].append(p)
            _save()
            return p

    def update(self, pid, data):
        with _lock:
            old = self.get(pid)
            if not old:
                return None
            old.update({**data, "id": old["id"], "createdAt": old["createdAt"], "updatedAt": _now()})
            _save()
            return old

    def remove(self, pid):
        with _lock:
            before = len(_db["profiles"])
            _db["profiles"] = [p for p in _db["profiles"] if p["id"] != int(pid)]
            _db["shortlists"] = [s for s in _db["shortlists"] if s["profileId"] != int(pid)]
            _save()
            return len(_db["profiles"]) < before


class Shortlists:
    def add(self, profile_id, label, results):
        with _lock:
            s = {"id": _db["nextShortlistId"], "profileId": int(profile_id), "label": label,
                 "results": results, "createdAt": _now()}
            _db["nextShortlistId"] += 1
            _db["shortlists"].append(s)
            _save()
            return s

    def list_for_profile(self, profile_id):
        with _lock:
            items = [s for s in _db["shortlists"] if s["profileId"] == int(profile_id)]
            return sorted(items, key=lambda s: s["createdAt"], reverse=True)


crops = Crops()
profiles = Profiles()
shortlists = Shortlists()
