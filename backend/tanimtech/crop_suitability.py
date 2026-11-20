"""Cautious ML advisory ranking trained from cleaned crop-yield observations."""

from __future__ import annotations

import csv
import math
import os
import re
from bisect import bisect_left, bisect_right
from functools import lru_cache

from .util import round_half_up

CLEAN_DIR = os.environ.get("TANIM_CLEAN_DIR") or os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "data_pipeline", "clean"))
YIELD_FILE = os.environ.get("TANIM_ML_YIELD_FILE") or os.path.join(
    CLEAN_DIR, "kaggle_yield_observations.csv")
MIN_CROP_OBSERVATIONS = 30
ML_WEIGHT = 0.2
SOURCE_NOTE = (
    "Kaggle crop-yield observations from India (1997–2020); the model predicts a "
    "within-crop yield percentile as a provisional suitability proxy, not a local yield forecast."
)
REQUIRED_COLUMNS = {
    "crop", "state", "soil_ph", "temperature_c", "rainfall_mm", "humidity_pct",
    "yield_value", "yield_reconciliation", "conditions_complete",
}
KNOWN_ALIASES = {
    "maize": "mais",
    "corn": "mais",
    "gram": "cicer-arietinum",
    "groundnut": "arachis-hypogaea",
}


def _key(value):
    return re.sub(r"[^a-z0-9]+", "", str(value or "").casefold())


def _catalog():
    from . import plant_catalog, store

    core = list(store.crops.all())
    profiles = {profile["slug"]: profile for profile in core}
    for profile in plant_catalog.as_crops():
        profiles.setdefault(profile["slug"], profile)
    aliases = {}
    for profile in profiles.values():
        values = [
            profile.get("slug"), profile.get("name"), profile.get("scientific"),
            *(profile.get("common_names") or profile.get("commonNames") or []),
        ]
        for value in values:
            if value:
                aliases.setdefault(_key(value), set()).add(profile["slug"])

    core_slugs = {profile["slug"] for profile in core}
    resolved = {}
    for alias, slugs in aliases.items():
        if len(slugs) == 1:
            resolved[alias] = next(iter(slugs))
            continue
        species = {_key(profiles[slug].get("scientific")) for slug in slugs}
        if len(species) == 1:
            preferred = sorted(slugs, key=lambda slug: (slug not in core_slugs, slug))
            resolved[alias] = preferred[0]
    for alias, slug in KNOWN_ALIASES.items():
        if slug in profiles:
            resolved[_key(alias)] = slug
    return profiles, resolved


def _inactive(status, reason, **details):
    return {
        "model": None,
        "vectorizer": None,
        "cropCounts": {},
        "status": {
            "active": False,
            "status": status,
            "weight": ML_WEIGHT,
            "source": SOURCE_NOTE,
            "note": reason,
            **details,
        },
    }


def _feature(row, crop_slug):
    return {
        "crop": crop_slug,
        "soil_ph": float(row["soil_ph"] if "soil_ph" in row else row["soilPh"]),
        "temperature_c": float(row["temperature_c"] if "temperature_c" in row else row["temperature"]),
        "rainfall_mm": float(row["rainfall_mm"] if "rainfall_mm" in row else row["rainfall"]),
        "humidity_pct": float(row["humidity_pct"] if "humidity_pct" in row else row["humidity"]),
    }


def _yield_percentile(value, reference_yields):
    if len(reference_yields) < 2:
        return 0.5
    low = bisect_left(reference_yields, value)
    high = bisect_right(reference_yields, value)
    percentile = ((low + high - 1) / 2) / (len(reference_yields) - 1)
    return max(0.0, min(1.0, percentile))


def _percentile_targets(rows, reference_yields):
    return [
        _yield_percentile(row["yield_value"], reference_yields[row["crop"]])
        for row in rows
    ]


