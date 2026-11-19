"""Small, explicit simple-linear-regression service for TanimTech.

The model intentionally accepts one numeric feature and one numeric target. It is
an educational/advisory model and must not be interpreted as a yield guarantee.
"""
import math

from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score


class LinearRegressionInputError(ValueError):
    """Raised when a regression request cannot be trained safely."""


def _number(value, label):
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise LinearRegressionInputError(f"{label} must be numeric.") from exc
    if not math.isfinite(number):
        raise LinearRegressionInputError(f"{label} must be finite.")
    return number


def train_simple_linear_regression(samples):
    """Fit y = coefficient * x + intercept from ``[{feature, target}, ...]``.

    The returned model is deliberately JSON-serializable so the API can expose
    the coefficients and validation metrics without serializing a pickle.
    """
    if not isinstance(samples, list) or len(samples) < 2:
        raise LinearRegressionInputError("At least two samples are required.")

    pairs = []
    for index, sample in enumerate(samples):
        if not isinstance(sample, dict):
            raise LinearRegressionInputError(f"Sample {index + 1} must be an object.")
        pairs.append((_number(sample.get("feature"), f"Sample {index + 1} feature"),
                      _number(sample.get("target"), f"Sample {index + 1} target")))

    if len({feature for feature, _ in pairs}) < 2:
        raise LinearRegressionInputError("Feature values must contain at least two distinct values.")

    x = [[feature] for feature, _ in pairs]
    y = [target for _, target in pairs]
    model = LinearRegression().fit(x, y)
    predictions = model.predict(x)
    return {
        "algorithm": "simple-linear-regression",
        "featureCount": 1,
        "sampleCount": len(pairs),
        "coefficient": float(model.coef_[0]),
        "intercept": float(model.intercept_),
        "r2": float(r2_score(y, predictions)),
        "mse": float(mean_squared_error(y, predictions)),
        "disclaimer": "Advisory model trained on the supplied samples; not a yield guarantee.",
    }


def predict_simple_linear_regression(model, feature):
    """Predict a target using a coefficient/intercept response from this module."""
    if not isinstance(model, dict):
        raise LinearRegressionInputError("Model must be an object.")
    coefficient = _number(model.get("coefficient"), "coefficient")
    intercept = _number(model.get("intercept"), "intercept")
    return coefficient * _number(feature, "feature") + intercept
