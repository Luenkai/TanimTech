"""Clean and profile the two Kaggle datasets used for TanimTech research.

This module deliberately does not change the website or Flask recommendation API.
It produces normalized observations and crop-level profiles that can be reviewed
before they become production recommendation inputs.

Expected raw files:
  raw/kaggle_crop_soil/data_core.csv
  raw/kaggle_yield/crop_yield.csv
  raw/kaggle_yield/state_soil_data.csv
  raw/kaggle_yield/state_weather_data_1997_2020.csv

Outputs are written to data_pipeline/clean/ as CSV and JSON.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from . import config
from .common import write_outputs

CROP_SOIL_FILES = {
    "samples": "data_core.csv",
}
YIELD_FILES = {
    "yield": "crop_yield.csv",
    "soil": "state_soil_data.csv",
    "weather": "state_weather_data_1997_2020.csv",
}


def _clean_text(series: pd.Series) -> pd.Series:
    return series.astype("string").str.replace(r"\s+", " ", regex=True).str.strip()


def _rename_by_normalized_name(df: pd.DataFrame, mapping: dict[str, str]) -> pd.DataFrame:
    normalized = {str(c).strip().casefold(): c for c in df.columns}
    rename = {}
    for source, target in mapping.items():
        original = normalized.get(source.casefold())
        if original is not None:
            rename[original] = target
    return df.rename(columns=rename)


def _require(df: pd.DataFrame, columns: list[str], label: str) -> None:
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"{label} is missing required columns: {', '.join(missing)}")


def _numeric(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for column in columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    return df


def _report(before: int, after: int, duplicates: int, invalid: int, extra: dict | None = None) -> dict:
    result = {
        "rows_before": int(before),
        "rows_after": int(after),
        "duplicates_removed": int(duplicates),
        "invalid_rows_removed": int(invalid),
    }
    if extra:
        result.update(extra)
    return result


def clean_crop_soil(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Normalize data_core.csv without fabricating the absent pH field."""
    before = len(df)
    df = _rename_by_normalized_name(df.copy(), {
        "temparature": "temperature_c",
        "temperature": "temperature_c",
        "humidity": "humidity_pct",
        "moisture": "moisture_pct",
        "soil type": "soil_type",
        "crop type": "crop",
        "nitrogen": "nitrogen",
        "potassium": "potassium",
        "phosphorous": "phosphorus",
        "phosphorus": "phosphorus",
        "fertilizer name": "fertilizer",
    })
    required = [
        "temperature_c", "humidity_pct", "moisture_pct", "soil_type", "crop",
        "nitrogen", "potassium", "phosphorus", "fertilizer",
    ]
    _require(df, required, "crop-and-soil dataset")
    numeric = ["temperature_c", "humidity_pct", "moisture_pct", "nitrogen", "potassium", "phosphorus"]
    df = _numeric(df, numeric)
    for column in ["soil_type", "crop", "fertilizer"]:
        df[column] = _clean_text(df[column])

    valid = (
        df["temperature_c"].between(-20, 60)
        & df["humidity_pct"].between(0, 100)
        & df["moisture_pct"].between(0, 100)
        & (df[["nitrogen", "potassium", "phosphorus"]] >= 0).all(axis=1)
        & df[["soil_type", "crop", "fertilizer"]].notna().all(axis=1)
        & (df[["soil_type", "crop", "fertilizer"]] != "").all(axis=1)
    )
    invalid = int((~valid).sum())
    df = df.loc[valid].drop_duplicates().reset_index(drop=True)
    duplicates = before - invalid - len(df)
    df.insert(0, "source_row", np.arange(1, len(df) + 1))
    df.insert(1, "sample_id", [f"crop_soil_{i:05d}" for i in range(1, len(df) + 1)])
    columns = [
        "sample_id", "source_row", "temperature_c", "humidity_pct", "moisture_pct",
        "soil_type", "crop", "nitrogen", "potassium", "phosphorus", "fertilizer",
    ]
    out = df[columns]
    return out, _report(
        before, len(out), duplicates, invalid,
        {"pH_available": False, "regions_available": False, "dates_available": False},
    )


def _percentile(series: pd.Series, percentile: float) -> float | None:
    values = pd.to_numeric(series, errors="coerce").dropna().to_numpy()
    return None if len(values) == 0 else round(float(np.percentile(values, percentile)), 4)


def _mode(series: pd.Series) -> str | None:
    values = series.dropna().astype(str)
    if values.empty:
        return None
    return str(values.mode().iloc[0])


