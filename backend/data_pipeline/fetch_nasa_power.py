"""Downloads 20-year monthly climate normals (2001-2020) from NASA POWER for every province in
sample_inputs/provinces.csv and writes clean/province_climate_monthly.csv.
Needs internet. Results are cached in raw/nasa_cache/ so a re-run does not call the API again."""
import json
import os
import time
import urllib.parse
import urllib.request

import pandas as pd

from . import config
from .common import write_outputs

MONTH_KEYS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]  # PRECTOTCORR is mm/day -> multiply to get mm/month
URL = "https://power.larc.nasa.gov/api/temporal/climatology/point"


def parse_climatology(payload, province):
    """payload = JSON from the POWER climatology API -> 12 rows (one per month)."""
    p = payload["properties"]["parameter"]
    rows = []
    for i, key in enumerate(MONTH_KEYS):
        t, rh, pr = p["T2M"][key], p["RH2M"][key], p["PRECTOTCORR"][key]
        if any(v is None or v <= -900 for v in (t, rh, pr)):      # POWER uses -999 for missing
            continue
        rows.append({"province": province, "month": i + 1, "temp_c": round(t, 1),
                     "humidity_pct": round(rh), "rainfall_mm": round(pr * DAYS[i])})
    return rows


def fetch_point(lat, lon):
    q = urllib.parse.urlencode({"parameters": "T2M,RH2M,PRECTOTCORR", "community": "AG",
                                "latitude": lat, "longitude": lon, "format": "JSON"})
    with urllib.request.urlopen(f"{URL}?{q}", timeout=60) as r:
        return json.load(r)


def run():
    provinces = pd.read_csv(os.path.join(config.INPUTS, config.PROVINCES_FILE))
    cache = os.path.join(config.RAW, "nasa_cache")
    os.makedirs(cache, exist_ok=True)
    rows = []
    for _, p in provinces.iterrows():
        f = os.path.join(cache, f"{p['province'].replace(' ', '_')}.json")
        if os.path.exists(f):
            payload = json.load(open(f, encoding="utf-8"))
        else:
            print("downloading", p["province"])
            payload = fetch_point(p["lat"], p["lon"])
            json.dump(payload, open(f, "w", encoding="utf-8"))
            time.sleep(1)  # be polite to the API
        rows += parse_climatology(payload, p["province"])
    out = pd.DataFrame(rows)
    write_outputs(out, "province_climate_monthly", config.CLEAN)
    print(f"province_climate_monthly.csv: {len(out)} rows ({out['province'].nunique()} provinces x 12 months)")
    return out
