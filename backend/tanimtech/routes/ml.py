"""Machine-learning endpoints used by the app's advisory features."""
from flask import Blueprint, jsonify, request

from ..linear_regression import (
    LinearRegressionInputError,
    predict_simple_linear_regression,
    train_simple_linear_regression,
)

bp = Blueprint("ml", __name__)


@bp.post("/linear-regression")
def linear_regression():
    """Train and optionally predict with a one-feature linear regression model.

    Body: {"samples": [{"feature": 1, "target": 2}, ...], "predict": 3}
    """
    body = request.get_json(silent=True) or {}
    samples = body.get("samples")
    if isinstance(samples, list) and len(samples) > 1000:
        return jsonify({"error": "A maximum of 1000 samples is allowed."}), 400
    try:
        result = train_simple_linear_regression(samples)
        if "predict" in body:
            result["prediction"] = predict_simple_linear_regression(result, body["predict"])
    except LinearRegressionInputError as error:
        return jsonify({"error": str(error)}), 400
    return jsonify(result)
