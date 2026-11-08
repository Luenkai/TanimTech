"""NOAA IBTrACS (West Pacific file) -> clean/province_typhoon_monthly.csv

For every province point, count the DISTINCT storms (>= tropical-storm strength) whose track passed within
TYPHOON_RADIUS_KM, by calendar month, divided by the number of years in the data.
risk_label: Low / Caution / High using the demo thresholds in config.py (review them)."""
import os

import numpy as np
import pandas as pd

from . import config
from .common import haversine_km, write_outputs


def load_tracks(path_or_df):
    df = path_or_df if isinstance(path_or_df, pd.DataFrame) else pd.read_csv(
        path_or_df, skiprows=[1], low_memory=False, na_values=[" ", ""])   # row 2 of IBTrACS is a units row
    df.columns = [c.strip().upper() for c in df.columns]
    wind = None
    for c in ("WMO_WIND", "USA_WIND", "TOKYO_WIND", "CMA_WIND"):
        if c in df.columns:
            w = pd.to_numeric(df[c], errors="coerce")
            wind = w if wind is None else wind.fillna(w)
    if wind is None:
        raise ValueError("IBTrACS file has no wind column (WMO_WIND/USA_WIND).")
    out = pd.DataFrame({
        "sid": df["SID"].astype(str),
        "time": pd.to_datetime(df["ISO_TIME"], errors="coerce"),
        "lat": pd.to_numeric(df["LAT"], errors="coerce"),
        "lon": pd.to_numeric(df["LON"], errors="coerce"),
        "wind": wind,
    }).dropna(subset=["time", "lat", "lon"])
    out = out[(out["time"].dt.year >= config.TYPHOON_FIRST_YEAR) & (out["wind"] >= config.TYPHOON_MIN_WIND_KT)]
    return out


def monthly_risk(tracks, provinces, radius_km=config.TYPHOON_RADIUS_KM):
    years = max(1, int(tracks["time"].dt.year.max() - tracks["time"].dt.year.min() + 1)) if len(tracks) else 1
    rows = []
    for _, p in provinces.iterrows():
        d = haversine_km(tracks["lat"].to_numpy(), tracks["lon"].to_numpy(), p["lat"], p["lon"])
        near = tracks[d <= radius_km]
        # a storm counts once, in the month it first came within range
        first = near.sort_values("time").groupby("sid").first()
        counts = first["time"].dt.month.value_counts()
        for m in range(1, 13):
            avg = counts.get(m, 0) / years
            label = "High" if avg >= config.RISK_HIGH else "Caution" if avg >= config.RISK_CAUTION else "Low"
            rows.append({"province": p["province"], "month": m, "storms_per_year": round(avg, 3), "risk_label": label})
    return pd.DataFrame(rows)


def run():
    tracks = load_tracks(os.path.join(config.RAW, config.IBTRACS_FILE))
    provinces = pd.read_csv(os.path.join(config.INPUTS, config.PROVINCES_FILE))
    out = monthly_risk(tracks, provinces)
    write_outputs(out, "province_typhoon_monthly", config.CLEAN)
    print(f"province_typhoon_monthly.csv: {len(out)} rows from {tracks['sid'].nunique()} storms")
    return out
