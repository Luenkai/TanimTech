"""Seasonal planting calendar (screen 11)."""
from .scoring import score_crop

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def seasonal_calendar(crops):
    """Return monthly slots without inventing crop-specific planting windows."""
    rows = []
    for c in crops:
        months = []
        for i, m in enumerate(MONTHS, start=1):
            status = "best" if i in c["best_months"] else "possible" if i in c["possible_months"] else "avoid"
            months.append({"month": m, "status": status})
        rows.append({"slug": c["slug"], "name": c["name"], "months": months})
    return {"source": "No crop-specific monthly window is inferred; supply local climate values for screening.", "months": MONTHS, "rows": rows}


def climate_calendar(crops, climate, soil_ph):
    """If the farm supplies 12 climate values, score every crop for every month.
    The score uses the committed ECOCROP bands and is not a forecast."""
    rows = []
    for c in crops:
        months = []
        for i, m in enumerate(MONTHS):
            fit = score_crop(c, {"soilPh": soil_ph, **climate[i]})["fit"]
            months.append({"month": m, "fit": fit,
                           "status": "best" if fit >= 75 else "possible" if fit >= 55 else "avoid"})
        rows.append({"slug": c["slug"], "name": c["name"], "months": months})
    return {"source": "Your monthly climate values · ECOCROP screening score, not a forecast.", "months": MONTHS, "rows": rows}
