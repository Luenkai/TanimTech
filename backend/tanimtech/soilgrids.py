"""Soil type from coordinates using the ISRIC SoilGrids 2.0 REST API (no API key needed).

    GET https://rest.isric.org/soilgrids/v2.0/properties/query?lon=..&lat=..&property=clay&...

SoilGrids is a MODELLED global map at 250 m resolution — it is a good first estimate of soil
texture, pH and organic carbon for a coordinate, but it is not a laboratory result for the field.
The response is turned into: clay/silt/sand %, a USDA texture class, and the soil values the
TanimTech form already asks for (soil type, soil texture, organic matter, pH estimate).
The public ISRIC server is rate limited (about 5 calls/minute), so answers are cached.
"""
from .upstream import TTLCache, UpstreamError, fetch_json

URL = "https://rest.isric.org/soilgrids/v2.0/properties/query"
PROPERTIES = ["clay", "sand", "silt", "phh2o", "soc", "cec", "nitrogen"]
DEPTHS = ["0-5cm", "5-15cm", "15-30cm"]
THICKNESS = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15}
# Used only if the response does not carry unit_measure.d_factor (it normally does).
DEFAULT_FACTOR = {"clay": 10, "sand": 10, "silt": 10, "phh2o": 10, "soc": 10, "cec": 10, "nitrogen": 100}

_cache = TTLCache(ttl=24 * 3600, max_items=2000)

CAVEATS = [
    "SoilGrids is a modelled 250 m map, not a laboratory test. Confirm with a representative soil sample.",
    "pH is the modelled value for 0–30 cm in water (pH H2O). Use a measured pH in the form when you have one.",
    "Drainage, salinity and rooting depth are not provided; check them in the field.",
]


# ---- texture classification --------------------------------------------------------------------
def usda_class(sand, silt, clay):
    """USDA soil texture triangle. Inputs are percentages (normalised to 100 first)."""
    total = sand + silt + clay
    if total <= 0:
        return "Unknown"
    sand, silt, clay = (100 * v / total for v in (sand, silt, clay))
    if silt + 1.5 * clay < 15:
        return "Sand"
    if silt + 1.5 * clay >= 15 and silt + 2 * clay < 30:
        return "Loamy sand"
    if (7 <= clay < 20 and sand > 52 and silt + 2 * clay >= 30) or (clay < 7 and silt < 50 and silt + 2 * clay >= 30):
        return "Sandy loam"
    if 7 <= clay < 27 and 28 <= silt < 50 and sand <= 52:
        return "Loam"
    if (silt >= 50 and 12 <= clay < 27) or (50 <= silt < 80 and clay < 12):
        return "Silt loam"
    if silt >= 80 and clay < 12:
        return "Silt"
    if 20 <= clay < 35 and silt < 28 and sand > 45:
        return "Sandy clay loam"
    if 27 <= clay < 40 and 20 < sand <= 45:
        return "Clay loam"
    if 27 <= clay < 40 and sand <= 20:
        return "Silty clay loam"
    if clay >= 35 and sand > 45:
        return "Sandy clay"
    if clay >= 40 and silt >= 40:
        return "Silty clay"
    if clay >= 40:
        return "Clay"
    return "Loam"  # rounding gaps on class boundaries


# USDA class -> the soil-texture choices the TanimTech form has (Clay, Loam, Sandy, Silty, Peaty).
APP_TEXTURE = {
    "Sand": "Sandy", "Loamy sand": "Sandy", "Sandy loam": "Sandy",
    "Loam": "Loam", "Sandy clay loam": "Loam", "Clay loam": "Loam",
    "Silt loam": "Silty", "Silt": "Silty", "Silty clay loam": "Silty",
    "Clay": "Clay", "Sandy clay": "Clay", "Silty clay": "Clay",
}
# The older "Soil type" dropdown only has Clay / Loam / Sandy / Unknown.
APP_SOIL_TYPE = {"Clay": "Clay", "Loam": "Loam", "Sandy": "Sandy", "Silty": "Loam", "Peaty": "Unknown"}
PEATY_SOC_G_PER_KG = 120  # organic soils start around 12 % organic carbon


