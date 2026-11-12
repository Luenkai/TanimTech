"""Fit scoring: 4 weighted core factors, same weights shown on recommendations.html
(pH 30, temperature 30, rainfall 25, humidity 15 = 100).
Add-on context (soil type, season, risk...) NEVER adds points; it only produces guidance notes."""
from .util import round_half_up
from .kaggle_data import evidence_for

FACTORS = [
    {"key": "soilPh",      "label": "Soil pH",     "weight": 30, "min": "ph_min",       "max": "ph_max"},
    {"key": "temperature", "label": "Temperature", "weight": 30, "min": "temp_min",     "max": "temp_max"},
    {"key": "rainfall",    "label": "Rainfall",    "weight": 25, "min": "rain_min",     "max": "rain_max"},
    {"key": "humidity",    "label": "Humidity",    "weight": 15, "min": "humidity_min", "max": "humidity_max"},
]


def factor_points(value, lo, hi, weight):
    """Inside the band: 50%-100% of the weight (best at the middle of the band).
    Outside the band: drops linearly from 50% to 0% over one band-width beyond the edge."""
    width = hi - lo
    if lo <= value <= hi:
        mid = (lo + hi) / 2
        closeness = 1 - abs(value - mid) / (width / 2)
        return weight * (0.5 + 0.5 * closeness)
    dist = lo - value if value < lo else value - hi
    return max(0.0, weight * 0.5 * (1 - dist / width))


def score_crop(crop, data):
    breakdown = []
    for f in FACTORS:
        value = float(data[f["key"]])
        lo, hi = float(crop[f["min"]]), float(crop[f["max"]])
        status = "below" if value < lo else "above" if value > hi else "within"
        breakdown.append({
            "factor": f["key"], "label": f["label"], "value": value, "band": [lo, hi],
            "points": round_half_up(factor_points(value, lo, hi, f["weight"])),
            "maxPoints": f["weight"], "status": status,
        })
    return {"fit": sum(b["points"] for b in breakdown), "breakdown": breakdown}


def _num(x):
    return int(x) if float(x).is_integer() else x


def explain(crop, breakdown):
    within = [b["label"].lower() for b in breakdown if b["status"] == "within"]
    off = [b for b in breakdown if b["status"] != "within"]
    if within:
        text = ", ".join(within)
        why = f"{text[0].upper() + text[1:]} sit within the example reference bands for {crop['name']}."
    else:
        why = f"None of the four core values sit inside the example bands for {crop['name']}."
    if off:
        check = " ".join(
            f"{b['label']} ({_num(b['value'])}) is {b['status']} the demo band {_num(b['band'][0])}–{_num(b['band'][1])}."
            for b in off)
    else:
        check = "All four core values are within band; drainage, pests and seed quality are still unassessed."
    return {"whyItAppears": why, "whatToCheck": check}


def context_notes(ctx):
    """Guidance only, never scored."""
    notes = []
    if ctx.get("soilType") and ctx["soilType"] != "Unknown":
        notes.append(f'Soil type "{ctx["soilType"]}" is user-entered; texture alone does not establish drainage.')
    risk = (ctx.get("monthlyRisk") or "").lower()
    if ctx.get("season") == "Wet season" or risk.startswith(("caution", "high")):
        notes.append("Wet-season / storm risk: heavy rain can still stress crops. Follow local advisories.")
    notes.append("Drainage, pests and seed quality are not included in the score.")
    return notes


def recommend(crops, data, ctx=None):
    ctx = ctx or {}
    pool = list(crops)
    if ctx.get("plantCategory") and ctx["plantCategory"] != "All categories":
        pool = [c for c in pool if c["category"] == ctx["plantCategory"]]
    if ctx.get("lifeForm") and ctx["lifeForm"] != "No preference":
        pool = [c for c in pool if c["life_form"] == ctx["lifeForm"]]

    results = []
    for crop in pool:
        s = score_crop(crop, data)
        results.append({
            "slug": crop["slug"], "name": crop["name"], "category": crop["category"],
            "lifeForm": crop["life_form"], "growingDays": [crop["days_min"], crop["days_max"]],
            "fit": s["fit"], "breakdown": s["breakdown"], **explain(crop, s["breakdown"]),
            "notes": context_notes(ctx),
            "disclaimer": "Demo fit / 100 · not a probability of success.",
            "dataEvidence": evidence_for(crop["slug"]),
        })
    results.sort(key=lambda r: -r["fit"])  # stable sort keeps list order for ties
    for i, r in enumerate(results):
        r["label"] = "CLOSEST FIT" if i == 0 else "ALTERNATIVE"
    return results
