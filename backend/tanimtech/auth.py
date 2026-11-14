"""Manus OAuth integration and application-session helpers."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.parse
import urllib.request

from flask import redirect, request, session, url_for

from . import store

COOKIE_NAME = "webdev_app_session"


def configured():
    return all(os.environ.get(key) for key in ("MANUS_PROJECT_ID", "MANUS_OAUTH_PORTAL_URL", "MANUS_OAUTH_API_URL"))


def _b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


def _decode_part(value):
    return json.loads(base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)).decode())


def _platform_identity(raw):
    """Validate a Preview-provided HS256 project JWT when available."""
    secret = os.environ.get("MANUS_JWT_SECRET")
    project_id = os.environ.get("MANUS_PROJECT_ID")
    if not secret or not raw or raw.count(".") != 2:
        return None
    header_raw, payload_raw, signature = raw.split(".")
    try:
        header, payload = _decode_part(header_raw), _decode_part(payload_raw)
        expected = hmac.new(secret.encode(), f"{header_raw}.{payload_raw}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64(expected), signature):
            return None
        if header.get("alg") != "HS256" or payload.get("exp", 0) < time.time() or payload.get("appId") != project_id:
            return None
        return {"openId": payload.get("openId"), "name": payload.get("name", ""), "email": payload.get("email", "")}
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def current_user():
    raw_cookie = request.cookies.get(COOKIE_NAME)
    identity = _platform_identity(raw_cookie)
    if identity and identity.get("openId"):
        return store.users.upsert(identity["openId"], identity.get("name"), identity.get("email"))
    user_id = session.get("userId")
    return store.users.get(user_id) if user_id else None


def login_url():
    if not configured():
        return None
    redirect_uri = url_for("auth.callback", _external=True)
    nonce = secrets.token_urlsafe(24)
    session["oauthNonce"] = nonce
    state = _b64(json.dumps({"redirectUri": redirect_uri, "nonce": nonce}).encode())
    params = {"appId": os.environ["MANUS_PROJECT_ID"], "redirectUri": redirect_uri, "state": state, "responseType": "code"}
    return f"{os.environ['MANUS_OAUTH_PORTAL_URL'].rstrip('/')}/app-auth?{urllib.parse.urlencode(params)}"


def exchange(code, redirect_uri):
    base = os.environ["MANUS_OAUTH_API_URL"].rstrip("/")
    endpoint = f"{base}/webdev.v1.WebDevAuthPublicService/ExchangeToken"
    payload = {"clientId": os.environ["MANUS_PROJECT_ID"], "grantType": "authorization_code", "code": code, "redirectUri": redirect_uri}
    req = urllib.request.Request(endpoint, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode())


def identity(access_token):
    base = os.environ["MANUS_OAUTH_API_URL"].rstrip("/")
    endpoint = f"{base}/webdev.v1.WebDevAuthPublicService/GetUserInfo"
    req = urllib.request.Request(endpoint, data=json.dumps({"accessToken": access_token}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.loads(response.read().decode())


def finish_login(user_info):
    user = store.users.upsert(user_info.get("openId"), user_info.get("name"), user_info.get("email"))
    session.clear()
    session["userId"] = user["id"]
    return user


def logout():
    session.clear()
