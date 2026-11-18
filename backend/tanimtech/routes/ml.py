"""Linear-regression crop-outcome endpoint."""

from flask import Blueprint, jsonify, request

from ..ml_crop_ranker import CropOutcomeDataset, CropOutcomeRanker, DatasetError

bp = Blueprint("ml", __name__)


@bp.post("/recommendations")
def ml_recommendations():
    """Train the linear model from labeled rows and rank candidates.

    This is deliberately separate from /api/recommendations. Production use
    should validate and authorize training data before exposing this endpoint.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "Send a JSON object."}), 400
    rows = body.get("trainingRows")
    candidates = body.get("candidates")
    if not isinstance(rows, list) or not isinstance(candidates, list):
        return jsonify({"error": "trainingRows and candidates must both be arrays."}), 400
    try:
        dataset = CropOutcomeDataset.from_rows(rows)
        ranked = CropOutcomeRanker().fit(dataset).rank(candidates)
    except (DatasetError, TypeError) as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({
        "model": "ordinary-linear-regression",
        "trainingRows": len(dataset.features),
        "results": ranked,
        "note": "Advisory prediction from supplied labeled outcomes; not a yield guarantee.",
    })
