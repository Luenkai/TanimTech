"""Seasonal planting calendar (screen 11)."""
from .scoring import score_crop

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def demo_calendar(crops):
    """Uses each crop's best/possible months. Not a forecast."""
    rows = []
    for c in crops:
        months = []
        for i, m in enumerate(MONTHS, start=1):
            status = "best" if i in c["best_months"] else "possible" if i in c["possible_months"] else "avoid"
            months.append({"month": m, "status": status})
        rows.append({"slug": c["slug"], "name": c["name"], "months": months})
    return {"source": "demo planting months (placeholder data, not a forecast)", "months": MONTHS, "rows": rows}


def climate_calendar(crops, climate, soil_ph):
    """If the farm supplies 12 monthly climate values, score every crop for every month.
    fit >= 75 best, >= 55 possible, otherwise avoid (demo thresholds)."""
    rows = []
    for c in crops:
        months = []
        for i, m in enumerate(MONTHS):
            fit = score_crop(c, {"soilPh": soil_ph, **climate[i]})["fit"]
            months.append({"month": m, "fit": fit,
                           "status": "best" if fit >= 75 else "possible" if fit >= 55 else "avoid"})
        rows.append({"slug": c["slug"], "name": c["name"], "months": months})
    return {"source": "your monthly climate values · illustrative scoring", "months": MONTHS, "rows": rows}
