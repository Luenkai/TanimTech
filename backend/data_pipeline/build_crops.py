"""Builds clean/crops_clean.csv for the `crops` table.

Sources:  FAO ECOCROP (pH, temperature, rainfall, cycle days)  +  Kaggle (humidity, only where it has the crop)
          +  your own crops_wanted.csv (the crop list, local names, categories, planting months).

Rules (all documented so the team can change them):
  * Only crops listed in crops_wanted.csv are kept (everything else in ECOCROP is dropped).
  * The scoring band is the OPTIMUM range (…OPMN–…OPMX); if missing we fall back to the absolute range.
  * ECOCROP rainfall is ANNUAL mm. The website scores MONTHLY mm, so we divide by 12 (rough conversion, flagged).
  * ECOCROP has NO humidity. Humidity comes from Kaggle (5th-95th percentile) when the crop has a kaggle_label,
    otherwise from the manual columns in crops_wanted.csv. Rows with no humidity source get needs_review=1.
"""
import os

import numpy as np
import pandas as pd

from . import config
from .common import norm_name, to_number, write_outputs

OUT_COLS = [
    "slug", "name", "scientific", "category", "life_form", "summary",
    "ph_min", "ph_max", "temp_min", "temp_max", "rain_min", "rain_max", "humidity_min", "humidity_max",
    "days_min", "days_max", "best_months", "possible_months", "flood_note", "typhoon_note",
    "ph_abs_min", "ph_abs_max", "temp_abs_min", "temp_abs_max", "rain_abs_min", "rain_abs_max",
    "data_source", "humidity_source", "needs_review",
]
ECO_NUM = ["TMIN", "TMAX", "TOPMN", "TOPMX", "RMIN", "RMAX", "ROPMN", "ROPMX",
           "PHMIN", "PHMAX", "PHOPMN", "PHOPMX", "GMIN", "GMAX"]


def clean_ecocrop(df):
    """Keep only the columns we use, make numbers numeric, drop rows with no name."""
    df = df.copy()
    df.columns = [c.strip().upper() for c in df.columns]
    sci_col = "SCIENTNAME" if "SCIENTNAME" in df.columns else "SCINAME" if "SCINAME" in df.columns else None
    if sci_col is None:
        raise ValueError("ECOCROP file has no SCIENTNAME column. Columns found: " + ", ".join(df.columns))
    keep = [c for c in [sci_col, "COMNAME", "LIFO", "CAT"] + ECO_NUM if c in df.columns]
    df = df[keep].rename(columns={sci_col: "SCIENTNAME"})
    for c in ECO_NUM:
        if c in df.columns:
            df[c] = df[c].map(to_number)
        else:
            df[c] = np.nan
    df["_key"] = df["SCIENTNAME"].map(norm_name)
    return df[df["_key"] != ""].reset_index(drop=True)


def match_ecocrop(eco, scientific):
    """Match 'Brassica rapa subsp. chinensis' to ECOCROP: exact, then by 'genus species' prefix.
    If several rows match, the one with the most filled-in numbers wins."""
    key = norm_name(scientific)
    exact = eco[eco["_key"] == key]
    if exact.empty:
        genus_species = " ".join(key.split()[:2])
        exact = eco[eco["_key"].str.startswith(genus_species)]
    if exact.empty:
        return None
    filled = exact[ECO_NUM].notna().sum(axis=1)
    return exact.loc[filled.idxmax()]


def kaggle_humidity(df, low=config.KAGGLE_LOW_PCT, high=config.KAGGLE_HIGH_PCT):
    """label -> (humidity_min, humidity_max) using the 5th and 95th percentile."""
    df = df.copy()
    df.columns = [c.strip().lower() for c in df.columns]
    if not {"label", "humidity"} <= set(df.columns):
        raise ValueError("Kaggle file needs 'label' and 'humidity' columns. Found: " + ", ".join(df.columns))
    df["humidity"] = df["humidity"].map(to_number)
    out = {}
    for label, g in df.dropna(subset=["humidity"]).groupby(df["label"].str.strip().str.lower()):
        out[label] = (round(float(np.percentile(g["humidity"], low))), round(float(np.percentile(g["humidity"], high))))
    return out


