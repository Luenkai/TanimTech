from flask import Blueprint, jsonify
from ..methodology import get_methodology

bp = Blueprint("methodology", __name__)


@bp.get("")
def methodology():
    return jsonify(get_methodology())