def classify(sand, silt, clay, soc_g_per_kg=None):
    """Return {usdaClass, appTexture, appSoilType} for percentages (and optional organic carbon)."""
    usda = usda_class(sand, silt, clay)
    texture = "Peaty" if (soc_g_per_kg or 0) >= PEATY_SOC_G_PER_KG else APP_TEXTURE.get(usda, "Unknown")
    return {"usdaClass": "Organic (peaty)" if texture == "Peaty" else usda, "appTexture": texture,
            "appSoilType": APP_SOIL_TYPE.get(texture, "Unknown")}


# ---- response parsing --------------------------------------------------------------------------
def parse_layers(payload):
    """-> {property: {depth_label: value in conventional units or None}}"""
    layers = ((payload or {}).get("properties") or {}).get("layers")
    if not isinstance(layers, list):
        raise UpstreamError("SoilGrids returned an unexpected response.", 502)
    out = {}
    for layer in layers:
        name = layer.get("name")
        factor = ((layer.get("unit_measure") or {}).get("d_factor")) or DEFAULT_FACTOR.get(name, 1)
        out[name] = {}
        for depth in layer.get("depths", []):
            mean = (depth.get("values") or {}).get("mean")
            out[name][depth.get("label")] = None if mean is None else round(mean / factor, 3)
    return out


def depth_mean(per_depth):
    """Thickness-weighted mean over 0–30 cm, ignoring missing depths."""
    num = den = 0.0
    for label, value in per_depth.items():
        w = THICKNESS.get(label)
        if value is not None and w:
            num, den = num + value * w, den + w
    return None if den == 0 else num / den


def interpret(layers, lat, lon):
    mean = {p: depth_mean(layers.get(p, {})) for p in PROPERTIES}
    if mean["clay"] is None or mean["sand"] is None or mean["silt"] is None:
        raise UpstreamError("SoilGrids has no soil data at this point (open water, ice or built-up land). "
                            "Try a nearby coordinate on farmland.", 404, 404)
    soc = mean["soc"]
    cls = classify(mean["sand"], mean["silt"], mean["clay"], soc)
    r1 = lambda v: None if v is None else round(v, 1)
    return {
        "location": {"latitude": lat, "longitude": lon},
        "depth": "0–30 cm (thickness-weighted mean of 0–5, 5–15 and 15–30 cm)",
        "texture": {"clayPct": r1(mean["clay"]), "siltPct": r1(mean["silt"]), "sandPct": r1(mean["sand"]), "usdaClass": cls["usdaClass"]},
        "appTexture": cls["appTexture"], "appSoilType": cls["appSoilType"],
        "phEstimate": None if mean["phh2o"] is None else round(mean["phh2o"], 1),
        "organicCarbonGPerKg": r1(soc),
        "organicMatterPct": None if soc is None else round(soc * 1.724 / 10, 1),  # van Bemmelen factor
        "cecCmolPerKg": r1(mean["cec"]), "nitrogenGPerKg": None if mean["nitrogen"] is None else round(mean["nitrogen"], 2),
        "layers": layers,
        "source": {"name": "ISRIC SoilGrids 2.0", "kind": "modelled prediction", "resolution": "250 m",
                   "url": "https://soilgrids.org", "api": URL},
        "caveats": CAVEATS,
    }


def lookup(lat, lon):
    lat, lon = round(float(lat), 3), round(float(lon), 3)  # ~110 m, finer than the 250 m grid; improves cache hits
    key = (lat, lon)
    cached = _cache.get(key)
    if cached:
        return {**cached, "cached": True}
    params = {"lat": lat, "lon": lon, "property": PROPERTIES, "depth": DEPTHS, "value": "mean"}
    payload = fetch_json(URL, params, timeout=30, retries=1, provider="SoilGrids")
    result = interpret(parse_layers(payload), lat, lon)
    _cache.set(key, result)
    return {**result, "cached": False}
