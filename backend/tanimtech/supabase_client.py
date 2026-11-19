"""Optional Supabase client setup.

The service-role key is server-only and is never returned by the API. The app
continues to work with local JSON storage when Supabase variables are absent.
"""
import os


def configuration():
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY", "")).strip()
    return {
        "configured": bool(url and key),
        "url": url,
        "keyPresent": bool(key),
        "usesServiceRole": bool(os.environ.get("SUPABASE_SERVICE_ROLE_KEY")),
    }


def get_client():
    """Return a Supabase client when configured, otherwise ``None``."""
    config = configuration()
    if not config["configured"]:
        return None
    try:
        from supabase import create_client
    except ImportError as error:
        raise RuntimeError("Install the backend requirements to enable Supabase.") from error
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ["SUPABASE_KEY"]
    return create_client(config["url"], key)
