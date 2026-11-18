"""Optional supervised ML ranker for crop outcomes.

This module is intentionally not imported by the existing Flask routes. It is a
safe extension point for experiments once a real, labeled farm-outcome dataset
is available. Choose either LightGBM or XGBoost at construction time.
"""

from __future__ import annotations

import csv
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


FEATURE_COLUMNS = (
    "soil_ph",
    "temperature_c",
    "humidity_pct",
    "rainfall_mm",
    "latitude",
    "longitude",
    "crop_code",
    "season_code",
    "soil_type_code",
    "drainage_code",
)
TARGET_COLUMN = "outcome_score"
REQUIRED_COLUMNS = FEATURE_COLUMNS + (TARGET_COLUMN,)


class DatasetError(ValueError):
    """Raised when training data is missing, malformed, or unsafe to use."""


@dataclass(frozen=True)
class CropOutcomeDataset:
    """Validated numeric training rows for a crop-outcome regression model."""

    features: tuple[tuple[float, ...], ...]
    targets: tuple[float, ...]

    @classmethod
    def from_rows(cls, rows: Iterable[Mapping[str, Any]]) -> "CropOutcomeDataset":
        features: list[tuple[float, ...]] = []
        targets: list[float] = []
        for index, row in enumerate(rows, start=2):
            missing = [column for column in REQUIRED_COLUMNS if column not in row or row[column] in (None, "")]
            if missing:
                raise DatasetError(f"row {index} is missing: {', '.join(missing)}")
            try:
                values = tuple(float(row[column]) for column in FEATURE_COLUMNS)
                target = float(row[TARGET_COLUMN])
            except (TypeError, ValueError) as exc:
                raise DatasetError(f"row {index} contains a non-numeric value") from exc
            if not all(value == value for value in (*values, target)):
                raise DatasetError(f"row {index} contains NaN")
            if not 0.0 <= target <= 1.0:
                raise DatasetError(f"row {index} outcome_score must be between 0 and 1")
            features.append(values)
            targets.append(target)
        if len(features) < 10:
            raise DatasetError("at least 10 labeled farm-outcome rows are required")
        return cls(tuple(features), tuple(targets))

    @classmethod
    def from_csv(cls, path: str | Path) -> "CropOutcomeDataset":
        with Path(path).open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            if not reader.fieldnames:
                raise DatasetError("the CSV has no header row")
            missing = [column for column in REQUIRED_COLUMNS if column not in reader.fieldnames]
            if missing:
                raise DatasetError(f"CSV is missing columns: {', '.join(missing)}")
            return cls.from_rows(reader)


class CropOutcomeRanker:
    """Train and use a LightGBM or XGBoost crop-outcome model.

    The target is a normalized observed outcome score from 0 to 1. This class
    does not invent labels, create synthetic outcomes, or alter TanimTech's
    existing rule-based recommendation engine.
    """

    def __init__(self, backend: str = "lightgbm", **model_options: Any) -> None:
        backend = backend.lower().strip()
        if backend not in {"lightgbm", "xgboost"}:
            raise ValueError("backend must be 'lightgbm' or 'xgboost'")
        self.backend = backend
        self.model_options = model_options
        self.model = self._build_model()
        self.is_fitted = False

    def _build_model(self) -> Any:
        options = {
            "n_estimators": 200,
            "learning_rate": 0.05,
            "max_depth": 6,
            "random_state": 42,
        }
        options.update(self.model_options)
        if self.backend == "lightgbm":
            try:
                from lightgbm import LGBMRegressor
            except ImportError as exc:
                raise ImportError("Install optional ML dependencies with: pip install lightgbm") from exc
            options.setdefault("verbosity", -1)
            return LGBMRegressor(objective="regression", **options)
        try:
            from xgboost import XGBRegressor
        except ImportError as exc:
            raise ImportError("Install optional ML dependencies with: pip install xgboost") from exc
        options.setdefault("verbosity", 0)
        return XGBRegressor(objective="reg:squarederror", **options)

    def fit(self, dataset: CropOutcomeDataset) -> "CropOutcomeRanker":
        self.model.fit(list(dataset.features), list(dataset.targets))
        self.is_fitted = True
        return self

    def predict(self, rows: Sequence[Mapping[str, Any]]) -> list[float]:
        if not self.is_fitted:
            raise RuntimeError("fit the ranker before calling predict")
        matrix = [_feature_row(row) for row in rows]
        return [max(0.0, min(1.0, float(value))) for value in self.model.predict(matrix)]

    def rank(self, candidates: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
        """Return candidates sorted by predicted outcome, highest first."""
        predictions = self.predict(candidates)
        ranked = [{**dict(candidate), "predictedOutcome": score} for candidate, score in zip(candidates, predictions)]
        return sorted(ranked, key=lambda item: item["predictedOutcome"], reverse=True)

    def save(self, path: str | Path) -> None:
        if not self.is_fitted:
            raise RuntimeError("fit the ranker before saving it")
        with Path(path).open("wb") as handle:
            pickle.dump({"backend": self.backend, "model_options": self.model_options, "model": self.model}, handle)

    @classmethod
    def load(cls, path: str | Path) -> "CropOutcomeRanker":
        with Path(path).open("rb") as handle:
            payload = pickle.load(handle)
        ranker = cls.__new__(cls)
        ranker.backend = payload["backend"]
        ranker.model_options = payload.get("model_options", {})
        ranker.model = payload["model"]
        ranker.is_fitted = True
        return ranker


def _feature_row(row: Mapping[str, Any]) -> list[float]:
    missing = [column for column in FEATURE_COLUMNS if column not in row or row[column] in (None, "")]
    if missing:
        raise DatasetError(f"prediction row is missing: {', '.join(missing)}")
    try:
        return [float(row[column]) for column in FEATURE_COLUMNS]
    except (TypeError, ValueError) as exc:
        raise DatasetError("prediction row contains a non-numeric value") from exc