def _pick(row, opt_lo, opt_hi, abs_lo, abs_hi, scale=1.0):
    lo = row.get(opt_lo)
    hi = row.get(opt_hi)
    a_lo, a_hi = row.get(abs_lo), row.get(abs_hi)
    if pd.isna(lo) or pd.isna(hi) or lo >= hi:
        lo, hi = a_lo, a_hi
    f = lambda v: np.nan if pd.isna(v) else v * scale
    return f(lo), f(hi), f(a_lo), f(a_hi)


def build_crops(eco, wanted, kaggle=None):
    """Returns (clean_dataframe, list_of_problems)."""
    kaggle = kaggle or {}
    rows, problems = [], []
    for _, w in wanted.iterrows():
        slug, sci = str(w["slug"]).strip(), str(w["scientific"]).strip()
        m = match_ecocrop(eco, sci)
        if m is None:
            problems.append(f"{slug}: '{sci}' not found in ECOCROP. Check the scientific name or enter values by hand.")
            continue
        ph = _pick(m, "PHOPMN", "PHOPMX", "PHMIN", "PHMAX")
        tp = _pick(m, "TOPMN", "TOPMX", "TMIN", "TMAX")
        rn = _pick(m, "ROPMN", "ROPMX", "RMIN", "RMAX", scale=1 / 12)  # annual mm -> mm per month

        hum_lo, hum_hi, hum_src = to_number(w.get("humidity_min")), to_number(w.get("humidity_max")), "manual placeholder"
        label = str(w.get("kaggle_label", "")).strip().lower()
        if label and label in kaggle:
            (hum_lo, hum_hi), hum_src = kaggle[label], "kaggle"
        have_hum = not (pd.isna(hum_lo) or pd.isna(hum_hi))
        if not have_hum:
            hum_src = "none"

        core = [ph[0], ph[1], tp[0], tp[1], rn[0], rn[1], m["GMIN"], m["GMAX"]]
        missing = any(pd.isna(v) for v in core)
        if missing:
            problems.append(f"{slug}: ECOCROP row is missing pH, temperature, rainfall or cycle values. Row dropped.")
            continue
        rows.append({
            "slug": slug, "name": w["name"], "scientific": sci, "category": w["category"], "life_form": w["life_form"],
            "summary": w.get("summary", ""),
            "ph_min": round(ph[0], 1), "ph_max": round(ph[1], 1),
            "temp_min": round(tp[0], 1), "temp_max": round(tp[1], 1),
            "rain_min": round(rn[0]), "rain_max": round(rn[1]),
            "humidity_min": hum_lo if have_hum else "", "humidity_max": hum_hi if have_hum else "",
            "days_min": int(m["GMIN"]), "days_max": int(m["GMAX"]),
            "best_months": w.get("best_months", ""), "possible_months": w.get("possible_months", ""),
            "flood_note": w.get("flood_note", ""), "typhoon_note": w.get("typhoon_note", ""),
            "ph_abs_min": ph[2], "ph_abs_max": ph[3], "temp_abs_min": tp[2], "temp_abs_max": tp[3],
            "rain_abs_min": round(rn[2]) if not pd.isna(rn[2]) else "", "rain_abs_max": round(rn[3]) if not pd.isna(rn[3]) else "",
            "data_source": "FAO ECOCROP (rainfall = annual/12)", "humidity_source": hum_src,
            "needs_review": 1 if hum_src in ("manual placeholder", "none") else 0,
        })
    return pd.DataFrame(rows, columns=OUT_COLS), problems


def run():
    eco = clean_ecocrop(pd.read_csv(os.path.join(config.RAW, config.ECOCROP_FILE), encoding="utf-8-sig", low_memory=False))
    wanted = pd.read_csv(os.path.join(config.INPUTS, config.WANTED_CROPS_FILE), dtype=str, keep_default_na=False)
    kag_path = os.path.join(config.RAW, config.KAGGLE_FILE)
    kag = kaggle_humidity(pd.read_csv(kag_path)) if os.path.exists(kag_path) else {}
    out, problems = build_crops(eco, wanted, kag)
    write_outputs(out, "crops_clean", config.CLEAN)
    print(f"crops_clean.csv: {len(out)} crops kept out of {len(eco)} ECOCROP rows (the rest were dropped)")
    for p in problems:
        print("  !", p)
    return out