def profile_crop_soil(df: pd.DataFrame) -> pd.DataFrame:
    """Create robust crop-level ranges from the soil/crop observations."""
    rows = []
    numeric = ["temperature_c", "humidity_pct", "moisture_pct", "nitrogen", "potassium", "phosphorus"]
    for crop, group in df.groupby("crop", sort=True):
        row = {"crop": crop, "observations": int(len(group)), "dominant_soil_type": _mode(group["soil_type"]), "dominant_fertilizer": _mode(group["fertilizer"])}
        for column in numeric:
            row[f"{column}_p05"] = _percentile(group[column], 5)
            row[f"{column}_median"] = _percentile(group[column], 50)
            row[f"{column}_p95"] = _percentile(group[column], 95)
        rows.append(row)
    return pd.DataFrame(rows)


def clean_state_soil(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    before = len(df)
    df = _rename_by_normalized_name(df.copy(), {"state": "state", "n": "soil_n", "p": "soil_p", "k": "soil_k", "ph": "soil_ph"})
    required = ["state", "soil_n", "soil_p", "soil_k", "soil_ph"]
    _require(df, required, "state soil dataset")
    df["state"] = _clean_text(df["state"])
    df = _numeric(df, required[1:])
    valid = (
        df["state"].notna() & (df["state"] != "")
        & df["soil_ph"].between(0, 14)
        & (df[["soil_n", "soil_p", "soil_k"]] >= 0).all(axis=1)
    )
    invalid = int((~valid).sum())
    df = df.loc[valid].drop_duplicates(subset=["state"]).reset_index(drop=True)
    duplicates = before - invalid - len(df)
    return df[["state", "soil_n", "soil_p", "soil_k", "soil_ph"]], _report(before, len(df), duplicates, invalid)


def clean_state_weather(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    before = len(df)
    df = _rename_by_normalized_name(df.copy(), {
        "state": "state", "year": "year", "avg_temp_c": "temperature_c",
        "total_rainfall_mm": "rainfall_mm", "avg_humidity_percent": "humidity_pct",
    })
    required = ["state", "year", "temperature_c", "rainfall_mm", "humidity_pct"]
    _require(df, required, "state weather dataset")
    df["state"] = _clean_text(df["state"])
    df = _numeric(df, required[1:])
    valid = (
        df["state"].notna() & (df["state"] != "")
        & df["year"].between(1900, 2100)
        & df["temperature_c"].between(-50, 60)
        & (df["rainfall_mm"] >= 0)
        & df["humidity_pct"].between(0, 100)
    )
    invalid = int((~valid).sum())
    df = df.loc[valid].drop_duplicates(subset=["state", "year"]).reset_index(drop=True)
    duplicates = before - invalid - len(df)
    df["year"] = df["year"].astype(int)
    return df[["state", "year", "temperature_c", "rainfall_mm", "humidity_pct"]], _report(before, len(df), duplicates, invalid)


def clean_yield(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    before = len(df)
    df = _rename_by_normalized_name(df.copy(), {
        "crop": "crop", "year": "year", "season": "season", "state": "state",
        "area": "area", "production": "production", "fertilizer": "fertilizer",
        "pesticide": "pesticide", "yield": "yield_value",
    })
    required = ["crop", "year", "season", "state", "area", "production", "fertilizer", "pesticide", "yield_value"]
    _require(df, required, "crop-yield dataset")
    for column in ["crop", "season", "state"]:
        df[column] = _clean_text(df[column])
    df = _numeric(df, required[1:2] + required[4:])
    valid = (
        df[["crop", "season", "state"]].notna().all(axis=1)
        & (df[["crop", "season", "state"]] != "").all(axis=1)
        & df["year"].between(1900, 2100)
        & (df["area"] > 0)
        & (df[["production", "fertilizer", "pesticide", "yield_value"]] >= 0).all(axis=1)
    )
    invalid = int((~valid).sum())
    df = df.loc[valid].drop_duplicates().reset_index(drop=True)
    duplicates = before - invalid - len(df)
    df["year"] = df["year"].astype(int)
    df["calculated_yield"] = df["production"] / df["area"]
    denominator = df["yield_value"].replace(0, np.nan)
    df["yield_relative_error"] = (df["calculated_yield"] - df["yield_value"]).abs() / denominator
    df["yield_reconciliation"] = np.select(
        [df["yield_value"].eq(0), df["yield_relative_error"].le(0.10)],
        ["zero_reported_yield", "within_10pct"],
        default="differs_over_10pct",
    )
    return df[[
        "crop", "year", "season", "state", "area", "production", "fertilizer", "pesticide",
        "yield_value", "calculated_yield", "yield_relative_error", "yield_reconciliation",
    ]], _report(before, len(df), duplicates, invalid, {
        "zero_reported_yield": int((df["yield_reconciliation"] == "zero_reported_yield").sum()),
        "differs_over_10pct": int((df["yield_reconciliation"] == "differs_over_10pct").sum()),
    })


def merge_yield_conditions(yield_df: pd.DataFrame, soil_df: pd.DataFrame, weather_df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    merged = yield_df.merge(soil_df, on="state", how="left", validate="many_to_one")
    merged = merged.merge(weather_df, on=["state", "year"], how="left", validate="many_to_one", suffixes=("", "_weather"))
    condition_columns = ["soil_n", "soil_p", "soil_k", "soil_ph", "temperature_c", "rainfall_mm", "humidity_pct"]
    missing = int(merged[condition_columns].isna().any(axis=1).sum())
    merged["conditions_complete"] = ~merged[condition_columns].isna().any(axis=1)
    report = {"rows": int(len(merged)), "rows_with_complete_conditions": int(merged["conditions_complete"].sum()), "rows_missing_conditions": missing}
    return merged, report


def profile_yield_conditions(merged: pd.DataFrame) -> pd.DataFrame:
    numeric = ["soil_ph", "temperature_c", "rainfall_mm", "humidity_pct", "yield_value"]
    rows = []
    usable = merged[merged["conditions_complete"]].copy()
    for crop, group in usable.groupby("crop", sort=True):
        row = {
            "crop": crop,
            "observations": int(len(group)),
            "states": int(group["state"].nunique()),
            "years": int(group["year"].nunique()),
            "within_10pct_yield_share": round(float((group["yield_reconciliation"] == "within_10pct").mean()), 6),
        }
        for column in numeric:
            row[f"{column}_p05"] = _percentile(group[column], 5)
            row[f"{column}_median"] = _percentile(group[column], 50)
            row[f"{column}_p95"] = _percentile(group[column], 95)
        rows.append(row)
    return pd.DataFrame(rows)


def _read_inputs(raw_dir: str) -> dict[str, pd.DataFrame]:
    root = Path(raw_dir)
    paths = {
        "crop_soil": root / "kaggle_crop_soil" / CROP_SOIL_FILES["samples"],
        "yield": root / "kaggle_yield" / YIELD_FILES["yield"],
        "soil": root / "kaggle_yield" / YIELD_FILES["soil"],
        "weather": root / "kaggle_yield" / YIELD_FILES["weather"],
    }
    missing = [str(path) for path in paths.values() if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing Kaggle input files: " + ", ".join(missing))
    return {key: pd.read_csv(path) for key, path in paths.items()}


def run(raw_dir: str | None = None, clean_dir: str | None = None) -> dict:
    raw_dir = raw_dir or config.RAW
    clean_dir = clean_dir or config.CLEAN
    os.makedirs(clean_dir, exist_ok=True)
    raw = _read_inputs(raw_dir)
    soil_samples, crop_soil_report = clean_crop_soil(raw["crop_soil"])
    soil_profiles = profile_crop_soil(soil_samples)
    yield_rows, yield_report = clean_yield(raw["yield"])
    state_soil, state_soil_report = clean_state_soil(raw["soil"])
    state_weather, state_weather_report = clean_state_weather(raw["weather"])
    merged, join_report = merge_yield_conditions(yield_rows, state_soil, state_weather)
    yield_profiles = profile_yield_conditions(merged)

    outputs = {
        "kaggle_soil_samples": soil_samples,
        "kaggle_soil_crop_profiles": soil_profiles,
        "kaggle_yield_observations": merged,
        "kaggle_yield_crop_profiles": yield_profiles,
        "kaggle_state_soil": state_soil,
        "kaggle_state_weather": state_weather,
    }
    for name, frame in outputs.items():
        write_outputs(frame, name, clean_dir)
    report = {
        "source": "Kaggle public datasets; see data_pipeline/README.md for URLs and limitations.",
        "crop_soil": crop_soil_report,
        "yield": yield_report,
        "state_soil": state_soil_report,
        "state_weather": state_weather_report,
        "yield_condition_join": join_report,
        "outputs": {name: {"rows": int(len(frame)), "columns": list(frame.columns)} for name, frame in outputs.items()},
    }
    with open(os.path.join(clean_dir, "kaggle_clean_report.json"), "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, allow_nan=False)
    return report


if __name__ == "__main__":
    report = run(*(sys.argv[1:3] or [None, None]))
    print(json.dumps(report, indent=2))
