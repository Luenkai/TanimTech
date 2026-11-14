"""Manus OAuth endpoints for the TanimTech account/profile experience."""
from flask import Blueprint, jsonify, redirect, request, session

from .. import auth

bp = Blueprint("auth", __name__)


@bp.get("/config")
def config():
    return jsonify({"configured": auth.configured(), "provider": "Manus"})


@bp.get("/login")
def login():
    target = auth.login_url()
    if not target:
        return jsonify({"error": "Manus login is not configured for this deployment."}), 503
    return redirect(target)


@bp.get("/callback")
def callback():
    state = request.args.get("state", "")
    code = request.args.get("code", "")
    try:
        raw = auth._decode_part(state)
        if not code or raw.get("nonce") != session.pop("oauthNonce", None):
            return jsonify({"error": "Login state could not be verified."}), 400
        exchange = auth.exchange(code, raw.get("redirectUri"))
        user_info = auth.identity(exchange["accessToken"])
        auth.finish_login(user_info)
        return redirect("/profile.html")
    except Exception:
        return jsonify({"error": "Manus login could not be completed. Please try again."}), 400


@bp.get("/me")
def me():
    user = auth.current_user()
    if not user:
        return jsonify({"authenticated": False})
    return jsonify({"authenticated": True, "user": user})


@bp.post("/logout")
def logout():
    auth.logout()
    response = jsonify({"ok": True})
    response.delete_cookie(auth.COOKIE_NAME)
    return response
