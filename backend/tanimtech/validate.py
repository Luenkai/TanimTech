import math

# Same limits as the inputs in conditions.html
CORE = {
    "soilPh":      {"min": 0,   "max": 14,   "label": "Soil pH"},
    "temperature": {"min": -10, "max": 60,   "label": "Temperature"},
    "humidity":    {"min": 0,   "max": 100,  "label": "Humidity"},
    "rainfall":    {"min": 0,   "max": 5000, "label": "Rainfall"},
}
OPTIONS = {
    "elevation": ["Lowland", "Upland", "Unknown"],
    "soilType": ["Clay", "Loam", "Sandy", "Unknown"],
    "soilTypeSource": ["manual", "user-confirmed", "model-suggested"],
    "season": ["Dry season", "Wet season", "Unknown"],
    "plantCategory": ["All categories", "Leafy and fruit vegetables", "Legumes", "Grains", "Root crops",
                      "Fruit trees", "Plantation crops", "Edible trees and herbs", "Fruits & nuts", "Vegetables"],
    "lifeForm": ["No preference", "Herb", "Vine", "Tree", "Shrub"],
    # core = the 7 curated crops; extended = core + the ~700-plant edible ECOCROP catalog
    "catalog": ["core", "extended"],
}
SOIL_DETAILS = {
    "soilTexture": {"min": 0, "max": 100, "label": "Soil texture confidence"},
    "organicMatter": {"min": 0, "max": 100, "label": "Organic matter"},
}


def check_number(key, raw, prefix=""):
    """Returns (value, error). Accepts numbers or numeric strings, never booleans."""
    rule = CORE[key]
    if raw is None or raw == "":
        return None, f"{prefix}{rule['label']} is required."
    try:
        if isinstance(raw, bool):
            raise ValueError
        n = float(raw)
        if not math.isfinite(n) or n < rule["min"] or n > rule["max"]:
            raise ValueError
    except (TypeError, ValueError):
        return None, f"{prefix}{rule['label']} must be a number between {rule['min']} and {rule['max']}."
    return n, None


def validate_conditions(body):
    errors, core, context = [], {}, {}
    if not isinstance(body, dict):
        return ["Send a JSON object."], core, context
    for key in CORE:
        value, err = check_number(key, body.get(key))
        if err:
            errors.append(err)
        else:
            core[key] = value
    for key, allowed in OPTIONS.items():
        value = body.get(key)
        if value is None or value == "":
            continue
        if value not in allowed:
            errors.append(f"{key} must be one of: {', '.join(allowed)}.")
        else:
            context[key] = value
    for key in ("region", "planningMonth", "monthlyRisk"):
        value = body.get(key)
        if isinstance(value, str) and value.strip():
            context[key] = value.strip()[:100]
    for key in ("soilTexture", "drainage", "organicMatter", "moisture", "salinity", "nitrogen", "phosphorus", "potassium", "soilNotes"):
        value = body.get(key)
        if value is None or value == "":
            continue
        if key == "soilNotes":
            if isinstance(value, str):
                context[key] = value.strip()[:300]
            continue
        if key in ("soilTexture", "drainage", "salinity", "moisture"):
            allowed = {"soilTexture": ["Clay", "Loam", "Sandy", "Silty", "Peaty", "Unknown"], "drainage": ["Poor", "Moderate", "Well-drained", "Rapid", "Unknown"], "salinity": ["Low", "Moderate", "High", "Unknown"], "moisture": ["Dry", "Moist", "Waterlogged", "Unknown"]}[key]
            if value not in allowed:
                errors.append(f"{key} must be one of: {', '.join(allowed)}.")
            else:
                context[key] = value
        else:
            try:
                number = float(value)
                limits = {"organicMatter": (0, 100), "nitrogen": (0, 10000), "phosphorus": (0, 10000), "potassium": (0, 10000)}[key]
                if not math.isfinite(number) or not limits[0] <= number <= limits[1]:
                    raise ValueError
                context[key] = number
            except (TypeError, ValueError):
                errors.append(f"{key} must be a number in its supported range.")
    return errors, core, context


def validate_monthly_climate(items):
    """12 entries (Jan..Dec) of {temperature, humidity, rainfall} for the seasonal calendar."""
    if not isinstance(items, list) or len(items) != 12:
        return ["monthlyClimate must be a list of 12 months (January to December)."], None
    errors, climate = [], []
    for i, m in enumerate(items, start=1):
        entry = {}
        for key in ("temperature", "humidity", "rainfall"):
            value, err = check_number(key, m.get(key) if isinstance(m, dict) else None, prefix=f"Month {i}: ")
            if err:
                errors.append(err)
            else:
                entry[key] = value
        climate.append(entry)
    return errors, (None if errors else climate)