def _load_state(path, modified_ns):
    del modified_ns
    if not os.path.isfile(path):
        return _inactive("unavailable", f"Cleaned Kaggle yield observations were not found at {path}.")
    try:
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.feature_extraction import DictVectorizer
        from sklearn.model_selection import GroupKFold
    except ImportError:
        return _inactive("unavailable", "Install scikit-learn from backend/requirements.txt to enable ML ranking.")

    profiles, aliases = _catalog()
    try:
        with open(path, newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            missing = sorted(REQUIRED_COLUMNS - set(reader.fieldnames or []))
            if missing:
                return _inactive("unavailable", f"Kaggle yield data is missing columns: {', '.join(missing)}.")
            source_rows = list(reader)
    except (OSError, csv.Error, UnicodeDecodeError) as error:
        return _inactive("unavailable", f"Could not read the cleaned Kaggle yield data: {error}")

    rows = []
    crop_counts = {}
    excluded = 0
    for source in source_rows:
        slug = aliases.get(_key(source.get("crop")))
        if (
            not slug
            or str(source.get("conditions_complete") or "").casefold() not in {"true", "1", "yes"}
            or source.get("yield_reconciliation") != "within_10pct"
            or not source.get("state")
        ):
            excluded += 1
            continue
        try:
            values = {
                "soil_ph": float(source["soil_ph"]),
                "temperature_c": float(source["temperature_c"]),
                "rainfall_mm": float(source["rainfall_mm"]),
                "humidity_pct": float(source["humidity_pct"]),
                "yield_value": float(source["yield_value"]),
            }
        except (KeyError, TypeError, ValueError):
            excluded += 1
            continue
        if (
            not all(math.isfinite(value) for value in values.values())
            or not 0 <= values["soil_ph"] <= 14
            or not -10 <= values["temperature_c"] <= 60
            or not 0 <= values["rainfall_mm"] <= 5000
            or not 0 <= values["humidity_pct"] <= 100
            or values["yield_value"] < 0
        ):
            excluded += 1
            continue
        row = {**values, "crop": slug, "state": source["state"]}
        rows.append(row)
        crop_counts[slug] = crop_counts.get(slug, 0) + 1

    supported = {slug for slug, count in crop_counts.items() if count >= MIN_CROP_OBSERVATIONS}
    rows = [row for row in rows if row["crop"] in supported]
    crop_counts = {slug: count for slug, count in crop_counts.items() if slug in supported}
    if len(rows) < 100 or len({row["state"] for row in rows}) < 5:
        return _inactive(
            "unavailable",
            "Not enough reconciled, crop-matched observations across states to validate ML ranking.",
            trainingRows=len(rows),
            matchedCrops=len(crop_counts),
            excludedRows=excluded,
        )

    groups = [row["state"] for row in rows]
    cross_validator = GroupKFold(n_splits=5)
    validation_indices = []
    model_predictions = []
    baseline_predictions = []
    actual = []
    validation_states = set()
    model_options = {
        "n_estimators": 60,
        "min_samples_leaf": 8,
        "random_state": 42,
        "n_jobs": 1,
    }
    completed_folds = 0

    for train_indices, held_out_indices in cross_validator.split(rows, groups=groups):
        train_crops = {rows[index]["crop"] for index in train_indices}
        test_indices = [
            index for index in held_out_indices
            if rows[index]["crop"] in train_crops
        ]
        if not test_indices:
            continue
        completed_folds += 1

        train_rows = [rows[index] for index in train_indices]
        test_rows = [rows[index] for index in test_indices]
        train_yields = {}
        for row in train_rows:
            train_yields.setdefault(row["crop"], []).append(row["yield_value"])
        for yields in train_yields.values():
            yields.sort()

        vectorizer = DictVectorizer(sparse=False)
        train_features = vectorizer.fit_transform([
            _feature(row, row["crop"]) for row in train_rows
        ])
        test_features = vectorizer.transform([
            _feature(row, row["crop"]) for row in test_rows
        ])
        train_targets = _percentile_targets(train_rows, train_yields)
        test_targets = _percentile_targets(test_rows, train_yields)
        validation_model = RandomForestRegressor(**model_options)
        validation_model.fit(train_features, train_targets)
        model_predictions.extend(validation_model.predict(test_features))
        actual.extend(test_targets)
        validation_indices.extend(test_indices)
        validation_states.update(row["state"] for row in test_rows)

        from .scoring import score_crop

        for row in test_rows:
            crop = profiles[row["crop"]]
            baseline_predictions.append(score_crop(crop, {
                "soilPh": row["soil_ph"],
                "temperature": row["temperature_c"],
                "rainfall": row["rainfall_mm"],
                "humidity": row["humidity_pct"],
            })["fit"] / 100)

    if completed_folds < 5 or len(validation_indices) < 50:
        return _inactive(
            "unavailable",
            "The complete five-fold held-out-state validation set is too small to enable ML ranking.",
            trainingRows=len(rows),
            matchedCrops=len(crop_counts),
            excludedRows=excluded,
        )

    model_mse = sum(
        (target - prediction) ** 2
        for target, prediction in zip(actual, model_predictions)
    ) / len(actual)
    baseline_mse = sum(
        (target - prediction) ** 2
        for target, prediction in zip(actual, baseline_predictions)
    ) / len(actual)
    model_mae = sum(
        abs(target - prediction)
        for target, prediction in zip(actual, model_predictions)
    ) / len(actual)
    baseline_mae = sum(
        abs(target - prediction)
        for target, prediction in zip(actual, baseline_predictions)
    ) / len(actual)
    validation = {
        "method": "5-fold held-out-state cross-validation",
        "rows": len(validation_indices),
        "states": len(validation_states),
        "folds": completed_folds,
        "modelMse": round(model_mse, 5),
        "ruleBaselineMse": round(baseline_mse, 5),
        "modelMae": round(model_mae, 5),
        "ruleBaselineMae": round(baseline_mae, 5),
    }
    if model_mse >= baseline_mse:
        return _inactive(
            "baseline_preferred",
            "ML did not outperform the transparent rule score across held-out states; rule-based ordering is retained.",
            trainingRows=len(rows),
            matchedCrops=len(crop_counts),
            excludedRows=excluded,
            validation=validation,
        )

    yields_by_crop = {}
    for row in rows:
        yields_by_crop.setdefault(row["crop"], []).append(row["yield_value"])
    for yields in yields_by_crop.values():
        yields.sort()
    targets = _percentile_targets(rows, yields_by_crop)
    vectorizer = DictVectorizer(sparse=False)
    features = vectorizer.fit_transform([
        _feature(row, row["crop"]) for row in rows
    ])
    model = RandomForestRegressor(**{**model_options, "n_estimators": 120})
    model.fit(features, targets)
    return {
        "model": model,
        "vectorizer": vectorizer,
        "cropCounts": crop_counts,
        "status": {
            "active": True,
            "status": "active",
            "weight": ML_WEIGHT,
            "trainingRows": len(rows),
            "matchedCrops": len(crop_counts),
            "excludedRows": excluded,
            "source": SOURCE_NOTE,
            "validation": validation,
            "note": "Only matched crops represented in the training data receive an advisory. Their rank blends 80% transparent ECOCROP fit with 20% Random Forest suitability; all other crops remain rule-based.",
        },
    }


@lru_cache(maxsize=2)
def _cached_state(path, modified_ns):
    return _load_state(path, modified_ns)


def _state():
    try:
        modified_ns = os.stat(YIELD_FILE).st_mtime_ns
    except OSError:
        modified_ns = 0
    return _cached_state(YIELD_FILE, modified_ns)


def ranking_status():
    return dict(_state()["status"])


def rank_results(results, conditions):
    state = _state()
    ranked = [dict(result) for result in results]
    if not state["status"]["active"]:
        return ranked, dict(state["status"])

    eligible = [result for result in ranked if result["slug"] in state["cropCounts"]]
    features = [_feature(conditions, result["slug"]) for result in eligible]
    predictions = state["model"].predict(state["vectorizer"].transform(features)) if features else []
    prediction_by_slug = {
        result["slug"]: max(0.0, min(1.0, float(prediction)))
        for result, prediction in zip(eligible, predictions)
    }
    for result in ranked:
        prediction = prediction_by_slug.get(result["slug"])
        if prediction is None:
            result["rankScore"] = result["fit"]
            result["rankingMethod"] = "rule-based"
            continue
        result["mlSuitability"] = round_half_up(prediction * 100)
        result["mlTrainingObservations"] = state["cropCounts"][result["slug"]]
        result["rankScore"] = round_half_up((1 - ML_WEIGHT) * result["fit"] + ML_WEIGHT * result["mlSuitability"])
        result["rankingMethod"] = "rule-plus-ml-advisory"
    ranked.sort(key=lambda result: (
        -result.get("rankScore", result["fit"]),
        -(result.get("soilMatch", {}).get("points") or 0),
        -result["fit"],
    ))
    return ranked, dict(state["status"])
