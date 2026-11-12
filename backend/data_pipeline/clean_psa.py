"""Cleans PSA OpenSTAT exports (area planted / harvested by province) into clean/crop_area_clean.csv.

I could not see your exact download, so this auto-detects the common PxWeb layouts:
  * long  : columns like Geolocation, Crop, Year, Indicator, value
  * wide  : one column per year (2010, 2011, ...)
It prints what it detected. If it complains, send me the first 10 lines of the file.
"""
import os
import re

import numpy as np
import pandas as pd

from . import config
from .common import read_csv_smart, to_number, write_outputs

PROVINCE_COLS = ("geolocation", "province", "area", "region/province", "location")
CROP_COLS = ("commodity", "crop", "crops", "crop name")
INDICATOR_COLS = ("indicator", "information", "measure", "data", "statistic")


def _find(cols, options):
    low = {c.lower().strip(): c for c in cols}
    for o in options:
        if o in low:
            return low[o]
    return None


def tidy_psa(df, value_name="value"):
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]
    prov = _find(df.columns, PROVINCE_COLS) or df.columns[0]
    year_cols = [c for c in df.columns if re.fullmatch(r"(19|20)\d{2}", c.strip())]
    if year_cols:  # wide -> long
        ids = [c for c in df.columns if c not in year_cols]
        df = df.melt(id_vars=ids, value_vars=year_cols, var_name="year", value_name=value_name)
    else:
        year = _find(df.columns, ("year", "period", "time"))
        val = [c for c in df.columns if c not in (prov, year, _find(df.columns, CROP_COLS), _find(df.columns, INDICATOR_COLS))]
        if year is None or not val:
            raise ValueError("Cannot find a Year column or year columns. Columns found: " + ", ".join(df.columns))
        df = df.rename(columns={year: "year", val[-1]: value_name})
    crop = _find(df.columns, CROP_COLS)
    ind = _find(df.columns, INDICATOR_COLS)

    out = pd.DataFrame({
        "geo_raw": df[prov].astype(str),
        "crop": df[crop].astype(str).str.strip() if crop else "",
        "indicator": df[ind].astype(str).str.strip() if ind else value_name,
        "year": df["year"].map(to_number),
        "value": df[value_name].map(to_number),
    })
    out["depth"] = out["geo_raw"].map(lambda s: len(s) - len(s.lstrip(". \u00a0")))
    out["province"] = out["geo_raw"].str.lstrip(". \u00a0").str.strip()
    return out


def keep_provinces(df):
    """PSA lists Philippines > Region > Province with leading dots. Keep only the deepest level (provinces)."""
    drop_names = {"philippines", "all regions", "total"}
    df = df[~df["province"].str.lower().isin(drop_names)]
    if df["depth"].nunique() > 1:
        df = df[df["depth"] == df["depth"].max()]
    else:  # no dots: just drop obvious region rows
        df = df[~df["province"].str.contains(r"\bregion\b|^region |^nir$|^ncr$|^car$|^barmm$|^armm$", case=False, regex=True)]
    return df


def clean_area(df):
    t = tidy_psa(df)
    t = t.dropna(subset=["year", "value"])           # drops '..', '-', 'x' rows
    t = keep_provinces(t)
    t = t[t["value"] >= 0]
    t["year"] = t["year"].astype(int)
    t["indicator"] = t["indicator"].str.lower().map(
        lambda s: "area_harvested_ha" if "harvest" in s else "area_planted_ha" if "plant" in s else s.replace(" ", "_"))
    wide = t.pivot_table(index=["province", "crop", "year"], columns="indicator", values="value", aggfunc="sum").reset_index()
    wide.columns.name = None
    return wide.sort_values(["province", "crop", "year"]).reset_index(drop=True)


def run():
    path = os.path.join(config.RAW, config.PSA_AREA_FILE)
    out = clean_area(read_csv_smart(path))
    write_outputs(out, "crop_area_clean", config.CLEAN)
    print(f"crop_area_clean.csv: {len(out)} rows, {out['province'].nunique()} provinces, {out['crop'].nunique()} crops")
    return out
