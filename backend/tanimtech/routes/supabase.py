"""Supabase integration diagnostics."""
from flask import Blueprint, jsonify

from ..supabase_client import configuration

bp = Blueprint("supabase", __name__)


@bp.get("/status")
def status():
    config = configuration()
    return jsonify({
        "configured": config["configured"],
        "urlConfigured": bool(config["url"]),
        "keyPresent": config["keyPresent"],
        "usesServiceRole": config["usesServiceRole"],
        "note": "Supabase is optional; local JSON storage remains active until a persistence adapter is enabled.",
    })
