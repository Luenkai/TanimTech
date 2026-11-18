"""Optional linear-regression model for crop outcomes.

This module is intentionally not imported by the existing Flask routes. It is a
safe extension point for experiments once real, labeled farm-outcome data is
available. It uses ordinary least-squares linear regression implemented with
Python's standard library, so no ML package is required.
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
    """Train and use an ordinary least-squares linear-regression model.

    The target is a normalized observed outcome score from 0 to 1. The model
    adds an intercept, solves the normal equations, and clips predictions to
    that target range. It does not invent labels or alter the existing
    rule-based recommendation engine.
    """

    def __init__(self) -> None:
        self.coefficients: tuple[float, ...] | None = None
        self.is_fitted = False

    def fit(self, dataset: CropOutcomeDataset) -> "CropOutcomeRanker":
        matrix = [[1.0, *row] for row in dataset.features]
        transpose = list(zip(*matrix))
        gram = [[sum(a * b for a, b in zip(column_a, column_b)) for column_b in transpose] for column_a in transpose]
        target_vector = [sum(a * y for a, y in zip(column, dataset.targets)) for column in transpose]
        try:
            self.coefficients = tuple(_solve_linear_system(gram, target_vector))
        except ValueError as exc:
            raise DatasetError("training data has dependent or duplicate features; linear regression cannot be solved") from exc
        self.is_fitted = True
        return self

    def predict(self, rows: Sequence[Mapping[str, Any]]) -> list[float]:
        if not self.is_fitted or self.coefficients is None:
            raise RuntimeError("fit the ranker before calling predict")
        return [max(0.0, min(1.0, _dot(self.coefficients, [1.0, *_feature_row(row)]))) for row in rows]

    def rank(self, candidates: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
        """Return candidates sorted by predicted outcome, highest first."""
        predictions = self.predict(candidates)
        ranked = [{**dict(candidate), "predictedOutcome": score} for candidate, score in zip(candidates, predictions)]
        return sorted(ranked, key=lambda item: item["predictedOutcome"], reverse=True)

    def save(self, path: str | Path) -> None:
        if not self.is_fitted:
            raise RuntimeError("fit the ranker before saving it")
        with Path(path).open("wb") as handle:
            pickle.dump({"coefficients": self.coefficients}, handle)

    @classmethod
    def load(cls, path: str | Path) -> "CropOutcomeRanker":
        with Path(path).open("rb") as handle:
            payload = pickle.load(handle)
        ranker = cls()
        ranker.coefficients = tuple(payload["coefficients"])
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


def _dot(left: Sequence[float], right: Sequence[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def _solve_linear_system(matrix: list[list[float]], vector: list[float]) -> list[float]:
    """Solve a square system with Gaussian elimination and partial pivoting."""
    n = len(vector)
    augmented = [row[:] + [vector[index]] for index, row in enumerate(matrix)]
    for column in range(n):
        pivot = max(range(column, n), key=lambda index: abs(augmented[index][column]))
        if abs(augmented[pivot][column]) < 1e-12:
            raise ValueError("singular matrix")
        augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        augmented[column] = [value / divisor for value in augmented[column]]
        for row in range(n):
            if row == column:
                continue
            factor = augmented[row][column]
            augmented[row] = [a - factor * b for a, b in zip(augmented[row], augmented[column])]
    return [augmented[index][-1] for index in range(n)]
